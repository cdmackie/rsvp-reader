/**
 * FB2 (FictionBook) file format adapter.
 * FB2 is an XML-based ebook format popular in Russia and Eastern Europe.
 */

import type { FileAdapter, AdapterParseResult } from './types';
import type { ParsedWord, ParsedDocument } from '../text-parser';
import type { ChapterContent, ChapterInfo } from '../epub-parser';
import { splitOnDashes } from '../text-parser';

/**
 * Parse FB2 XML and extract document structure.
 */
function parseFb2(xml: string, targetWordsPerPage = 250): {
	document: ParsedDocument;
	title?: string;
	author?: string;
	preview?: { chapterContents: ChapterContent[]; chapters: ChapterInfo[]; chapterStarts: number[] };
} {
	const parser = new DOMParser();
	const doc = parser.parseFromString(xml, 'text/xml');

	// Check for parse errors
	const parseError = doc.querySelector('parsererror');
	if (parseError) {
		throw new Error('Invalid FB2 file: XML parse error');
	}

	const words: ParsedWord[] = [];
	const paragraphStarts: number[] = [];
	const pageStarts: number[] = [0];
	const chapters: ChapterInfo[] = [];
	const chapterStarts: number[] = [];
	const chapterContents: ChapterContent[] = [];

	let wordIndex = 0;
	let paragraphIndex = 0;
	let wordsOnCurrentPage = 0;
	let currentPage = 0;
	let currentChapter = -1;

	// Extract metadata
	let title: string | undefined;
	let author: string | undefined;

	const titleInfo = doc.querySelector('title-info');
	if (titleInfo) {
		const bookTitle = titleInfo.querySelector('book-title');
		if (bookTitle?.textContent?.trim()) {
			title = bookTitle.textContent.trim();
		}

		const authorEl = titleInfo.querySelector('author');
		if (authorEl) {
			const firstName = authorEl.querySelector('first-name')?.textContent?.trim() || '';
			const lastName = authorEl.querySelector('last-name')?.textContent?.trim() || '';
			const middleName = authorEl.querySelector('middle-name')?.textContent?.trim() || '';
			author = [firstName, middleName, lastName].filter(Boolean).join(' ');
		}
	}

	// Process body sections (chapters)
	const body = doc.querySelector('body');
	if (!body) {
		throw new Error('Invalid FB2 file: no body element found');
	}

	/**
	 * Extract text from an FB2 element, preserving formatting.
	 */
	function extractFromElement(el: Element, italic: boolean, bold: boolean, htmlParts: string[]): void {
		for (const node of Array.from(el.childNodes)) {
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

					// Add word to HTML with marker
					let html = `<span data-word-index="${wordIndex}">${escapeHtml(word)}</span>`;
					if (bold) html = `<strong>${html}</strong>`;
					if (italic) html = `<em>${html}</em>`;
					htmlParts.push(html);

					wordIndex++;
					wordsOnCurrentPage++;
				}
			} else if (node.nodeType === Node.ELEMENT_NODE) {
				const childEl = node as Element;
				const tagName = childEl.tagName.toLowerCase();

				// Handle formatting tags
				const isItalic = italic || tagName === 'emphasis';
				const isBold = bold || tagName === 'strong';

				if (tagName === 'p') {
					// New paragraph
					if (wordIndex > 0) {
						if (wordsOnCurrentPage >= targetWordsPerPage) {
							currentPage++;
							pageStarts.push(wordIndex);
							wordsOnCurrentPage = 0;
						}
						paragraphIndex++;
						paragraphStarts.push(wordIndex);
					}
					htmlParts.push('<p>');
					extractFromElement(childEl, isItalic, isBold, htmlParts);
					htmlParts.push('</p>');
				} else if (tagName === 'empty-line') {
					// Empty line - treat as paragraph break
					if (wordIndex > 0) {
						paragraphIndex++;
						paragraphStarts.push(wordIndex);
					}
				} else if (tagName === 'title') {
					// Section title
					htmlParts.push('<h2>');
					extractFromElement(childEl, isItalic, isBold, htmlParts);
					htmlParts.push('</h2>');
				} else if (tagName === 'subtitle') {
					htmlParts.push('<h3>');
					extractFromElement(childEl, isItalic, isBold, htmlParts);
					htmlParts.push('</h3>');
				} else if (tagName === 'epigraph' || tagName === 'cite') {
					htmlParts.push('<blockquote>');
					extractFromElement(childEl, isItalic, isBold, htmlParts);
					htmlParts.push('</blockquote>');
				} else if (tagName === 'poem' || tagName === 'stanza' || tagName === 'v') {
					// Poetry
					htmlParts.push('<p class="verse">');
					extractFromElement(childEl, isItalic, isBold, htmlParts);
					htmlParts.push('</p>');
				} else {
					// Other elements - just extract content
					extractFromElement(childEl, isItalic, isBold, htmlParts);
				}
			}
		}
	}

	// Start first paragraph
	paragraphStarts.push(0);

	// Process sections (chapters)
	const sections = body.querySelectorAll(':scope > section');

	if (sections.length === 0) {
		// No sections - treat entire body as one chapter
		const htmlParts: string[] = ['<div class="chapter">'];
		const chapterStartIndex = wordIndex;

		extractFromElement(body, false, false, htmlParts);

		htmlParts.push('</div>');

		if (wordIndex > chapterStartIndex) {
			currentChapter++;
			chapters.push({ title: title || 'Document', href: '#chapter-0' });
			chapterStarts.push(chapterStartIndex);
			chapterContents.push({
				chapterIndex: currentChapter,
				htmlWithMarkers: htmlParts.join(''),
				wordRange: [chapterStartIndex, wordIndex - 1],
				imageUrls: new Map()
			});
		}
	} else {
		// Process each section as a chapter
		for (const section of Array.from(sections)) {
			const htmlParts: string[] = ['<div class="chapter">'];
			const chapterStartIndex = wordIndex;

			// Get section title
			const sectionTitle = section.querySelector(':scope > title');
			let chapterTitle = `Chapter ${chapters.length + 1}`;
			if (sectionTitle?.textContent?.trim()) {
				chapterTitle = sectionTitle.textContent.trim();
			}

			// Start new page for chapter
			if (wordIndex > 0) {
				currentPage++;
				pageStarts.push(wordIndex);
				wordsOnCurrentPage = 0;
			}

			extractFromElement(section, false, false, htmlParts);

			htmlParts.push('</div>');

			if (wordIndex > chapterStartIndex) {
				currentChapter++;
				chapters.push({ title: chapterTitle, href: `#chapter-${currentChapter}` });
				chapterStarts.push(chapterStartIndex);
				chapterContents.push({
					chapterIndex: currentChapter,
					htmlWithMarkers: htmlParts.join(''),
					wordRange: [chapterStartIndex, wordIndex - 1],
					imageUrls: new Map()
				});
			}
		}
	}

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

	return {
		document,
		title,
		author,
		preview: chapters.length > 0 ? {
			chapterContents,
			chapters,
			chapterStarts
		} : undefined
	};
}

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
 * Adapter for FB2 files.
 */
export const fb2Adapter: FileAdapter = {
	extensions: ['fb2'],
	mimeTypes: ['application/x-fictionbook+xml', 'text/xml'],
	formatName: 'FictionBook (FB2)',
	supportsPreview: true,

	async parse(file: File): Promise<AdapterParseResult> {
		const xml = await file.text();

		try {
			const result = parseFb2(xml);

			return {
				document: result.document,
				title: result.title,
				author: result.author,
				preview: result.preview,
				warnings: [],
				extra: {
					fileType: 'fb2'
				}
			};
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Failed to parse FB2 file';
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
					fileType: 'fb2'
				}
			};
		}
	}
};
