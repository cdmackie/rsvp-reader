/**
 * DOCX (Microsoft Word) file format adapter.
 * Uses mammoth.js to convert DOCX to HTML, then parses like HTML.
 */

import type { FileAdapter, AdapterParseResult, PreviewContent } from './types';
import type { ParsedWord, ParsedDocument } from '../text-parser';
import type { ChapterContent, ChapterInfo } from '../epub-parser';
import { splitOnDashes } from '../text-parser';

/**
 * Escape HTML special characters.
 */
function escapeHtml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#039;');
}

/**
 * Extract words from HTML, preserving formatting and generating preview HTML.
 */
function extractWordsFromHtml(html: string, targetWordsPerPage = 250): {
	document: ParsedDocument;
	preview: PreviewContent;
} {
	const parser = new DOMParser();
	const doc = parser.parseFromString(html, 'text/html');
	const body = doc.body;

	const words: ParsedWord[] = [];
	const paragraphStarts: number[] = [0];
	const pageStarts: number[] = [0];
	const htmlParts: string[] = ['<div class="docx-content">'];

	let wordIndex = 0;
	let paragraphIndex = 0;
	let wordsOnCurrentPage = 0;
	let currentPage = 0;

	const blockTags = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'blockquote', 'div', 'table', 'tr']);
	const skipTags = new Set(['script', 'style', 'noscript']);

	function extractFromNode(node: Node, italic: boolean, bold: boolean): void {
		if (node.nodeType === Node.TEXT_NODE) {
			const text = node.textContent || '';
			const rawWords = text.split(/\s+/).filter(w => w.length > 0);
			const splitWords = rawWords.flatMap(splitOnDashes);

			for (const word of splitWords) {
				words.push({
					text: word,
					paragraphIndex,
					pageIndex: currentPage,
					italic: italic || undefined,
					bold: bold || undefined
				});

				// Build HTML with word marker
				let wordHtml = `<span data-word-index="${wordIndex}">${escapeHtml(word)}</span>`;
				if (bold && italic) {
					wordHtml = `<strong><em>${wordHtml}</em></strong>`;
				} else if (bold) {
					wordHtml = `<strong>${wordHtml}</strong>`;
				} else if (italic) {
					wordHtml = `<em>${wordHtml}</em>`;
				}
				htmlParts.push(wordHtml + ' ');

				wordIndex++;
				wordsOnCurrentPage++;
			}
		} else if (node.nodeType === Node.ELEMENT_NODE) {
			const el = node as Element;
			const tagName = el.tagName.toLowerCase();

			if (skipTags.has(tagName)) {
				return;
			}

			// Handle images - include them in the output HTML
			if (tagName === 'img') {
				const src = el.getAttribute('src');
				const alt = el.getAttribute('alt') || '';
				if (src) {
					// Mark image with current word index for positioning
					htmlParts.push(`<img src="${src}" alt="${escapeHtml(alt)}" data-word-index="${wordIndex}" style="max-width: 100%; height: auto; display: block; margin: 0.5em auto;" />`);
				}
				return;
			}

			const isItalic = italic || tagName === 'i' || tagName === 'em';
			const isBold = bold || tagName === 'b' || tagName === 'strong';

			if (blockTags.has(tagName) && wordIndex > 0) {
				if (wordsOnCurrentPage >= targetWordsPerPage) {
					currentPage++;
					pageStarts.push(wordIndex);
					wordsOnCurrentPage = 0;
				}
				paragraphIndex++;
				paragraphStarts.push(wordIndex);
			}

			// Open block tag in HTML output
			if (blockTags.has(tagName)) {
				if (tagName.startsWith('h') && tagName.length === 2) {
					htmlParts.push(`<${tagName}>`);
				} else if (tagName === 'li') {
					htmlParts.push('<li>');
				} else if (tagName === 'blockquote') {
					htmlParts.push('<blockquote>');
				} else {
					htmlParts.push('<p>');
				}
			}

			for (const child of Array.from(node.childNodes)) {
				extractFromNode(child, isItalic, isBold);
			}

			// Close block tag
			if (blockTags.has(tagName)) {
				if (tagName.startsWith('h') && tagName.length === 2) {
					htmlParts.push(`</${tagName}>`);
				} else if (tagName === 'li') {
					htmlParts.push('</li>');
				} else if (tagName === 'blockquote') {
					htmlParts.push('</blockquote>');
				} else {
					htmlParts.push('</p>');
				}
			}
		}
	}

	extractFromNode(body, false, false);
	htmlParts.push('</div>');

	// Update pageIndex for all words
	let pageIdx = 0;
	for (let i = 0; i < words.length; i++) {
		if (pageIdx < pageStarts.length - 1 && i >= pageStarts[pageIdx + 1]) {
			pageIdx++;
		}
		words[i].pageIndex = pageIdx;
	}

	const document: ParsedDocument = {
		words,
		paragraphStarts,
		pageStarts,
		totalWords: words.length,
		totalParagraphs: paragraphStarts.length,
		totalPages: pageStarts.length
	};

	// Create preview content
	const chapterContents: ChapterContent[] = words.length > 0 ? [{
		chapterIndex: 0,
		htmlWithMarkers: htmlParts.join(''),
		wordRange: [0, words.length - 1],
		imageUrls: new Map()
	}] : [];

	const chapters: ChapterInfo[] = words.length > 0 ? [{
		title: 'Document',
		href: '#document'
	}] : [];

	const chapterStarts = words.length > 0 ? [0] : [];

	return {
		document,
		preview: {
			chapterContents,
			chapters,
			chapterStarts
		}
	};
}

/**
 * Adapter for DOCX files.
 * Requires mammoth.js for DOCX to HTML conversion.
 */
export const docxAdapter: FileAdapter = {
	extensions: ['docx'],
	mimeTypes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
	formatName: 'Microsoft Word (DOCX)',
	supportsPreview: true,

	async parse(file: File): Promise<AdapterParseResult> {
		const warnings: string[] = [];

		try {
			// Dynamic import mammoth to keep bundle size smaller
			const mammoth = await import('mammoth');

			const arrayBuffer = await file.arrayBuffer();
			const result = await mammoth.convertToHtml({ arrayBuffer });

			// Collect any conversion warnings
			if (result.messages && result.messages.length > 0) {
				for (const msg of result.messages) {
					if (msg.type === 'warning') {
						warnings.push(msg.message);
					}
				}
			}

			const html = result.value;
			const parsed = extractWordsFromHtml(html);

			// Extract title from filename
			const title = file.name.replace(/\.docx$/i, '');

			return {
				document: parsed.document,
				title,
				preview: parsed.preview,
				warnings,
				extra: {
					fileType: 'docx'
				}
			};
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Failed to parse DOCX file';
			return {
				document: {
					words: [],
					paragraphStarts: [],
					pageStarts: [],
					totalWords: 0,
					totalParagraphs: 0,
					totalPages: 0
				},
				warnings: [message],
				extra: {
					fileType: 'docx'
				}
			};
		}
	}
};
