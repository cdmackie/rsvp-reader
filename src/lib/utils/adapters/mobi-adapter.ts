/**
 * MOBI/AZW3 (Kindle) file format adapter.
 * Handles Kindle ebook formats (DRM-free only).
 *
 * Supports chapter detection and preview generation.
 */

import type { FileAdapter, AdapterParseResult, PreviewContent } from './types';
import type { ParsedWord, ParsedDocument } from '../text-parser';
import { splitOnDashes, mergeOrphanedPunctuation } from '../text-parser';

/**
 * Chapter info for MOBI files.
 */
interface MobiChapter {
	title: string;
	wordStart: number;
	wordEnd: number;
}

/**
 * Read a PalmDB header from the file.
 */
function readPalmHeader(data: DataView): { name: string; recordCount: number; recordOffsets: number[] } {
	// Name (32 bytes, null-terminated)
	const nameBytes = new Uint8Array(data.buffer, 0, 32);
	let name = '';
	for (const byte of nameBytes) {
		if (byte === 0) break;
		name += String.fromCharCode(byte);
	}

	// Record count at offset 76
	const recordCount = data.getUint16(76, false);

	// Record info list starts at offset 78
	const recordOffsets: number[] = [];
	for (let i = 0; i < recordCount; i++) {
		const offset = data.getUint32(78 + i * 8, false);
		recordOffsets.push(offset);
	}

	return { name, recordCount, recordOffsets };
}

/**
 * Decompress PalmDOC compression (LZ77 variant).
 */
function decompressPalmDoc(compressed: Uint8Array): Uint8Array {
	const output: number[] = [];
	let i = 0;

	while (i < compressed.length) {
		const byte = compressed[i++];

		if (byte === 0) {
			// Literal null byte
			output.push(0);
		} else if (byte >= 1 && byte <= 8) {
			// Copy next 'byte' bytes literally
			for (let j = 0; j < byte && i < compressed.length; j++) {
				output.push(compressed[i++]);
			}
		} else if (byte >= 0x09 && byte <= 0x7f) {
			// Literal byte
			output.push(byte);
		} else if (byte >= 0x80 && byte <= 0xbf) {
			// Distance-length pair
			if (i >= compressed.length) break;
			const next = compressed[i++];
			const distance = ((byte & 0x3f) << 8 | next) >> 3;
			const length = (next & 0x07) + 3;

			for (let j = 0; j < length; j++) {
				const pos = output.length - distance;
				if (pos >= 0) {
					output.push(output[pos]);
				} else {
					output.push(0);
				}
			}
		} else if (byte >= 0xc0) {
			// Space + literal
			output.push(0x20); // space
			output.push(byte ^ 0x80);
		}
	}

	return new Uint8Array(output);
}

/**
 * Escape HTML special characters.
 */
function escapeHtml(text: string): string {
	return text
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

/**
 * Parse MOBI HTML content into structured data with chapters and preview.
 */
function parseMobiContent(html: string, targetWordsPerPage = 250): {
	document: ParsedDocument;
	chapters: MobiChapter[];
	preview: PreviewContent;
} {
	const words: ParsedWord[] = [];
	const paragraphStarts: number[] = [];
	const pageStarts: number[] = [0];
	const chapters: MobiChapter[] = [];
	const chapterStarts: number[] = [];
	const chapterContents: Array<{
		chapterIndex: number;
		htmlWithMarkers: string;
		wordRange: [number, number];
		imageUrls: Map<string, string>;
	}> = [];

	// Parse HTML to extract structure
	const parser = new DOMParser();
	const doc = parser.parseFromString(html, 'text/html');
	const body = doc.body;

	if (!body) {
		return {
			document: {
				words: [],
				paragraphStarts: [],
				pageStarts: [],
				totalWords: 0,
				totalParagraphs: 0,
				totalPages: 0
			},
			chapters: [],
			preview: {
				chapters: [],
				chapterStarts: [],
				chapterContents: []
			}
		};
	}

	// Find chapter boundaries using headings and page breaks
	const chapterElements: Array<{ title: string; element: Element; startIndex: number }> = [];

	// Walk through body to find chapter markers
	function findChapterMarkers(element: Element, depth = 0) {
		for (const child of Array.from(element.children)) {
			const tagName = child.tagName.toLowerCase();

			// Check for headings (chapter titles)
			if (['h1', 'h2', 'h3'].includes(tagName)) {
				const title = child.textContent?.trim() || `Chapter ${chapterElements.length + 1}`;
				chapterElements.push({ title, element: child, startIndex: -1 });
			}
			// Check for Kindle page breaks
			else if (tagName === 'mbp:pagebreak' || child.getAttribute('class')?.includes('pagebreak')) {
				// Page break often precedes a chapter
			}
			// Recurse into containers
			else if (['div', 'section', 'article', 'body'].includes(tagName)) {
				findChapterMarkers(child, depth + 1);
			}
		}
	}

	findChapterMarkers(body);

	// If no chapters found, create a single chapter for the entire content
	if (chapterElements.length === 0) {
		chapterElements.push({ title: 'Content', element: body, startIndex: 0 });
	}

	let wordIndex = 0;
	let paragraphIndex = 0;
	let currentPage = 0;
	let wordsOnCurrentPage = 0;

	// Process content and extract words with chapter tracking
	let currentChapterIndex = 0;
	let currentChapterWordStart = 0;
	let currentChapterHtml: string[] = [];

	// Block-level tags that define paragraphs
	const blockTags = new Set(['p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'blockquote', 'section', 'article']);
	const skipTags = new Set(['script', 'style', 'nav', 'header', 'footer', 'aside']);

	function processNode(node: Node, italic: boolean, bold: boolean): void {
		if (node.nodeType === Node.TEXT_NODE) {
			const text = node.textContent || '';
			if (!text.trim()) return;

			const rawWords = text.split(/\s+/).filter(w => w.length > 0);
			const splitWords = rawWords.flatMap(splitOnDashes);

			// Collect words for this text node for merging
			if (splitWords.length > 0) {
				const mergeResult = mergeOrphanedPunctuation(splitWords);

				let prevMergedIdx = -1;
				for (let rawIdx = 0; rawIdx < splitWords.length; rawIdx++) {
					const mergedIdx = mergeResult.indexMap[rawIdx];

					if (mergedIdx !== prevMergedIdx) {
						const mergedText = mergeResult.words[mergedIdx];

						words.push({
							text: mergedText,
							paragraphIndex,
							pageIndex: currentPage,
							italic: italic || undefined,
							bold: bold || undefined
						});

						// Build HTML with word marker
						let wordHtml = `<span data-word-index="${wordIndex}">${escapeHtml(mergedText)}</span>`;
						if (bold && italic) {
							wordHtml = `<strong><em>${wordHtml}</em></strong>`;
						} else if (bold) {
							wordHtml = `<strong>${wordHtml}</strong>`;
						} else if (italic) {
							wordHtml = `<em>${wordHtml}</em>`;
						}
						currentChapterHtml.push(wordHtml + ' ');

						wordIndex++;
						wordsOnCurrentPage++;
					}
					prevMergedIdx = mergedIdx;
				}
			}
		} else if (node.nodeType === Node.ELEMENT_NODE) {
			const el = node as Element;
			const tagName = el.tagName.toLowerCase();

			// Skip non-content elements
			if (skipTags.has(tagName)) {
				return;
			}

			// Check if this element starts a new chapter
			const chapterMatch = chapterElements.find(c => c.element === el);
			if (chapterMatch && wordIndex > 0) {
				// End current chapter
				if (currentChapterWordStart < wordIndex) {
					chapters.push({
						title: chapters.length > 0 ? chapters[chapters.length - 1].title : 'Start',
						wordStart: currentChapterWordStart,
						wordEnd: wordIndex - 1
					});
					chapterStarts.push(currentChapterWordStart);
					chapterContents.push({
						chapterIndex: currentChapterIndex,
						htmlWithMarkers: currentChapterHtml.join(''),
						wordRange: [currentChapterWordStart, wordIndex - 1],
						imageUrls: new Map()
					});
				}

				// Start new chapter
				currentChapterIndex++;
				currentChapterWordStart = wordIndex;
				currentChapterHtml = [];

				// Start new page for chapter
				if (wordsOnCurrentPage > 0) {
					currentPage++;
					pageStarts.push(wordIndex);
					wordsOnCurrentPage = 0;
				}
			}

			// Track chapter title
			if (chapterMatch) {
				// Update the title for the chapter we're about to fill
				if (chapters.length === currentChapterIndex - 1 || chapters.length === 0) {
					// This title applies to the upcoming content
				}
			}

			// Check for formatting
			const isItalic = italic || tagName === 'i' || tagName === 'em';
			const isBold = bold || tagName === 'b' || tagName === 'strong';

			// Handle block elements
			if (blockTags.has(tagName)) {
				// Start new paragraph
				if (wordIndex > 0 && words.length > 0) {
					// Check for page break
					if (wordsOnCurrentPage >= targetWordsPerPage) {
						currentPage++;
						pageStarts.push(wordIndex);
						wordsOnCurrentPage = 0;
					}
					paragraphIndex++;
				}
				paragraphStarts.push(wordIndex);

				// Add block tag to HTML
				currentChapterHtml.push(`<${tagName}>`);
			}

			// Process children
			for (const child of Array.from(node.childNodes)) {
				processNode(child, isItalic, isBold);
			}

			// Close block elements
			if (blockTags.has(tagName)) {
				currentChapterHtml.push(`</${tagName}>`);
			}
		}
	}

	// Process the body
	for (const child of Array.from(body.childNodes)) {
		processNode(child, false, false);
	}

	// Finalize last chapter
	if (wordIndex > currentChapterWordStart) {
		const lastTitle = chapterElements.length > 0
			? chapterElements[chapterElements.length - 1].title
			: 'Content';
		chapters.push({
			title: lastTitle,
			wordStart: currentChapterWordStart,
			wordEnd: wordIndex - 1
		});
		chapterStarts.push(currentChapterWordStart);
		chapterContents.push({
			chapterIndex: currentChapterIndex,
			htmlWithMarkers: currentChapterHtml.join(''),
			wordRange: [currentChapterWordStart, wordIndex - 1],
			imageUrls: new Map()
		});
	}

	// If still no chapters, create one for all content
	if (chapters.length === 0 && words.length > 0) {
		chapters.push({
			title: 'Content',
			wordStart: 0,
			wordEnd: words.length - 1
		});
		chapterStarts.push(0);
		chapterContents.push({
			chapterIndex: 0,
			htmlWithMarkers: currentChapterHtml.join(''),
			wordRange: [0, words.length - 1],
			imageUrls: new Map()
		});
	}

	return {
		document: {
			words,
			paragraphStarts,
			pageStarts,
			totalWords: words.length,
			totalParagraphs: paragraphStarts.length,
			totalPages: pageStarts.length
		},
		chapters,
		preview: {
			chapters,
			chapterStarts,
			chapterContents
		}
	};
}

/**
 * Parse a MOBI/AZW file.
 */
async function parseMobiFile(file: File): Promise<{
	document: ParsedDocument;
	title?: string;
	chapters: MobiChapter[];
	preview: PreviewContent;
	warnings: string[];
}> {
	const warnings: string[] = [];
	const arrayBuffer = await file.arrayBuffer();
	const data = new DataView(arrayBuffer);

	// Check minimum file size
	if (arrayBuffer.byteLength < 100) {
		throw new Error('Invalid MOBI file: file too small');
	}

	// Read PalmDB header
	const palmHeader = readPalmHeader(data);

	if (palmHeader.recordCount < 2) {
		throw new Error('Invalid MOBI file: not enough records');
	}

	// Read first record (MOBI header)
	const record0Start = palmHeader.recordOffsets[0];

	// Check for MOBI identifier at offset 16 within record 0
	const mobiIdent = new Uint8Array(arrayBuffer, record0Start + 16, 4);
	const mobiIdentStr = String.fromCharCode(...mobiIdent);

	if (mobiIdentStr !== 'MOBI') {
		// Try reading as plain PalmDOC
		warnings.push('File appears to be PalmDOC format, not MOBI');
	}

	// Read compression type (offset 0 in record 0)
	const compression = data.getUint16(record0Start, false);

	// Read encryption type (offset 12 in record 0)
	const encryption = data.getUint16(record0Start + 12, false);

	if (encryption !== 0) {
		throw new Error('This file is DRM-protected. QuickReader can only open DRM-free Kindle files.');
	}

	// Read text record count (offset 8 in record 0)
	const textRecordCount = data.getUint16(record0Start + 8, false);

	// Get full name from MOBI header if available
	let title = palmHeader.name;
	if (mobiIdentStr === 'MOBI') {
		try {
			const fullNameOffset = data.getUint32(record0Start + 84, false);
			const fullNameLength = data.getUint32(record0Start + 88, false);
			if (fullNameLength > 0 && fullNameLength < 1000) {
				const nameBytes = new Uint8Array(arrayBuffer, record0Start + fullNameOffset, fullNameLength);
				let fullName = '';
				for (const byte of nameBytes) {
					if (byte === 0) break;
					fullName += String.fromCharCode(byte);
				}
				if (fullName.trim()) {
					title = fullName.trim();
				}
			}
		} catch {
			// Use palmHeader.name as fallback
		}
	}

	// Extract and decompress text records
	const textParts: string[] = [];
	const decoder = new TextDecoder('utf-8');

	for (let i = 1; i <= textRecordCount && i < palmHeader.recordOffsets.length; i++) {
		const recordStart = palmHeader.recordOffsets[i];
		const recordEnd = i + 1 < palmHeader.recordOffsets.length
			? palmHeader.recordOffsets[i + 1]
			: arrayBuffer.byteLength;

		const recordData = new Uint8Array(arrayBuffer, recordStart, recordEnd - recordStart);

		let textData: Uint8Array;
		if (compression === 1) {
			// No compression
			textData = recordData;
		} else if (compression === 2) {
			// PalmDOC compression
			textData = decompressPalmDoc(recordData);
		} else if (compression === 17480) {
			// HUFF/CDIC compression (not supported)
			throw new Error('HUFF/CDIC compression is not supported. Please convert the file to EPUB using Calibre.');
		} else {
			// Unknown compression
			textData = recordData;
			warnings.push(`Unknown compression type: ${compression}`);
		}

		try {
			textParts.push(decoder.decode(textData));
		} catch {
			// Try Latin-1 as fallback
			let text = '';
			for (const byte of textData) {
				text += String.fromCharCode(byte);
			}
			textParts.push(text);
		}
	}

	const fullText = textParts.join('');

	if (fullText.length === 0) {
		throw new Error('No text content found in MOBI file');
	}

	// Parse the HTML content with chapter detection
	const parsed = parseMobiContent(fullText);

	return {
		document: parsed.document,
		title,
		chapters: parsed.chapters,
		preview: parsed.preview,
		warnings
	};
}

/**
 * Adapter for MOBI/AZW3 files.
 */
export const mobiAdapter: FileAdapter = {
	extensions: ['mobi', 'azw', 'azw3', 'prc'],
	mimeTypes: ['application/x-mobipocket-ebook', 'application/vnd.amazon.ebook'],
	formatName: 'Kindle (MOBI/AZW)',
	supportsPreview: true,

	async parse(file: File): Promise<AdapterParseResult> {
		try {
			const result = await parseMobiFile(file);

			if (result.document.totalWords === 0) {
				return {
					document: result.document,
					title: file.name.replace(/\.(mobi|azw3?|prc)$/i, ''),
					warnings: ['No readable text found. For best results, convert to EPUB using Calibre.'],
					extra: {
						fileType: 'mobi'
					}
				};
			}

			return {
				document: result.document,
				title: result.title || file.name.replace(/\.(mobi|azw3?|prc)$/i, ''),
				warnings: result.warnings,
				preview: result.preview,
				extra: {
					fileType: 'mobi'
				}
			};
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Failed to parse MOBI file';
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
					fileType: 'mobi'
				}
			};
		}
	}
};
