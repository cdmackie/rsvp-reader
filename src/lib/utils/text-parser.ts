/**
 * Represents a parsed word with its position and formatting information.
 */
export interface ParsedWord {
	text: string;
	paragraphIndex: number;
	pageIndex: number;
	italic?: boolean;
	bold?: boolean;
}

/**
 * Represents a parsed document with words and structural information.
 */
export interface ParsedDocument {
	words: ParsedWord[];
	paragraphStarts: number[]; // Word indices where paragraphs start
	pageStarts: number[]; // Word indices where pages start
	totalWords: number;
	totalParagraphs: number;
	totalPages: number;
}

/**
 * Result of merging orphaned punctuation.
 * Includes the merged words and a mapping from original indices to merged indices.
 */
export interface MergeResult {
	words: string[];
	/** Maps each original word index to its merged word index */
	indexMap: number[];
}

/**
 * Merge orphaned punctuation with adjacent words.
 * "the end ." becomes ["the", "end."]
 * "( some text )" becomes ["(some", "text)"]
 * "here ( something ), there" becomes ["here", "(something),", "there"]
 *
 * Returns both the merged words and an index map for tracking original positions.
 */
export function mergeOrphanedPunctuation(words: string[]): MergeResult {
	if (words.length === 0) return { words: [], indexMap: [] };

	const result: string[] = [];
	const indexMap: number[] = new Array(words.length);
	const leadingPunctuation = /^[(\[{"\u201C\u2018]+$/;  // Opening brackets/quotes
	const trailingPunctuation = /^[)\]}"'\u201D\u2019.,;:!?]+$/;  // Closing brackets/quotes/punctuation

	let i = 0;
	while (i < words.length) {
		const word = words[i];
		const resultIndex = result.length;

		// Check if this is leading punctuation that should attach to next word
		if (leadingPunctuation.test(word) && i + 1 < words.length) {
			// Attach to next word
			let merged = word + words[i + 1];
			indexMap[i] = resultIndex;
			indexMap[i + 1] = resultIndex;
			i += 2;

			// Also check if there's trailing punctuation after that should attach
			while (i < words.length && trailingPunctuation.test(words[i])) {
				merged += words[i];
				indexMap[i] = resultIndex;
				i++;
			}

			result.push(merged);
			continue;
		}

		// Check if next word is trailing punctuation that should attach to this word
		if (i + 1 < words.length && trailingPunctuation.test(words[i + 1])) {
			// Attach all consecutive trailing punctuation to this word
			let merged = word;
			indexMap[i] = resultIndex;
			i++;
			while (i < words.length && trailingPunctuation.test(words[i])) {
				merged += words[i];
				indexMap[i] = resultIndex;
				i++;
			}
			result.push(merged);
			continue;
		}

		// Standalone punctuation that couldn't be merged - still include it
		indexMap[i] = resultIndex;
		result.push(word);
		i++;
	}

	return { words: result, indexMap };
}

/**
 * Simple version that just returns merged words (for backward compatibility).
 */
export function mergeOrphanedPunctuationSimple(words: string[]): string[] {
	return mergeOrphanedPunctuation(words).words;
}

/**
 * Split a word on em-dashes, en-dashes, ellipsis, and long hyphenated compounds.
 * "consciousness—seemed" becomes ["consciousness—", "seemed"]
 * "delusion…created" becomes ["delusion…", "created"]
 * "forty-nine-year-old" (3+ hyphens) becomes ["forty-", "nine-", "year-", "old"]
 * "forty-nine" (2 parts) stays as "forty-nine"
 */
export function splitOnDashes(word: string): string[] {
	// First check for long hyphenated compounds (3+ parts)
	const hyphenParts = word.split('-');
	if (hyphenParts.length > 2) {
		// Split into separate words, keeping hyphen with each part except last
		return hyphenParts.map((part, i) =>
			i < hyphenParts.length - 1 ? part + '-' : part
		).filter(w => w.length > 0 && w !== '-');
	}

	// Match em-dash (—), en-dash (–), ellipsis (…), or three dots (...)
	const splitPattern = /(—|–|…|\.\.\.)/;

	if (!splitPattern.test(word)) {
		return [word];
	}

	const result: string[] = [];
	const parts = word.split(splitPattern);

	for (let i = 0; i < parts.length; i++) {
		const part = parts[i];
		if (part === '—' || part === '–' || part === '…' || part === '...') {
			// Attach punctuation to previous word if exists
			if (result.length > 0) {
				result[result.length - 1] += part;
			}
		} else if (part.length > 0) {
			result.push(part);
		}
	}

	return result.filter(w => w.length > 0);
}

/**
 * Parse plain text into words with paragraph tracking.
 * Pages break at paragraph boundaries, targeting ~250 words per page.
 */
export function parseText(text: string, targetWordsPerPage = 250): ParsedDocument {
	const words: ParsedWord[] = [];
	const paragraphStarts: number[] = [];
	const pageStarts: number[] = [0]; // First page starts at word 0

	// Split into paragraphs (double newline or multiple newlines)
	const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);

	let wordIndex = 0;
	let currentPage = 0;
	let wordsOnCurrentPage = 0;

	paragraphs.forEach((paragraph, paragraphIndex) => {
		// Mark paragraph start
		paragraphStarts.push(wordIndex);

		// Split paragraph into words, also splitting on em-dashes
		const rawWords = paragraph
			.trim()
			.split(/\s+/)
			.filter(w => w.length > 0);

		// Further split words containing em-dashes or en-dashes
		const paragraphWords = rawWords.flatMap(splitOnDashes);

		paragraphWords.forEach(wordText => {
			words.push({
				text: wordText,
				paragraphIndex,
				pageIndex: currentPage
			});

			wordIndex++;
			wordsOnCurrentPage++;
		});

		// After each paragraph, check if we should start a new page
		// Break if we've exceeded the target (allows natural paragraph breaks)
		if (wordsOnCurrentPage >= targetWordsPerPage && paragraphIndex < paragraphs.length - 1) {
			currentPage++;
			pageStarts.push(wordIndex);
			wordsOnCurrentPage = 0;
		}
	});

	// Update pageIndex for all words based on final page assignments
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
		totalParagraphs: paragraphs.length,
		totalPages: pageStarts.length
	};
}

/**
 * Find the word index at the start of a specific paragraph.
 */
export function getWordIndexForParagraph(doc: ParsedDocument, paragraphIndex: number): number {
	if (paragraphIndex < 0) return 0;
	if (paragraphIndex >= doc.paragraphStarts.length) {
		return doc.totalWords - 1;
	}
	return doc.paragraphStarts[paragraphIndex];
}

/**
 * Find the word index at the start of a specific page.
 */
export function getWordIndexForPage(doc: ParsedDocument, pageIndex: number): number {
	if (pageIndex < 0) return 0;
	if (pageIndex >= doc.pageStarts.length) {
		return doc.totalWords - 1;
	}
	return doc.pageStarts[pageIndex];
}

/**
 * Find which paragraph a word belongs to.
 */
export function getParagraphForWordIndex(doc: ParsedDocument, wordIndex: number): number {
	for (let i = doc.paragraphStarts.length - 1; i >= 0; i--) {
		if (doc.paragraphStarts[i] <= wordIndex) {
			return i;
		}
	}
	return 0;
}

/**
 * Find which page a word belongs to.
 */
export function getPageForWordIndex(doc: ParsedDocument, wordIndex: number): number {
	for (let i = doc.pageStarts.length - 1; i >= 0; i--) {
		if (doc.pageStarts[i] <= wordIndex) {
			return i;
		}
	}
	return 0;
}

/**
 * Get the next paragraph start from current word index.
 */
export function getNextParagraphStart(doc: ParsedDocument, currentWordIndex: number): number {
	const currentParagraph = getParagraphForWordIndex(doc, currentWordIndex);
	return getWordIndexForParagraph(doc, currentParagraph + 1);
}

/**
 * Get the previous paragraph start from current word index.
 */
export function getPreviousParagraphStart(doc: ParsedDocument, currentWordIndex: number): number {
	const currentParagraph = getParagraphForWordIndex(doc, currentWordIndex);
	// If we're at the start of a paragraph, go to previous one
	if (doc.paragraphStarts[currentParagraph] === currentWordIndex) {
		return getWordIndexForParagraph(doc, currentParagraph - 1);
	}
	// Otherwise, go to start of current paragraph
	return doc.paragraphStarts[currentParagraph];
}

/**
 * Get the next page start from current word index.
 */
export function getNextPageStart(doc: ParsedDocument, currentWordIndex: number): number {
	const currentPage = getPageForWordIndex(doc, currentWordIndex);
	return getWordIndexForPage(doc, currentPage + 1);
}

/**
 * Get the previous page start from current word index.
 */
export function getPreviousPageStart(doc: ParsedDocument, currentWordIndex: number): number {
	const currentPage = getPageForWordIndex(doc, currentWordIndex);
	// If we're at the start of a page, go to previous one
	if (doc.pageStarts[currentPage] === currentWordIndex) {
		return getWordIndexForPage(doc, currentPage - 1);
	}
	// Otherwise, go to start of current page
	return doc.pageStarts[currentPage];
}
