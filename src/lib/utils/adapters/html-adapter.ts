/**
 * HTML file format adapter.
 * Parses HTML files using DOM APIs with preview support.
 */

import type { FileAdapter, AdapterParseResult } from './types';
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
 * Parse HTML and extract document with preview content.
 */
function parseHtml(html: string, targetWordsPerPage = 250): {
	document: ParsedDocument;
	title?: string;
	preview?: { chapterContents: ChapterContent[]; chapters: ChapterInfo[]; chapterStarts: number[] };
} {
	const parser = new DOMParser();
	const doc = parser.parseFromString(html, 'text/html');
	const body = doc.body;

	const words: ParsedWord[] = [];
	const paragraphStarts: number[] = [0];
	const pageStarts: number[] = [0];
	const htmlParts: string[] = ['<div class="html-content">'];

	let wordIndex = 0;
	let paragraphIndex = 0;
	let wordsOnCurrentPage = 0;
	let currentPage = 0;

	// Block-level elements that define paragraphs
	const blockTags = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'blockquote', 'div', 'section', 'article', 'aside', 'main', 'header', 'footer', 'pre', 'figcaption', 'td', 'th']);
	const skipTags = new Set(['script', 'style', 'noscript', 'svg', 'nav', 'head', 'meta', 'link']);

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

			// Skip non-content elements
			if (skipTags.has(tagName)) {
				return;
			}

			// Check for formatting
			const isItalic = italic || tagName === 'i' || tagName === 'em';
			const isBold = bold || tagName === 'b' || tagName === 'strong';

			// Start a new paragraph for block elements
			if (blockTags.has(tagName) && wordIndex > 0) {
				// Check if we need a new page
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

	// Process the body
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

	// Extract title
	let title: string | undefined;
	const titleEl = doc.querySelector('title');
	if (titleEl?.textContent?.trim()) {
		title = titleEl.textContent.trim();
	} else {
		const h1 = doc.querySelector('h1');
		if (h1?.textContent?.trim()) {
			title = h1.textContent.trim();
		}
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
		title: title || 'Document',
		href: '#document'
	}] : [];

	const chapterStarts = words.length > 0 ? [0] : [];

	return {
		document,
		title,
		preview: words.length > 0 ? {
			chapterContents,
			chapters,
			chapterStarts
		} : undefined
	};
}

/**
 * Adapter for HTML files.
 */
export const htmlAdapter: FileAdapter = {
	extensions: ['html', 'htm', 'xhtml'],
	mimeTypes: ['text/html', 'application/xhtml+xml'],
	formatName: 'HTML',
	supportsPreview: true,

	async parse(file: File): Promise<AdapterParseResult> {
		const html = await file.text();
		const result = parseHtml(html);
		const title = result.title || file.name.replace(/\.(html?|xhtml)$/i, '');

		return {
			document: result.document,
			title,
			preview: result.preview,
			warnings: [],
			extra: {
				fileType: 'html'
			}
		};
	}
};
