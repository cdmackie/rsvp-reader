/**
 * File format adapters for QuickReader.
 *
 * This module exports all available file format adapters and
 * provides a pre-configured registry with all adapters registered.
 */

// Export types
export type { FileAdapter, AdapterParseResult, PreviewContent } from './types';
export { canAdapterHandle } from './types';

// Export registry
export { registry } from './registry';

// Export individual adapters
export { epubAdapter } from './epub-adapter';
export { pdfAdapter } from './pdf-adapter';
export { textAdapter } from './text-adapter';
export { htmlAdapter } from './html-adapter';
export { markdownAdapter } from './markdown-adapter';
export { fb2Adapter } from './fb2-adapter';
export { docxAdapter } from './docx-adapter';
export { rtfAdapter } from './rtf-adapter';
export { odtAdapter } from './odt-adapter';
export { mobiAdapter } from './mobi-adapter';

// Import registry for registration
import { registry } from './registry';

// Import all adapters
import { epubAdapter } from './epub-adapter';
import { pdfAdapter } from './pdf-adapter';
import { textAdapter } from './text-adapter';
import { htmlAdapter } from './html-adapter';
import { markdownAdapter } from './markdown-adapter';
import { fb2Adapter } from './fb2-adapter';
import { docxAdapter } from './docx-adapter';
import { rtfAdapter } from './rtf-adapter';
import { odtAdapter } from './odt-adapter';
import { mobiAdapter } from './mobi-adapter';

// Register all adapters
// Order matters - first match wins for MIME type conflicts
registry.register(epubAdapter);
registry.register(pdfAdapter);
registry.register(textAdapter);
registry.register(htmlAdapter);
registry.register(markdownAdapter);
registry.register(fb2Adapter);
registry.register(docxAdapter);
registry.register(rtfAdapter);
registry.register(odtAdapter);
registry.register(mobiAdapter);

/**
 * Parse a file using the appropriate adapter.
 * Applies common post-processing (tiny page merging) to all parsed documents.
 * @param file The file to parse
 * @returns Promise with the parse result, or throws if no adapter found
 */
export async function parseFile(file: File) {
	const adapter = registry.getAdapterForFile(file);

	if (!adapter) {
		const extension = file.name.split('.').pop()?.toLowerCase() || 'unknown';
		throw new Error(
			`Unsupported file type: .${extension}\n\n` +
			`Supported formats: ${registry.getSupportedExtensions().map(e => `.${e}`).join(', ')}`
		);
	}

	const result = await adapter.parse(file);

	// Post-process: merge tiny pages (< 20 words of actual text)
	// This prevents spine items like just "Prologue" or "I" from getting their own page
	// But preserves pages for image-only chapters and chapter boundaries
	if (result.document?.pageStarts?.length > 1 && result.document?.words?.length > 0) {
		const minWordsPerPage = 20;
		const pageStarts = result.document.pageStarts;
		const words = result.document.words;
		const totalWords = words.length;

		// Get chapter start word indices to preserve as page boundaries
		const chapterStartWords = new Set<number>();
		if (result.preview?.chapters) {
			for (const chapter of result.preview.chapters) {
				chapterStartWords.add(chapter.wordStart);
			}
		}

		// Calculate which pages to merge
		const newPageStarts: number[] = [0];
		let currentMergedWordCount = 0;

		for (let pageIdx = 0; pageIdx < pageStarts.length; pageIdx++) {
			const pageStart = pageStarts[pageIdx];
			const pageEnd = pageIdx + 1 < pageStarts.length ? pageStarts[pageIdx + 1] - 1 : totalWords - 1;

			// Count non-empty words on this page
			let nonEmptyCount = 0;
			let hasEmptyPlaceholder = false;
			for (let i = pageStart; i <= pageEnd; i++) {
				if (words[i]?.text?.trim()) {
					nonEmptyCount++;
				} else if (words[i]?.text === '') {
					// Empty text indicates an image-only placeholder
					hasEmptyPlaceholder = true;
				}
			}

			currentMergedWordCount += nonEmptyCount;

			// Check if the NEXT page starts a new chapter - if so, force a break here
			const nextPageStart = pageIdx + 1 < pageStarts.length ? pageStarts[pageIdx + 1] : null;
			const nextPageIsChapterStart = nextPageStart !== null && chapterStartWords.has(nextPageStart);

			// Create a page break if:
			// 1. We've accumulated enough words, OR
			// 2. This page has image placeholders only, OR
			// 3. The next page starts a new chapter (preserve chapter boundaries)
			const shouldBreak = currentMergedWordCount >= minWordsPerPage ||
				(hasEmptyPlaceholder && nonEmptyCount === 0) ||
				nextPageIsChapterStart;

			if (shouldBreak && pageIdx + 1 < pageStarts.length) {
				newPageStarts.push(pageStarts[pageIdx + 1]);
				currentMergedWordCount = 0;
			}
		}

		// Only update if we actually merged some pages
		if (newPageStarts.length < pageStarts.length) {
			// Update pageIndex on all words
			for (let i = 0; i < words.length; i++) {
				// Find which new page this word belongs to
				let newPageIdx = 0;
				for (let p = newPageStarts.length - 1; p >= 0; p--) {
					if (i >= newPageStarts[p]) {
						newPageIdx = p;
						break;
					}
				}
				words[i].pageIndex = newPageIdx;
			}

			result.document.pageStarts = newPageStarts;
			result.document.totalPages = newPageStarts.length;
		}
	}

	return result;
}

/**
 * Check if a file is supported.
 * @param file The file to check
 * @returns True if the file type is supported
 */
export function isFileSupported(file: File): boolean {
	return registry.getAdapterForFile(file) !== null;
}

/**
 * Get the accept string for file inputs.
 * @returns Accept string like ".epub,.pdf,.txt"
 */
export function getAcceptString(): string {
	return registry.getAcceptString();
}

/**
 * Get human-readable list of supported formats.
 * @returns Array of format descriptions
 */
export function getSupportedFormats(): { name: string; extensions: string[] }[] {
	return registry.getAdapters().map(adapter => ({
		name: adapter.formatName,
		extensions: adapter.extensions
	}));
}
