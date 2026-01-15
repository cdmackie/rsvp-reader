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
import { mergeOrphanedPunctuation } from '../text-parser';

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
 * Applies common post-processing (orphaned punctuation merging) to all parsed documents.
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
	if (result.document?.pageStarts?.length > 1 && result.document?.words?.length > 0) {
		const minWordsPerPage = 20;
		const pageStarts = result.document.pageStarts;
		const words = result.document.words;
		const totalWords = words.length;

		// Calculate which pages to merge
		const newPageStarts: number[] = [0];
		let currentMergedWordCount = 0;

		for (let pageIdx = 0; pageIdx < pageStarts.length; pageIdx++) {
			const pageStart = pageStarts[pageIdx];
			const pageEnd = pageIdx + 1 < pageStarts.length ? pageStarts[pageIdx + 1] - 1 : totalWords - 1;

			// Count non-empty words on this page
			let nonEmptyCount = 0;
			for (let i = pageStart; i <= pageEnd; i++) {
				if (words[i]?.text?.trim()) nonEmptyCount++;
			}

			currentMergedWordCount += nonEmptyCount;

			// If we've accumulated enough words, this marks the end of a merged page
			// Start a new merged page at the next original page boundary
			if (currentMergedWordCount >= minWordsPerPage && pageIdx + 1 < pageStarts.length) {
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

	// Post-process: merge orphaned punctuation in words array
	// This handles cases like "the end ." → "end." and "( text )" → "(text" "text)"
	if (result.document?.words?.length > 0) {
		const wordTexts = result.document.words.map(w => w.text);
		const mergedTexts = mergeOrphanedPunctuation(wordTexts);

		// If merging changed the count, rebuild the words array and update preview HTML
		if (mergedTexts.length !== wordTexts.length) {
			const newWords: typeof result.document.words = [];
			// Map from old word index to new word index (or -1 if merged away)
			const indexMap: number[] = new Array(wordTexts.length).fill(-1);
			let srcIdx = 0;
			let newIdx = 0;

			for (const mergedText of mergedTexts) {
				// Copy properties from source word, update text
				const srcWord = result.document.words[srcIdx];
				newWords.push({
					...srcWord,
					text: mergedText
				});

				// Map this source index to new index
				indexMap[srcIdx] = newIdx;

				// Skip source words that were merged
				// Check if consecutive source words concatenate to form the merged word
				let consumed = 1;
				let concat = wordTexts[srcIdx];
				while (srcIdx + consumed < wordTexts.length && consumed < 4) {
					const nextConcat = concat + wordTexts[srcIdx + consumed];
					if (nextConcat === mergedText) {
						// Found the exact concatenation - mark all these as merged
						for (let j = 1; j <= consumed; j++) {
							indexMap[srcIdx + j] = newIdx;
						}
						consumed++;
						break;
					} else if (mergedText.startsWith(nextConcat)) {
						// Still building up to the merged word
						concat = nextConcat;
						indexMap[srcIdx + consumed] = newIdx;
						consumed++;
					} else {
						// Doesn't match, stop here
						break;
					}
				}
				srcIdx += consumed;
				newIdx++;
			}

			result.document.words = newWords;
			result.document.totalWords = newWords.length;

			// Update preview HTML if present
			if (result.preview?.chapterContents) {
				result.preview.chapterContents = result.preview.chapterContents.map(chapter => {
					// Update word indices in HTML and merge adjacent spans that now have the same index
					let html = chapter.htmlWithMarkers;

					// Replace data-word-index values with new indices
					html = html.replace(/data-word-index="(\d+)"/g, (match, oldIdx) => {
						const oldIndex = parseInt(oldIdx, 10);
						const newIndex = indexMap[oldIndex];
						if (newIndex !== undefined && newIndex >= 0) {
							return `data-word-index="${newIndex}"`;
						}
						return match;
					});

					// Merge adjacent spans with the same data-word-index
					// Pattern: </span> followed by whitespace/text then <span with same index
					// We need to combine: <span data-word-index="5">word1</span> <span data-word-index="5">:</span>
					// Into: <span data-word-index="5">word1:</span>
					let prevHtml = '';
					while (prevHtml !== html) {
						prevHtml = html;
						html = html.replace(
							/<span data-word-index="(\d+)"[^>]*>([^<]*)<\/span>(\s*)<span data-word-index="\1"[^>]*>([^<]*)<\/span>/g,
							'<span data-word-index="$1">$2$4</span>'
						);
					}

					// Update word range
					const [startOld, endOld] = chapter.wordRange;
					const startNew = indexMap[startOld] ?? 0;
					// Find the last valid mapped index for the end
					let endNew = startNew;
					for (let i = endOld; i >= startOld; i--) {
						if (indexMap[i] !== undefined && indexMap[i] >= 0) {
							endNew = indexMap[i];
							break;
						}
					}

					return {
						...chapter,
						htmlWithMarkers: html,
						wordRange: [startNew, endNew] as [number, number]
					};
				});

				// Update chapter starts if present
				if (result.preview.chapterStarts) {
					result.preview.chapterStarts = result.preview.chapterStarts.map(oldIdx => {
						const newIndex = indexMap[oldIdx];
						return newIndex !== undefined && newIndex >= 0 ? newIndex : oldIdx;
					});
				}

				// Update chapters wordStart/wordEnd if present
				// These are used for chapter navigation
				if (result.preview.chapters) {
					result.preview.chapters = result.preview.chapters.map(chapter => {
						const newStart = indexMap[chapter.wordStart];
						// Find the last valid mapped index for wordEnd
						let newEnd = newStart ?? chapter.wordStart;
						for (let i = chapter.wordEnd; i >= chapter.wordStart; i--) {
							if (indexMap[i] !== undefined && indexMap[i] >= 0) {
								newEnd = indexMap[i];
								break;
							}
						}
						return {
							...chapter,
							wordStart: newStart !== undefined && newStart >= 0 ? newStart : chapter.wordStart,
							wordEnd: newEnd
						};
					});
				}
			}
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
