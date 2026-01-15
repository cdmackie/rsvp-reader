/**
 * MOBI/AZW3 (Kindle) file format adapter.
 * Handles Kindle ebook formats (DRM-free only).
 *
 * Note: MOBI/AZW3 parsing is complex. This adapter provides basic support.
 * For best results, consider converting to EPUB using Calibre.
 */

import type { FileAdapter, AdapterParseResult } from './types';
import type { ParsedWord, ParsedDocument } from '../text-parser';
import { splitOnDashes } from '../text-parser';

/**
 * MOBI file header structure.
 */
interface MobiHeader {
	name: string;
	compression: number;
	textRecordCount: number;
	recordSize: number;
	encryptionType: number;
	mobiType: number;
	encoding: number;
	firstContentRecord: number;
	firstNonBookRecord: number;
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
 * Parse MOBI text content.
 */
function parseMobiText(text: string, targetWordsPerPage = 250): ParsedDocument {
	const words: ParsedWord[] = [];
	const paragraphStarts: number[] = [];
	const pageStarts: number[] = [0];

	// Remove HTML tags but preserve structure
	let cleanText = text
		.replace(/<br\s*\/?>/gi, '\n')
		.replace(/<\/p>/gi, '\n\n')
		.replace(/<\/div>/gi, '\n\n')
		.replace(/<\/h[1-6]>/gi, '\n\n')
		.replace(/<[^>]+>/g, '')
		.replace(/&nbsp;/g, ' ')
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#(\d+);/g, (_, code) => String.fromCharCode(parseInt(code, 10)));

	// Split into paragraphs
	const paragraphs = cleanText.split(/\n\s*\n/).filter(p => p.trim().length > 0);

	let wordIndex = 0;
	let currentPage = 0;
	let wordsOnCurrentPage = 0;

	paragraphs.forEach((paragraph, paragraphIndex) => {
		paragraphStarts.push(wordIndex);

		const rawWords = paragraph.trim().split(/\s+/).filter(w => w.length > 0);
		const splitWords = rawWords.flatMap(splitOnDashes);

		for (const wordText of splitWords) {
			words.push({
				text: wordText,
				paragraphIndex,
				pageIndex: currentPage
			});

			wordIndex++;
			wordsOnCurrentPage++;
		}

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
 * Parse a MOBI/AZW file.
 */
async function parseMobiFile(file: File): Promise<{ document: ParsedDocument; title?: string; warnings: string[] }> {
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
	const record0End = palmHeader.recordOffsets[1];

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

	const document = parseMobiText(fullText);

	return { document, title, warnings };
}

/**
 * Adapter for MOBI/AZW3 files.
 */
export const mobiAdapter: FileAdapter = {
	extensions: ['mobi', 'azw', 'azw3', 'prc'],
	mimeTypes: ['application/x-mobipocket-ebook', 'application/vnd.amazon.ebook'],
	formatName: 'Kindle (MOBI/AZW)',
	supportsPreview: false,

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
