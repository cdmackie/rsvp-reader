/**
 * Markdown file format adapter.
 * Converts Markdown to HTML with proper preview rendering.
 * Code blocks are displayed but not read aloud.
 */

import type { FileAdapter, AdapterParseResult } from './types';
import type { ParsedWord, ParsedDocument } from '../text-parser';
import type { ChapterContent, ChapterInfo } from '../epub-parser';
import { splitOnDashes } from '../text-parser';

/**
 * Escape HTML special characters.
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
 * Represents a block of content (paragraph, header, code block, etc.)
 */
interface ContentBlock {
	type: 'text' | 'code' | 'hr';
	html: string;
	wordStart: number;
	wordEnd: number;
}

/**
 * Parse Markdown and extract document with preview HTML.
 */
function parseMarkdown(markdown: string, targetWordsPerPage = 250): {
	document: ParsedDocument;
	title?: string;
	preview?: { chapterContents: ChapterContent[]; chapters: ChapterInfo[]; chapterStarts: number[] };
} {
	const words: ParsedWord[] = [];
	const paragraphStarts: number[] = [0];
	const contentBlocks: ContentBlock[] = [];

	let wordIndex = 0;
	let paragraphIndex = 0;
	let title: string | undefined;

	// Temporary storage for building current block's HTML
	let currentBlockHtml: string[] = [];
	let currentBlockWordStart = 0;

	/**
	 * Add words with markers to HTML and words array.
	 */
	function addText(text: string, italic: boolean, bold: boolean): void {
		const rawWords = text.split(/\s+/).filter(w => w.length > 0);
		const splitWords = rawWords.flatMap(splitOnDashes);

		for (const word of splitWords) {
			words.push({
				text: word,
				paragraphIndex,
				pageIndex: 0, // Will be updated later
				italic: italic || undefined,
				bold: bold || undefined
			});

			// Build HTML with word marker
			let html = `<span data-word-index="${wordIndex}">${escapeHtml(word)}</span>`;
			if (bold && italic) {
				html = `<strong><em>${html}</em></strong>`;
			} else if (bold) {
				html = `<strong>${html}</strong>`;
			} else if (italic) {
				html = `<em>${html}</em>`;
			}
			currentBlockHtml.push(html + ' ');

			wordIndex++;
		}
	}

	/**
	 * Parse inline formatting (bold, italic) within text.
	 */
	function parseInline(text: string): void {
		// Remove images first
		text = text.replace(/!\[([^\]]*)\]\([^)]+\)/g, '');

		// Simple state machine for inline formatting
		let i = 0;
		let currentText = '';
		let inBold = false;
		let inItalic = false;

		while (i < text.length) {
			// Check for inline code - add to preview but don't read
			if (text[i] === '`' && text[i + 1] !== '`') {
				if (currentText) {
					addText(currentText, inItalic, inBold);
					currentText = '';
				}
				const end = text.indexOf('`', i + 1);
				if (end !== -1) {
					const code = text.slice(i + 1, end);
					currentBlockHtml.push(`<code>${escapeHtml(code)}</code> `);
					i = end + 1;
					continue;
				}
			}

			// Check for link [text](url)
			if (text[i] === '[') {
				const linkMatch = text.slice(i).match(/^\[([^\]]+)\]\([^)]+\)/);
				if (linkMatch) {
					if (currentText) {
						addText(currentText, inItalic, inBold);
						currentText = '';
					}
					currentBlockHtml.push('<a>');
					addText(linkMatch[1], inItalic, inBold);
					currentBlockHtml.push('</a>');
					i += linkMatch[0].length;
					continue;
				}
			}

			// Check for *** (bold+italic)
			if (text.slice(i, i + 3) === '***') {
				if (currentText) {
					addText(currentText, inItalic, inBold);
					currentText = '';
				}
				inBold = !inBold;
				inItalic = !inItalic;
				i += 3;
				continue;
			}

			// Check for ** (bold)
			if (text.slice(i, i + 2) === '**') {
				if (currentText) {
					addText(currentText, inItalic, inBold);
					currentText = '';
				}
				inBold = !inBold;
				i += 2;
				continue;
			}

			// Check for __ (bold)
			if (text.slice(i, i + 2) === '__') {
				if (currentText) {
					addText(currentText, inItalic, inBold);
					currentText = '';
				}
				inBold = !inBold;
				i += 2;
				continue;
			}

			// Check for * (italic)
			if (text[i] === '*' && text[i + 1] !== '*') {
				if (currentText) {
					addText(currentText, inItalic, inBold);
					currentText = '';
				}
				inItalic = !inItalic;
				i++;
				continue;
			}

			// Check for _ (italic) at word boundaries
			if (text[i] === '_' && text[i + 1] !== '_') {
				const prevChar = i > 0 ? text[i - 1] : ' ';
				const nextChar = i < text.length - 1 ? text[i + 1] : ' ';
				if (!/\w/.test(prevChar) || !/\w/.test(nextChar)) {
					if (currentText) {
						addText(currentText, inItalic, inBold);
						currentText = '';
					}
					inItalic = !inItalic;
					i++;
					continue;
				}
			}

			currentText += text[i];
			i++;
		}

		if (currentText) {
			addText(currentText, inItalic, inBold);
		}
	}

	/**
	 * Flush current block and start a new one
	 */
	function flushBlock(wrapperStart: string, wrapperEnd: string): void {
		if (currentBlockHtml.length > 0 || wrapperStart) {
			const html = wrapperStart + currentBlockHtml.join('') + wrapperEnd;
			contentBlocks.push({
				type: 'text',
				html,
				wordStart: currentBlockWordStart,
				wordEnd: wordIndex - 1
			});
		}
		currentBlockHtml = [];
		currentBlockWordStart = wordIndex;
	}

	/**
	 * Start a new paragraph.
	 */
	function startParagraph(): void {
		if (wordIndex > 0) {
			paragraphIndex++;
			paragraphStarts.push(wordIndex);
		}
	}

	// Pre-process: normalize lines to merge broken sentences
	// (handles PDF conversion artifacts where sentences are split across blank lines)
	const rawLines = markdown.split('\n');
	const normalizedLines: string[] = [];

	/**
	 * Check if a line looks like a sentence continuation (starts with lowercase or common words)
	 */
	function isContinuation(line: string): boolean {
		const trimmed = line.trim();
		if (!trimmed) return false;
		// Starts with lowercase letter
		if (/^[a-z]/.test(trimmed)) return true;
		// Starts with common continuation patterns
		if (/^(and|or|but|with|for|to|in|on|at|the|a|an|that|which|who|whom)\b/i.test(trimmed)) {
			// Only if actually lowercase
			return /^[a-z]/.test(trimmed);
		}
		return false;
	}

	/**
	 * Check if a line ends without sentence-ending punctuation
	 */
	function isIncomplete(line: string): boolean {
		const trimmed = line.trim();
		if (!trimmed) return false;
		// Ends with sentence punctuation
		if (/[.!?:;]$/.test(trimmed)) return false;
		// Ends with closing quote after punctuation
		if (/[.!?:;]['"]$/.test(trimmed)) return false;
		return true;
	}

	// First pass: merge broken sentences
	let i = 0;
	while (i < rawLines.length) {
		const line = rawLines[i];
		const trimmed = line.trim();

		// Skip code blocks during normalization
		if (trimmed.startsWith('```')) {
			normalizedLines.push(line);
			i++;
			// Copy until closing ```
			while (i < rawLines.length && !rawLines[i].trim().startsWith('```')) {
				normalizedLines.push(rawLines[i]);
				i++;
			}
			if (i < rawLines.length) {
				normalizedLines.push(rawLines[i]);
				i++;
			}
			continue;
		}

		// Check if this line might be incomplete and next content is a continuation
		if (trimmed && isIncomplete(trimmed)) {
			// Look ahead past blank lines for a continuation
			let j = i + 1;
			while (j < rawLines.length && !rawLines[j].trim()) {
				j++;
			}
			// If we found a continuation after blank lines, merge them
			if (j > i + 1 && j < rawLines.length && isContinuation(rawLines[j])) {
				// Merge: add current line, skip blanks, continue will add next
				normalizedLines.push(line);
				i = j; // Skip to the continuation line (don't add blank lines)
				continue;
			}
		}

		normalizedLines.push(line);
		i++;
	}

	// Now parse the normalized lines
	const lines = normalizedLines;
	let inCodeBlock = false;
	let codeBlockContent: string[] = [];
	let codeBlockLang = '';

	// Track accumulated paragraph lines (consecutive non-special, non-blank lines)
	let paragraphLines: string[] = [];

	// Track accumulated list items
	let listItems: string[] = [];
	let currentListType: 'ul' | 'ol' | null = null;

	/**
	 * Flush accumulated paragraph lines as a single paragraph block
	 */
	function flushParagraph(): void {
		if (paragraphLines.length === 0) return;

		// Join all lines with space to form single paragraph
		const paragraphText = paragraphLines.join(' ');
		paragraphLines = [];

		startParagraph();
		currentBlockWordStart = wordIndex;
		currentBlockHtml = [];
		parseInline(paragraphText);
		flushBlock('<p>', '</p>');
	}

	/**
	 * Flush accumulated list items as a single list block
	 */
	function flushList(): void {
		if (listItems.length === 0 || !currentListType) return;

		const tag = currentListType;
		const listWordStart = wordIndex;

		// Build HTML for all list items
		currentBlockHtml = [`<${tag}>`];
		for (const item of listItems) {
			startParagraph();
			currentBlockHtml.push('<li>');
			parseInline(item);
			currentBlockHtml.push('</li>');
		}
		currentBlockHtml.push(`</${tag}>`);

		// Create content block for the entire list
		contentBlocks.push({
			type: 'text',
			html: currentBlockHtml.join(''),
			wordStart: listWordStart,
			wordEnd: wordIndex - 1
		});

		// Reset list state
		listItems = [];
		currentListType = null;
		currentBlockHtml = [];
		currentBlockWordStart = wordIndex;
	}

	for (let idx = 0; idx < lines.length; idx++) {
		const line = lines[idx];
		const trimmedLine = line.trim();

		// Handle fenced code blocks
		if (trimmedLine.startsWith('```')) {
			flushParagraph(); // Flush any pending paragraph
			flushList(); // Flush any pending list
			if (!inCodeBlock) {
				inCodeBlock = true;
				codeBlockLang = trimmedLine.slice(3).trim();
				codeBlockContent = [];
			} else {
				// End code block - add as non-word content block
				const codeHtml = `<pre><code class="language-${escapeHtml(codeBlockLang)}">${escapeHtml(codeBlockContent.join('\n'))}</code></pre>`;
				contentBlocks.push({
					type: 'code',
					html: codeHtml,
					wordStart: wordIndex,
					wordEnd: wordIndex - 1 // No words in code block
				});
				inCodeBlock = false;
				codeBlockContent = [];
				codeBlockLang = '';
			}
			continue;
		}

		if (inCodeBlock) {
			codeBlockContent.push(line);
			continue;
		}

		// Blank line ends current paragraph and list
		if (!trimmedLine) {
			flushParagraph();
			flushList();
			continue;
		}

		// Headers
		const headerMatch = trimmedLine.match(/^(#{1,6})\s+(.+)$/);
		if (headerMatch) {
			flushParagraph(); // Flush any pending paragraph
			flushList(); // Flush any pending list
			const level = headerMatch[1].length;
			const headerText = headerMatch[2];

			if (level === 1 && !title) {
				title = headerText.replace(/[*_`\[\]]/g, '');
			}

			startParagraph();
			currentBlockWordStart = wordIndex;
			currentBlockHtml = [];
			currentBlockHtml.push(`<h${level}>`);
			parseInline(headerText);
			currentBlockHtml.push(`</h${level}>`);
			flushBlock('', '');
			continue;
		}

		// Horizontal rule
		if (/^[-*_]{3,}$/.test(trimmedLine)) {
			flushParagraph(); // Flush any pending paragraph
			flushList(); // Flush any pending list
			contentBlocks.push({
				type: 'hr',
				html: '<hr>',
				wordStart: wordIndex,
				wordEnd: wordIndex - 1
			});
			continue;
		}

		// Blockquote
		if (trimmedLine.startsWith('>')) {
			flushParagraph(); // Flush any pending paragraph
			flushList(); // Flush any pending list
			startParagraph();
			currentBlockWordStart = wordIndex;
			currentBlockHtml = [];
			const quoteText = trimmedLine.replace(/^>\s*/, '');
			parseInline(quoteText);
			flushBlock('<blockquote>', '</blockquote>');
			continue;
		}

		// Check for indented continuation line (starts with whitespace)
		// These continue the previous list item or paragraph, BUT only if they're not nested list items
		const isIndented = /^[\t ]/.test(line) && trimmedLine.length > 0;
		// Check for list markers: standard (- * +) or bold (**-)
		const isNestedListItem = isIndented && (/^[\*\-\+]\s+/.test(trimmedLine) || /^\*\*-\s+/.test(trimmedLine));
		if (isIndented && !isNestedListItem) {
			// If we have an active list, append to last item
			if (listItems.length > 0) {
				listItems[listItems.length - 1] += ' ' + trimmedLine;
				continue;
			}
			// Otherwise append to paragraph
			paragraphLines.push(trimmedLine);
			continue;
		}

		// Bold list item pattern: **- Item:** (common in PDF conversions)
		const boldListMatch = trimmedLine.match(/^\*\*-\s+(.+)$/);
		if (boldListMatch) {
			flushParagraph(); // Flush any pending paragraph
			// If switching from ol to ul, flush the old list
			if (currentListType === 'ol') flushList();
			currentListType = 'ul';
			// Keep the bold markers in the content so parseInline handles them
			listItems.push('**' + boldListMatch[1]);
			continue;
		}

		// Unordered list item
		const ulMatch = trimmedLine.match(/^[\*\-\+]\s+(.+)$/);
		if (ulMatch) {
			flushParagraph(); // Flush any pending paragraph
			// If switching from ol to ul, flush the old list
			if (currentListType === 'ol') flushList();
			currentListType = 'ul';
			listItems.push(ulMatch[1]);
			continue;
		}

		// Ordered list item
		const olMatch = trimmedLine.match(/^\d+\.\s+(.+)$/);
		if (olMatch) {
			flushParagraph(); // Flush any pending paragraph
			// If switching from ul to ol, flush the old list
			if (currentListType === 'ul') flushList();
			currentListType = 'ol';
			listItems.push(olMatch[1]);
			continue;
		}

		// Regular text line - flush any pending list first
		flushList();
		// Accumulate for paragraph
		paragraphLines.push(trimmedLine);
	}

	// Flush any remaining content at end of document
	flushParagraph();
	flushList();

	// Handle unclosed code block
	if (inCodeBlock && codeBlockContent.length > 0) {
		const codeHtml = `<pre><code class="language-${escapeHtml(codeBlockLang)}">${escapeHtml(codeBlockContent.join('\n'))}</code></pre>`;
		contentBlocks.push({
			type: 'code',
			html: codeHtml,
			wordStart: wordIndex,
			wordEnd: wordIndex - 1
		});
	}

	// Now create pages from content blocks
	const pageStarts: number[] = [0];
	const chapterContents: ChapterContent[] = [];

	let currentPageHtml: string[] = [];
	let currentPageWordStart = 0;
	let currentPageWordCount = 0;

	for (const block of contentBlocks) {
		const blockWordCount = block.wordEnd >= block.wordStart ? block.wordEnd - block.wordStart + 1 : 0;

		// Check if we need to start a new page
		if (currentPageWordCount > 0 && currentPageWordCount + blockWordCount > targetWordsPerPage) {
			// Finish current page
			if (currentPageHtml.length > 0) {
				chapterContents.push({
					chapterIndex: chapterContents.length,
					htmlWithMarkers: currentPageHtml.join(''),
					wordRange: [currentPageWordStart, currentPageWordStart + currentPageWordCount - 1],
					imageUrls: new Map()
				});
			}
			// Start new page
			pageStarts.push(currentPageWordStart + currentPageWordCount);
			currentPageHtml = [];
			currentPageWordStart = block.wordStart;
			currentPageWordCount = 0;
		}

		currentPageHtml.push(block.html);
		if (blockWordCount > 0) {
			if (currentPageWordCount === 0) {
				currentPageWordStart = block.wordStart;
			}
			currentPageWordCount += blockWordCount;
		}
	}

	// Add final page
	if (currentPageHtml.length > 0 && currentPageWordCount > 0) {
		chapterContents.push({
			chapterIndex: chapterContents.length,
			htmlWithMarkers: currentPageHtml.join(''),
			wordRange: [currentPageWordStart, currentPageWordStart + currentPageWordCount - 1],
			imageUrls: new Map()
		});
	}

	// Update pageIndex for all words
	let pageIdx = 0;
	for (let j = 0; j < words.length; j++) {
		if (pageIdx < pageStarts.length - 1 && j >= pageStarts[pageIdx + 1]) {
			pageIdx++;
		}
		words[j].pageIndex = pageIdx;
	}

	const document: ParsedDocument = {
		words,
		paragraphStarts,
		pageStarts,
		totalWords: words.length,
		totalParagraphs: paragraphStarts.length,
		totalPages: pageStarts.length
	};

	const chapters: ChapterInfo[] = words.length > 0 ? [{
		title: title || 'Document',
		href: '#document'
	}] : [];

	const chapterStarts = words.length > 0 ? [0] : [];

	return {
		document,
		title,
		preview: chapterContents.length > 0 ? {
			chapterContents,
			chapters,
			chapterStarts
		} : undefined
	};
}

/**
 * Extract title from Markdown (first # heading or filename).
 */
function extractTitleFallback(markdown: string, filename: string): string {
	const match = markdown.match(/^#\s+(.+)$/m);
	if (match?.[1]?.trim()) {
		return match[1].trim().replace(/[*_`\[\]]/g, '');
	}
	return filename.replace(/\.(md|markdown)$/i, '');
}

/**
 * Adapter for Markdown files.
 */
export const markdownAdapter: FileAdapter = {
	extensions: ['md', 'markdown'],
	mimeTypes: ['text/markdown', 'text/x-markdown'],
	formatName: 'Markdown',
	supportsPreview: true,

	async parse(file: File): Promise<AdapterParseResult> {
		const markdown = await file.text();
		const result = parseMarkdown(markdown);
		const title = result.title || extractTitleFallback(markdown, file.name);

		return {
			document: result.document,
			title,
			preview: result.preview,
			warnings: [],
			extra: {
				fileType: 'markdown'
			}
		};
	}
};
