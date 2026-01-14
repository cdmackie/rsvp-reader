/**
 * Represents a parsed word with its position information.
 */
export interface ParsedWord {
	text: string;
	paragraphIndex: number;
	pageIndex: number;
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
 * Parse plain text into words with paragraph tracking.
 * Pages are estimated based on word count since plain text doesn't have pages.
 */
export function parseText(text: string, wordsPerPage = 250): ParsedDocument {
	const words: ParsedWord[] = [];
	const paragraphStarts: number[] = [];
	const pageStarts: number[] = [0]; // First page starts at word 0

	// Split into paragraphs (double newline or multiple newlines)
	const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim().length > 0);

	let wordIndex = 0;
	let currentPage = 0;

	paragraphs.forEach((paragraph, paragraphIndex) => {
		// Mark paragraph start
		paragraphStarts.push(wordIndex);

		// Split paragraph into words
		const paragraphWords = paragraph
			.trim()
			.split(/\s+/)
			.filter(w => w.length > 0);

		paragraphWords.forEach(wordText => {
			// Check if we need a new page
			if (wordIndex > 0 && wordIndex % wordsPerPage === 0) {
				currentPage++;
				pageStarts.push(wordIndex);
			}

			words.push({
				text: wordText,
				paragraphIndex,
				pageIndex: currentPage
			});

			wordIndex++;
		});
	});

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
