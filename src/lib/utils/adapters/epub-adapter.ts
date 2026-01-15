/**
 * EPUB file format adapter.
 * Wraps the existing epub-parser for the adapter interface.
 */

import type { FileAdapter, AdapterParseResult } from './types';
import { parseEpub, type ParsedEpubWithContent } from '../epub-parser';

/**
 * Adapter for EPUB ebook files.
 */
export const epubAdapter: FileAdapter = {
	extensions: ['epub'],
	mimeTypes: ['application/epub+zip'],
	formatName: 'EPUB',
	supportsPreview: true,

	async parse(file: File): Promise<AdapterParseResult> {
		const parsed: ParsedEpubWithContent = await parseEpub(file);

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
			preview: {
				chapterContents: parsed.chapterContents,
				chapters: parsed.chapters,
				chapterStarts: parsed.chapterStarts
			},
			warnings: parsed.parseWarnings || [],
			extra: {
				fileType: 'epub'
			}
		};
	}
};
