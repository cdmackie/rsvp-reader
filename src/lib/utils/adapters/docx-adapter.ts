/**
 * DOCX (Microsoft Word) file format adapter.
 * Uses mammoth.js to convert DOCX to HTML, then parses like HTML.
 */

import type { FileAdapter, AdapterParseResult } from './types';
import type { ParsedWord, ParsedDocument } from '../text-parser';
import { splitOnDashes } from '../text-parser';

/**
 * Extract words from HTML, preserving formatting.
 */
function extractWordsFromHtml(html: string, targetWordsPerPage = 250): ParsedDocument {
	const parser = new DOMParser();
	const doc = parser.parseFromString(html, 'text/html');
	const body = doc.body;

	const words: ParsedWord[] = [];
	const paragraphStarts: number[] = [];
	const pageStarts: number[] = [0];

	let wordIndex = 0;
	let paragraphIndex = 0;
	let wordsOnCurrentPage = 0;
	let currentPage = 0;

	const blockTags = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'blockquote', 'div', 'table', 'tr']);

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
				wordIndex++;
				wordsOnCurrentPage++;
			}
		} else if (node.nodeType === Node.ELEMENT_NODE) {
			const el = node as Element;
			const tagName = el.tagName.toLowerCase();

			if (tagName === 'script' || tagName === 'style') {
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

			for (const child of Array.from(node.childNodes)) {
				extractFromNode(child, isItalic, isBold);
			}
		}
	}

	paragraphStarts.push(0);
	extractFromNode(body, false, false);

	// Update pageIndex
	let pageIdx = 0;
	for (let i = 0; i < words.length; i++) {
		if (pageIdx < pageStarts.length - 1 && i >= pageStarts[pageIdx + 1]) {
			pageIdx++;
		}
		words[i].pageIndex = pageIdx;
	}

	return {
		words,
		paragraphStarts,
		pageStarts,
		totalWords: words.length,
		totalParagraphs: paragraphStarts.length,
		totalPages: pageStarts.length
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
	supportsPreview: false,

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
				document: parsed,
				title,
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
