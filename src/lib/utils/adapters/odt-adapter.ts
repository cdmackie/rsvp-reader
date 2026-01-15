/**
 * ODT (OpenDocument Text) file format adapter.
 * ODT files are ZIP archives containing XML content.
 */

import type { FileAdapter, AdapterParseResult } from './types';
import type { ParsedWord, ParsedDocument } from '../text-parser';
import { splitOnDashes } from '../text-parser';

/**
 * Parse ODT content.xml and extract text with formatting.
 */
function parseOdtContent(xml: string, targetWordsPerPage = 250): ParsedDocument {
	const parser = new DOMParser();
	const doc = parser.parseFromString(xml, 'text/xml');

	const words: ParsedWord[] = [];
	const paragraphStarts: number[] = [];
	const pageStarts: number[] = [0];

	let wordIndex = 0;
	let paragraphIndex = 0;
	let wordsOnCurrentPage = 0;
	let currentPage = 0;

	/**
	 * Check if an element has a specific style property.
	 */
	function hasStyleProperty(el: Element, property: string): boolean {
		const styleName = el.getAttribute('text:style-name');
		// In a full implementation, we'd look up the style in styles.xml
		// For now, just check common naming conventions
		if (styleName) {
			const lower = styleName.toLowerCase();
			if (property === 'italic' && (lower.includes('italic') || lower.includes('emphasis'))) {
				return true;
			}
			if (property === 'bold' && (lower.includes('bold') || lower.includes('strong'))) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Extract text from an ODT element.
	 */
	function extractFromElement(el: Element, italic: boolean, bold: boolean): void {
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
					wordIndex++;
					wordsOnCurrentPage++;
				}
			} else if (node.nodeType === Node.ELEMENT_NODE) {
				const childEl = node as Element;
				const localName = childEl.localName;

				// Check for formatting
				const isItalic = italic || hasStyleProperty(childEl, 'italic');
				const isBold = bold || hasStyleProperty(childEl, 'bold');

				switch (localName) {
					case 'p':
					case 'h':
						// Paragraph or heading
						if (wordIndex > 0) {
							if (wordsOnCurrentPage >= targetWordsPerPage) {
								currentPage++;
								pageStarts.push(wordIndex);
								wordsOnCurrentPage = 0;
							}
							paragraphIndex++;
							paragraphStarts.push(wordIndex);
						}
						extractFromElement(childEl, isItalic, isBold);
						break;
					case 's':
						// Space
						break;
					case 'tab':
						// Tab
						break;
					case 'line-break':
						// Line break within paragraph
						break;
					case 'span':
						// Styled text span
						extractFromElement(childEl, isItalic, isBold);
						break;
					case 'a':
						// Hyperlink
						extractFromElement(childEl, isItalic, isBold);
						break;
					case 'list':
					case 'list-item':
						extractFromElement(childEl, isItalic, isBold);
						break;
					default:
						// Other elements - recurse
						extractFromElement(childEl, isItalic, isBold);
						break;
				}
			}
		}
	}

	// Start first paragraph
	paragraphStarts.push(0);

	// Find the body content
	const body = doc.querySelector('body') ||
		doc.getElementsByTagNameNS('urn:oasis:names:tc:opendocument:xmlns:office:1.0', 'body')[0] ||
		doc.getElementsByTagName('office:body')[0];

	if (body) {
		const text = body.querySelector('text') ||
			body.getElementsByTagNameNS('urn:oasis:names:tc:opendocument:xmlns:office:1.0', 'text')[0] ||
			body.getElementsByTagName('office:text')[0];

		if (text) {
			extractFromElement(text as Element, false, false);
		} else {
			extractFromElement(body as Element, false, false);
		}
	}

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
 * Extract title from ODT meta.xml.
 */
function extractTitle(metaXml: string | null, filename: string): string {
	if (metaXml) {
		const parser = new DOMParser();
		const doc = parser.parseFromString(metaXml, 'text/xml');

		// Try dc:title
		const titleEl = doc.getElementsByTagNameNS('http://purl.org/dc/elements/1.1/', 'title')[0] ||
			doc.querySelector('title');
		if (titleEl?.textContent?.trim()) {
			return titleEl.textContent.trim();
		}
	}

	return filename.replace(/\.odt$/i, '');
}

/**
 * Extract author from ODT meta.xml.
 */
function extractAuthor(metaXml: string | null): string | undefined {
	if (metaXml) {
		const parser = new DOMParser();
		const doc = parser.parseFromString(metaXml, 'text/xml');

		// Try dc:creator
		const creatorEl = doc.getElementsByTagNameNS('http://purl.org/dc/elements/1.1/', 'creator')[0] ||
			doc.querySelector('creator');
		if (creatorEl?.textContent?.trim()) {
			return creatorEl.textContent.trim();
		}
	}

	return undefined;
}

/**
 * Adapter for ODT files.
 * Requires JSZip for ZIP extraction.
 */
export const odtAdapter: FileAdapter = {
	extensions: ['odt'],
	mimeTypes: ['application/vnd.oasis.opendocument.text'],
	formatName: 'OpenDocument Text (ODT)',
	supportsPreview: false,

	async parse(file: File): Promise<AdapterParseResult> {
		try {
			// Dynamic import JSZip
			const JSZip = (await import('jszip')).default;

			const arrayBuffer = await file.arrayBuffer();
			const zip = await JSZip.loadAsync(arrayBuffer);

			// Get content.xml
			const contentFile = zip.file('content.xml');
			if (!contentFile) {
				throw new Error('Invalid ODT file: content.xml not found');
			}
			const contentXml = await contentFile.async('string');

			// Try to get meta.xml for title/author
			const metaFile = zip.file('meta.xml');
			const metaXml = metaFile ? await metaFile.async('string') : null;

			const parsed = parseOdtContent(contentXml);
			const title = extractTitle(metaXml, file.name);
			const author = extractAuthor(metaXml);

			return {
				document: parsed,
				title,
				author,
				warnings: [],
				extra: {
					fileType: 'odt'
				}
			};
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Failed to parse ODT file';
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
					fileType: 'odt'
				}
			};
		}
	}
};
