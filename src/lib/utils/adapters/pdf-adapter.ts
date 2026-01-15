/**
 * PDF file format adapter.
 * Wraps the existing pdf-parser for the adapter interface.
 */

import type { FileAdapter, AdapterParseResult } from './types';
import type { ChapterContent, ChapterInfo } from '../epub-parser';

/**
 * Adapter for PDF document files.
 * Uses dynamic import to avoid SSR issues with pdf.js.
 */
export const pdfAdapter: FileAdapter = {
	extensions: ['pdf'],
	mimeTypes: ['application/pdf'],
	formatName: 'PDF',
	supportsPreview: true,

	async parse(file: File): Promise<AdapterParseResult> {
		// Dynamic import to avoid SSR issues (pdf.js uses browser APIs)
		const { parsePdf } = await import('../pdf-parser');
		const result = await parsePdf(file);
		const parsed = result.parsed;

		// Convert PDF page contents to ChapterContent format
		const chapterContents: ChapterContent[] = (parsed.pageContents || []).map(pc => ({
			chapterIndex: pc.pageIndex,
			htmlWithMarkers: pc.htmlWithMarkers,
			wordRange: pc.wordRange,
			imageUrls: new Map()
		}));

		// Convert PDF outline to ChapterInfo format
		const chapters: ChapterInfo[] = (parsed.outline || []).map(o => ({
			title: o.title,
			href: `#page-${o.pageIndex}`
		}));

		return {
			document: {
				words: parsed.words,
				paragraphStarts: parsed.paragraphStarts,
				pageStarts: parsed.pageStarts,
				totalWords: parsed.totalWords,
				totalParagraphs: parsed.totalParagraphs,
				totalPages: parsed.totalPages
			},
			title: parsed.title,
			author: parsed.author,
			preview: chapterContents.length > 0 ? {
				chapterContents,
				chapters,
				chapterStarts: parsed.chapterStarts || parsed.pageStarts
			} : undefined,
			warnings: parsed.parseWarnings || [],
			extra: {
				fileType: 'pdf',
				pdfDocument: result.pdfDocument
			}
		};
	}
};
