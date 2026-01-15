/**
 * RTF (Rich Text Format) file format adapter.
 * Parses RTF files by extracting text content.
 */

import type { FileAdapter, AdapterParseResult } from './types';
import type { ParsedWord, ParsedDocument } from '../text-parser';
import { splitOnDashes } from '../text-parser';

/**
 * Simple RTF to plain text converter.
 * Handles basic RTF syntax - control words, groups, and text.
 */
function rtfToText(rtf: string): { text: string; italic: boolean[]; bold: boolean[] } {
	const textParts: string[] = [];
	const italicMarks: boolean[] = [];
	const boldMarks: boolean[] = [];

	let i = 0;
	let currentItalic = false;
	let currentBold = false;
	let inGroup = 0;
	let skipGroup = false;

	// Skip groups for these destinations
	const skipDestinations = new Set(['fonttbl', 'colortbl', 'stylesheet', 'info', 'pict', 'object', 'datafield', 'themedata', 'colorschememapping']);

	while (i < rtf.length) {
		const char = rtf[i];

		if (char === '{') {
			inGroup++;
			i++;
			continue;
		}

		if (char === '}') {
			inGroup--;
			if (skipGroup && inGroup === 0) {
				skipGroup = false;
			}
			i++;
			continue;
		}

		if (skipGroup) {
			i++;
			continue;
		}

		if (char === '\\') {
			// Control word or symbol
			i++;
			if (i >= rtf.length) break;

			const nextChar = rtf[i];

			// Escaped characters
			if (nextChar === '\\' || nextChar === '{' || nextChar === '}') {
				textParts.push(nextChar);
				italicMarks.push(currentItalic);
				boldMarks.push(currentBold);
				i++;
				continue;
			}

			// Line breaks
			if (nextChar === '\n' || nextChar === '\r') {
				i++;
				continue;
			}

			// Control word
			let controlWord = '';
			while (i < rtf.length && /[a-zA-Z]/.test(rtf[i])) {
				controlWord += rtf[i];
				i++;
			}

			// Optional numeric parameter
			let param = '';
			if (i < rtf.length && (rtf[i] === '-' || /[0-9]/.test(rtf[i]))) {
				if (rtf[i] === '-') {
					param += rtf[i];
					i++;
				}
				while (i < rtf.length && /[0-9]/.test(rtf[i])) {
					param += rtf[i];
					i++;
				}
			}

			// Optional space delimiter
			if (i < rtf.length && rtf[i] === ' ') {
				i++;
			}

			// Process control word
			switch (controlWord) {
				case 'par':
				case 'line':
					textParts.push('\n\n');
					italicMarks.push(false);
					boldMarks.push(false);
					break;
				case 'tab':
					textParts.push(' ');
					italicMarks.push(currentItalic);
					boldMarks.push(currentBold);
					break;
				case 'i':
					currentItalic = param !== '0';
					break;
				case 'b':
					currentBold = param !== '0';
					break;
				case 'plain':
					currentItalic = false;
					currentBold = false;
					break;
				case 'u':
					// Unicode character
					if (param) {
						const code = parseInt(param, 10);
						if (code >= 0) {
							textParts.push(String.fromCharCode(code));
							italicMarks.push(currentItalic);
							boldMarks.push(currentBold);
						}
					}
					// Skip replacement character
					if (i < rtf.length && rtf[i] === '?') {
						i++;
					}
					break;
				case 'emdash':
					textParts.push('—');
					italicMarks.push(currentItalic);
					boldMarks.push(currentBold);
					break;
				case 'endash':
					textParts.push('–');
					italicMarks.push(currentItalic);
					boldMarks.push(currentBold);
					break;
				case 'ldblquote':
					textParts.push('"');
					italicMarks.push(currentItalic);
					boldMarks.push(currentBold);
					break;
				case 'rdblquote':
					textParts.push('"');
					italicMarks.push(currentItalic);
					boldMarks.push(currentBold);
					break;
				case 'lquote':
					textParts.push('\u2018');
					italicMarks.push(currentItalic);
					boldMarks.push(currentBold);
					break;
				case 'rquote':
					textParts.push('\u2019');
					italicMarks.push(currentItalic);
					boldMarks.push(currentBold);
					break;
				default:
					// Check if this is a destination to skip
					if (skipDestinations.has(controlWord)) {
						skipGroup = true;
					}
					break;
			}

			continue;
		}

		// Regular text
		if (char !== '\r' && char !== '\n') {
			textParts.push(char);
			italicMarks.push(currentItalic);
			boldMarks.push(currentBold);
		}
		i++;
	}

	return {
		text: textParts.join(''),
		italic: italicMarks,
		bold: boldMarks
	};
}

/**
 * Parse RTF text into words with formatting.
 */
function parseRtfText(rtfResult: { text: string; italic: boolean[]; bold: boolean[] }, targetWordsPerPage = 250): ParsedDocument {
	const words: ParsedWord[] = [];
	const paragraphStarts: number[] = [];
	const pageStarts: number[] = [0];

	const { text, italic, bold } = rtfResult;

	// Split into paragraphs
	const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);

	let wordIndex = 0;
	let charIndex = 0;
	let currentPage = 0;
	let wordsOnCurrentPage = 0;

	paragraphs.forEach((paragraph, paragraphIndex) => {
		paragraphStarts.push(wordIndex);

		const rawWords = paragraph.trim().split(/\s+/).filter(w => w.length > 0);
		const splitWords = rawWords.flatMap(splitOnDashes);

		for (const wordText of splitWords) {
			// Find the character position for formatting
			const wordStart = text.indexOf(wordText, charIndex);
			charIndex = wordStart + wordText.length;

			// Check formatting at word start
			const isItalic = wordStart >= 0 && wordStart < italic.length ? italic[wordStart] : false;
			const isBold = wordStart >= 0 && wordStart < bold.length ? bold[wordStart] : false;

			words.push({
				text: wordText,
				paragraphIndex,
				pageIndex: currentPage,
				italic: isItalic || undefined,
				bold: isBold || undefined
			});

			wordIndex++;
			wordsOnCurrentPage++;
		}

		// Check for page break after paragraph
		if (wordsOnCurrentPage >= targetWordsPerPage && paragraphIndex < paragraphs.length - 1) {
			currentPage++;
			pageStarts.push(wordIndex);
			wordsOnCurrentPage = 0;
		}
	});

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
 * Adapter for RTF files.
 */
export const rtfAdapter: FileAdapter = {
	extensions: ['rtf'],
	mimeTypes: ['application/rtf', 'text/rtf'],
	formatName: 'Rich Text Format (RTF)',
	supportsPreview: false,

	async parse(file: File): Promise<AdapterParseResult> {
		try {
			const rtf = await file.text();

			// Verify it's an RTF file
			if (!rtf.startsWith('{\\rtf')) {
				throw new Error('Invalid RTF file: missing RTF header');
			}

			const rtfResult = rtfToText(rtf);
			const parsed = parseRtfText(rtfResult);

			// Extract title from filename
			const title = file.name.replace(/\.rtf$/i, '');

			return {
				document: parsed,
				title,
				warnings: [],
				extra: {
					fileType: 'rtf'
				}
			};
		} catch (error) {
			const message = error instanceof Error ? error.message : 'Failed to parse RTF file';
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
					fileType: 'rtf'
				}
			};
		}
	}
};
