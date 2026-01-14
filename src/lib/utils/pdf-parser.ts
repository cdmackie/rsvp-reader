import type { ParsedDocument, ParsedWord } from './text-parser';
import { splitOnDashes } from './text-parser';

// Types from pdfjs-dist - we import them separately to avoid SSR issues
type TextItem = {
	str: string;
	transform: number[];
};

type TextMarkedContent = {
	type: string;
};

/**
 * PDF bookmark/outline item.
 */
export interface PdfOutlineItem {
	title: string;
	pageIndex: number;
	wordIndex: number;
}

/**
 * Content for a single PDF page (for preview panel).
 */
export interface PdfPageContent {
	pageIndex: number;
	htmlWithMarkers: string;
	wordRange: [number, number];
}

/**
 * Parsed PDF document with text, structure, and preview content.
 */
export interface ParsedPdf extends ParsedDocument {
	title?: string;
	author?: string;
	outline?: PdfOutlineItem[];
	chapterStarts?: number[];
	pageContents?: PdfPageContent[];
	parseWarnings: string[];
}

/**
 * Result from parsing, includes the PDF document for rendering.
 */
export interface ParsePdfResult {
	parsed: ParsedPdf;
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	pdfDocument: any; // PDFDocumentProxy from pdf.js
}

/**
 * Helper to escape HTML special characters.
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
 * Check if a text content item is a TextItem (has str property).
 */
function isTextItem(item: TextItem | TextMarkedContent): item is TextItem {
	return 'str' in item;
}

/**
 * Parse a PDF file and extract words, pages, and preview content.
 * Returns both the parsed data and the PDF document reference for rendering.
 */
export async function parsePdf(file: File): Promise<ParsePdfResult> {
	const parseWarnings: string[] = [];
	const words: ParsedWord[] = [];
	const paragraphStarts: number[] = [];
	const pageStarts: number[] = [];
	const pageContents: PdfPageContent[] = [];

	try {
		// Dynamically import pdfjs-dist to avoid SSR issues
		// pdf.js uses browser APIs (DOMMatrix, etc.) that don't exist in Node.js
		const pdfjsLib = await import('pdfjs-dist');

		// Configure pdf.js worker - use CDN for the worker script
		pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://unpkg.com/pdfjs-dist@5.4.530/build/pdf.worker.min.mjs';

		// Load PDF from file
		const arrayBuffer = await file.arrayBuffer();
		const loadingTask = pdfjsLib.getDocument({
			data: arrayBuffer,
			// Use CDN for standard fonts to avoid missing font warnings
			standardFontDataUrl: 'https://unpkg.com/pdfjs-dist@5.4.530/standard_fonts/',
			// Disable font rendering for better text extraction
			disableFontFace: true
		});
		const pdf = await loadingTask.promise;

		// Extract metadata
		let title: string | undefined;
		let author: string | undefined;

		try {
			const metadata = await pdf.getMetadata();
			if (metadata.info) {
				const info = metadata.info as Record<string, unknown>;
				title = typeof info.Title === 'string' ? info.Title : undefined;
				author = typeof info.Author === 'string' ? info.Author : undefined;
			}
		} catch {
			// Metadata extraction failed, continue without it
		}

		// Extract outline/bookmarks for chapter navigation
		let outline: PdfOutlineItem[] = [];
		const outlineItems: Array<{ title: string; pageIndex: number }> = [];

		try {
			const pdfOutline = await pdf.getOutline();
			if (pdfOutline && pdfOutline.length > 0) {
				for (const item of pdfOutline) {
					if (item.dest) {
						try {
							// Resolve destination to page number
							let pageIndex: number | null = null;

							if (typeof item.dest === 'string') {
								const dest = await pdf.getDestination(item.dest);
								if (dest) {
									const ref = dest[0];
									pageIndex = await pdf.getPageIndex(ref);
								}
							} else if (Array.isArray(item.dest)) {
								const ref = item.dest[0];
								pageIndex = await pdf.getPageIndex(ref);
							}

							if (pageIndex !== null) {
								outlineItems.push({
									title: item.title,
									pageIndex
								});
							}
						} catch {
							// Skip this outline item if we can't resolve it
						}
					}
				}
			}
		} catch {
			// Outline extraction failed, continue without it
		}

		let wordIndex = 0;
		let paragraphIndex = 0;
		let lastY: number | null = null;
		const LINE_HEIGHT_THRESHOLD = 5; // Pixels difference to detect new line
		const PARAGRAPH_GAP_THRESHOLD = 15; // Pixels gap to detect new paragraph

		// Process each page
		for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
			const page = await pdf.getPage(pageNum);
			const textContent = await page.getTextContent();

			// Mark page start
			pageStarts.push(wordIndex);
			const pageStartWordIndex = wordIndex;

			// Track words for this page's preview HTML
			const pageWords: Array<{ word: ParsedWord; globalIndex: number }> = [];

			// Each new page starts a new paragraph
			paragraphStarts.push(wordIndex);
			paragraphIndex++;
			lastY = null;

			for (const item of textContent.items) {
				if (!isTextItem(item) || !item.str.trim()) continue;

				// Check for paragraph break based on Y position change
				const currentY = item.transform[5]; // Y position from transform matrix

				if (lastY !== null) {
					const yDiff = Math.abs(lastY - currentY);

					// Significant Y gap indicates a new paragraph
					if (yDiff > PARAGRAPH_GAP_THRESHOLD) {
						paragraphStarts.push(wordIndex);
						paragraphIndex++;
					}
				}

				lastY = currentY;

				// Split text into words
				const rawWords = item.str.trim().split(/\s+/).filter(w => w.length > 0);

				for (const rawWord of rawWords) {
					// Apply dash splitting (same as EPUB/text)
					const parts = splitOnDashes(rawWord);

					for (const part of parts) {
						if (!part.trim()) continue;

						const parsedWord: ParsedWord = {
							text: part,
							paragraphIndex,
							pageIndex: pageNum - 1
						};

						words.push(parsedWord);
						pageWords.push({ word: parsedWord, globalIndex: wordIndex });
						wordIndex++;
					}
				}
			}

			// Generate preview HTML for this page
			const pageEndWordIndex = wordIndex - 1;

			if (pageWords.length > 0) {
				const html = generatePageHtml(pageWords);
				pageContents.push({
					pageIndex: pageNum - 1,
					htmlWithMarkers: html,
					wordRange: [pageStartWordIndex, pageEndWordIndex]
				});
			}
		}

		// Map outline items to word indices
		if (outlineItems.length > 0) {
			outline = outlineItems.map(item => ({
				title: item.title,
				pageIndex: item.pageIndex,
				wordIndex: pageStarts[item.pageIndex] ?? 0
			}));
		}

		// Check for scanned/image-only PDFs
		if (words.length === 0) {
			parseWarnings.push(
				'This PDF appears to be scanned or has no extractable text. ' +
				'RSVP reading requires text-based PDFs.'
			);
		} else if (words.length < 10) {
			parseWarnings.push(
				'This PDF has very little extractable text. ' +
				'It may be mostly images or scanned content.'
			);
		}

		return {
			parsed: {
				words,
				paragraphStarts,
				pageStarts,
				totalWords: words.length,
				totalParagraphs: paragraphStarts.length,
				totalPages: pdf.numPages,
				title,
				author,
				outline: outline.length > 0 ? outline : undefined,
				chapterStarts: outline.length > 0 ? outline.map(o => o.wordIndex) : undefined,
				pageContents,
				parseWarnings
			},
			pdfDocument: pdf
		};
	} catch (error) {
		// Handle various PDF errors
		const errorMessage = error instanceof Error ? error.message : 'Unknown error';

		if (errorMessage.includes('password')) {
			parseWarnings.push('This PDF is password-protected and cannot be opened.');
		} else if (errorMessage.includes('Invalid PDF')) {
			parseWarnings.push('This file does not appear to be a valid PDF.');
		} else {
			parseWarnings.push(`Failed to parse PDF: ${errorMessage}`);
		}

		return {
			parsed: {
				words: [],
				paragraphStarts: [],
				pageStarts: [],
				totalWords: 0,
				totalParagraphs: 0,
				totalPages: 0,
				pageContents: [],
				parseWarnings
			},
			pdfDocument: null
		};
	}
}

/**
 * Generate HTML with word markers for the preview panel.
 */
function generatePageHtml(pageWords: Array<{ word: ParsedWord; globalIndex: number }>): string {
	let html = '<div class="pdf-page">';
	let currentParagraph = -1;

	for (const { word, globalIndex } of pageWords) {
		// Start new paragraph if needed
		if (word.paragraphIndex !== currentParagraph) {
			if (currentParagraph !== -1) {
				html += '</p>';
			}
			html += '<p>';
			currentParagraph = word.paragraphIndex;
		}

		html += `<span data-word-index="${globalIndex}">${escapeHtml(word.text)}</span> `;
	}

	// Close last paragraph
	if (currentParagraph !== -1) {
		html += '</p>';
	}

	html += '</div>';
	return html;
}
