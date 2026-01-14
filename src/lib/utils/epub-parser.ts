import ePub, { type Book, type NavItem } from 'epubjs';
import type { ParsedDocument, ParsedWord } from './text-parser';

/**
 * Content for a single chapter with word position markers for preview.
 */
export interface ChapterContent {
	chapterIndex: number;
	/** HTML with <span data-word-index="N"> wrappers around each word */
	htmlWithMarkers: string;
	/** Word index range [start, end] for this chapter */
	wordRange: [number, number];
	/** Map of original image src to blob URL */
	imageUrls: Map<string, string>;
}

/**
 * Extended ParsedEpub with preview content.
 */
export interface ParsedEpubWithContent extends ParsedEpub {
	/** HTML content per chapter for preview rendering */
	chapterContents: ChapterContent[];
}

/**
 * Split a word on em-dashes, en-dashes, ellipsis, and long hyphenated compounds.
 * "consciousness—seemed" becomes ["consciousness—", "seemed"]
 * "delusion…created" becomes ["delusion…", "created"]
 * "forty-nine-year-old" (3+ hyphens) becomes ["forty-", "nine-", "year-", "old"]
 * "forty-nine" (2 parts) stays as "forty-nine"
 */
function splitOnDashes(word: string): string[] {
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
			if (result.length > 0) {
				result[result.length - 1] += part;
			}
		} else if (part.length > 0) {
			result.push(part);
		}
	}

	return result.filter(w => w.length > 0);
}

interface FormattedWord {
	text: string;
	italic: boolean;
	bold: boolean;
}

interface ParagraphBlock {
	words: FormattedWord[];
}

/**
 * Extract words grouped by paragraphs from a DOM element.
 * Each block-level element (p, h1-h6, li, div with text) becomes a paragraph.
 */
function extractParagraphBlocks(element: Element): ParagraphBlock[] {
	const blocks: ParagraphBlock[] = [];

	// Block-level elements that define paragraphs
	const blockTags = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'blockquote', 'div', 'section', 'article']);

	function extractWordsFromNode(node: Node, italic: boolean, bold: boolean): FormattedWord[] {
		const words: FormattedWord[] = [];

		if (node.nodeType === Node.TEXT_NODE) {
			const text = node.textContent || '';
			const rawWords = text.split(/\s+/).filter(w => w.length > 0);
			const splitWords = rawWords.flatMap(splitOnDashes);

			for (const word of splitWords) {
				words.push({ text: word, italic, bold });
			}
		} else if (node.nodeType === Node.ELEMENT_NODE) {
			const el = node as Element;
			const tagName = el.tagName.toLowerCase();

			// Skip script and style tags
			if (tagName === 'script' || tagName === 'style') {
				return words;
			}

			// Check for formatting tags
			const isItalic = italic || tagName === 'i' || tagName === 'em';
			const isBold = bold || tagName === 'b' || tagName === 'strong';

			for (const child of Array.from(node.childNodes)) {
				words.push(...extractWordsFromNode(child, isItalic, isBold));
			}
		}

		return words;
	}

	// Leaf block tags - these are always treated as paragraph boundaries
	const leafBlockTags = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'blockquote']);
	// Container block tags - these should recurse if they contain other blocks
	const containerBlockTags = new Set(['div', 'section', 'article', 'aside', 'main']);

	function processElement(el: Element) {
		const tagName = el.tagName.toLowerCase();

		// Skip non-content elements
		if (tagName === 'script' || tagName === 'style' || tagName === 'nav' || tagName === 'header' || tagName === 'footer') {
			return;
		}

		// Leaf block elements are always treated as paragraphs
		if (leafBlockTags.has(tagName)) {
			const words = extractWordsFromNode(el, false, false);
			if (words.length > 0) {
				blocks.push({ words });
			}
			return;
		}

		// Container block elements: check if they contain block children
		if (containerBlockTags.has(tagName)) {
			const hasBlockChildren = Array.from(el.children).some(child => {
				const childTag = child.tagName.toLowerCase();
				return leafBlockTags.has(childTag) || containerBlockTags.has(childTag);
			});

			if (hasBlockChildren) {
				// Recurse into children
				for (const child of Array.from(el.children)) {
					processElement(child);
				}
			} else {
				// No block children - treat this container as a paragraph
				const words = extractWordsFromNode(el, false, false);
				if (words.length > 0) {
					blocks.push({ words });
				}
			}
			return;
		}

		// For other elements, recurse into children
		for (const child of Array.from(el.children)) {
			processElement(child);
		}

		// If no block children but has text, treat as a paragraph
		if (el.children.length === 0) {
			const words = extractWordsFromNode(el, false, false);
			if (words.length > 0) {
				blocks.push({ words });
			}
		}
	}

	// Start processing from the element's children
	for (const child of Array.from(element.children)) {
		processElement(child);
	}

	// If no blocks found, fall back to treating entire element as one block
	if (blocks.length === 0) {
		const words = extractFormattedWords(element);
		if (words.length > 0) {
			blocks.push({ words });
		}
	}

	return blocks;
}

/**
 * Extract words from a DOM element while preserving italic/bold formatting.
 */
function extractFormattedWords(element: Element): FormattedWord[] {
	const words: FormattedWord[] = [];

	function walk(node: Node, italic: boolean, bold: boolean) {
		if (node.nodeType === Node.TEXT_NODE) {
			const text = node.textContent || '';
			const rawWords = text.split(/\s+/).filter(w => w.length > 0);
			const splitWords = rawWords.flatMap(splitOnDashes);

			for (const word of splitWords) {
				words.push({ text: word, italic, bold });
			}
		} else if (node.nodeType === Node.ELEMENT_NODE) {
			const el = node as Element;
			const tagName = el.tagName.toLowerCase();

			// Check for formatting tags
			const isItalic = italic || tagName === 'i' || tagName === 'em';
			const isBold = bold || tagName === 'b' || tagName === 'strong';

			// Skip script and style tags
			if (tagName === 'script' || tagName === 'style') {
				return;
			}

			// Recurse into children
			for (const child of Array.from(node.childNodes)) {
				walk(child, isItalic, isBold);
			}
		}
	}

	walk(element, false, false);
	return words;
}

/**
 * Result of injecting word markers into HTML.
 */
interface MarkedHtmlResult {
	html: string;
	wordCount: number;
	imageSrcs: string[];
}

/**
 * Inject word index markers into an HTML element for preview highlighting.
 * Each word gets wrapped in <span data-word-index="N">.
 * Images also get data-word-index to track their position for page filtering.
 */
function injectWordMarkers(element: Element, startWordIndex: number): MarkedHtmlResult {
	// Clone to avoid mutating original
	const clone = element.cloneNode(true) as Element;
	let currentIndex = startWordIndex;
	const imageSrcs: string[] = [];

	// Collect image sources (case-insensitive for XHTML compatibility)
	clone.querySelectorAll('img, IMG, image').forEach(img => {
		const src = img.getAttribute('src') || img.getAttribute('xlink:href');
		if (src) imageSrcs.push(src);
	});

	// Walk all nodes (text and elements) in document order to properly track
	// the word index for images based on their position in the flow
	const walker = document.createTreeWalker(
		clone,
		NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
		{
			acceptNode: (node) => {
				if (node.nodeType === Node.ELEMENT_NODE) {
					// Only accept img/image elements for processing (case-insensitive)
					const tagName = (node as Element).tagName.toUpperCase();
					if (tagName === 'IMG' || tagName === 'IMAGE') {
						return NodeFilter.FILTER_ACCEPT;
					}
					return NodeFilter.FILTER_SKIP;
				}
				return NodeFilter.FILTER_ACCEPT;
			}
		}
	);

	// Collect nodes first, then process (to avoid walker issues during modification)
	const nodesToProcess: Node[] = [];
	while (walker.nextNode()) {
		nodesToProcess.push(walker.currentNode);
	}

	for (const node of nodesToProcess) {
		if (node.nodeType === Node.ELEMENT_NODE) {
			const tagName = (node as Element).tagName.toUpperCase();
			if (tagName === 'IMG' || tagName === 'IMAGE') {
				// Mark image with current word index so it appears on the correct page
				(node as Element).setAttribute('data-word-index', String(currentIndex));
				continue;
			}
		}

		// Text node processing
		const textNode = node as Text;
		const text = textNode.textContent || '';
		if (!text.trim()) continue;

		// Split into words and whitespace, preserving whitespace
		const parts = text.split(/(\s+)/);
		const fragment = document.createDocumentFragment();

		for (const part of parts) {
			if (!part) continue;

			if (/^\s+$/.test(part)) {
				// Whitespace - preserve as-is
				fragment.appendChild(document.createTextNode(part));
			} else {
				// Word - split on dashes/ellipsis and wrap each
				const subWords = splitOnDashes(part);
				for (const subWord of subWords) {
					const span = document.createElement('span');
					span.setAttribute('data-word-index', String(currentIndex));
					span.textContent = subWord;
					fragment.appendChild(span);
					// Add space between split words
					if (subWord !== subWords[subWords.length - 1]) {
						fragment.appendChild(document.createTextNode(' '));
					}
					currentIndex++;
				}
			}
		}

		textNode.parentNode?.replaceChild(fragment, textNode);
	}

	return {
		html: clone.innerHTML,
		wordCount: currentIndex - startWordIndex,
		imageSrcs
	};
}

/**
 * Resolve EPUB image paths to blob URLs.
 */
async function resolveImageUrls(
	book: Book,
	imageSrcs: string[],
	chapterHref: string
): Promise<Map<string, string>> {
	const urlMap = new Map<string, string>();

	// Get the package directory (e.g., "OEBPS/")
	const packageDir = (book as any).packaging?.directory || '';

	for (const src of imageSrcs) {
		try {
			// Resolve relative path to absolute path within EPUB
			let resolvedPath = src;
			if (src.startsWith('../') || src.startsWith('./') || !src.startsWith('/')) {
				// Build absolute path from chapter location
				// The chapter href might not include the package directory, so we need to add it
				const fullChapterPath = packageDir + chapterHref;
				const chapterDir = fullChapterPath.substring(0, fullChapterPath.lastIndexOf('/') + 1);
				resolvedPath = chapterDir + src;
				// Normalize path (remove ../)
				resolvedPath = resolvedPath.split('/').reduce((acc: string[], part) => {
					if (part === '..') acc.pop();
					else if (part !== '.') acc.push(part);
					return acc;
				}, []).join('/');
			}

			// Try different methods to get the image blob
			const archive = (book as any).archive;
			let blob: Blob | null = null;

			// Method 1: Try archive.zip.file() (JSZip) - most reliable
			if (!blob && archive?.zip?.file) {
				try {
					const zipFile = archive.zip.file(resolvedPath);
					if (zipFile) {
						blob = await zipFile.async('blob');
					}
				} catch (e) {
					// zip.file method failed, try next method
				}
			}

			// Method 2: If that didn't work, try without the package directory
			if (!blob && archive?.zip?.file && packageDir) {
				try {
					// Remove package directory prefix if present
					const pathWithoutPkg = resolvedPath.startsWith(packageDir)
						? resolvedPath.substring(packageDir.length)
						: resolvedPath;
					const zipFile = archive.zip.file(pathWithoutPkg);
					if (zipFile) {
						blob = await zipFile.async('blob');
					}
				} catch (e) {
					// zip.file (without pkg) method failed, try next method
				}
			}

			// Method 3: Try listing all files to find a match
			if (!blob && archive?.zip?.files) {
				try {
					const files = archive.zip.files;
					const fileName = resolvedPath.split('/').pop();
					// Look for a file with matching name
					for (const path of Object.keys(files)) {
						if (path.endsWith('/' + fileName) || path === fileName) {
							const zipFile = files[path];
							if (!zipFile.dir) {
								blob = await zipFile.async('blob');
								break;
							}
						}
					}
				} catch (e) {
					// file search method failed
				}
			}

			if (blob) {
				const blobUrl = URL.createObjectURL(blob);
				urlMap.set(src, blobUrl);
			}
		} catch (e) {
			// Failed to resolve image, continue with next
		}
	}

	return urlMap;
}

/**
 * Replace image src attributes in HTML with resolved blob URLs.
 */
function replaceImageUrls(html: string, urlMap: Map<string, string>): string {
	let result = html;
	for (const [original, blobUrl] of urlMap) {
		// Escape special regex characters
		const escaped = original.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		// Replace src and add data-original-src attribute for identification
		result = result.replace(
			new RegExp(`src=["']${escaped}["']`, 'g'),
			`src="${blobUrl}" data-original-src="${original}"`
		);
	}
	return result;
}

/**
 * Extended parsed document with EPUB-specific information.
 */
export interface ParsedEpub extends ParsedDocument {
	title: string;
	author: string;
	chapters: ChapterInfo[];
	chapterStarts: number[]; // Word indices where chapters start
	parseWarnings: string[]; // Warnings encountered during parsing
}

export interface ChapterInfo {
	title: string;
	href: string;
	wordStart: number;
	wordEnd: number;
}

/**
 * Parse an EPUB file into words with chapter, paragraph, and page tracking.
 * Pages break at natural boundaries (chapters and paragraphs).
 * Also generates HTML with word markers for preview display.
 */
export async function parseEpub(file: File, targetWordsPerPage = 250): Promise<ParsedEpubWithContent> {
	const arrayBuffer = await file.arrayBuffer();
	const book: Book = ePub(arrayBuffer);

	await book.ready;

	// Get metadata
	const metadata = await book.loaded.metadata;
	const title = metadata.title || file.name.replace(/\.epub$/i, '');
	const author = metadata.creator || 'Unknown Author';

	// Get navigation/TOC
	const navigation = await book.loaded.navigation;
	const toc: NavItem[] = navigation.toc || [];

	const words: ParsedWord[] = [];
	const paragraphStarts: number[] = [];
	const pageStarts: number[] = [0];
	const chapters: ChapterInfo[] = [];
	const chapterStarts: number[] = [];
	const chapterContents: ChapterContent[] = [];
	const parseWarnings: string[] = [];

	let wordIndex = 0;
	let paragraphIndex = 0;
	let currentPage = 0;
	let wordsOnCurrentPage = 0;

	// Get spine items (the reading order)
	const spine = book.spine;

	// epub.js stores spine items in different properties depending on version
	let spineItems: any[] = [];

	// Try different ways to access spine items
	if ((spine as any).spineItems && Array.isArray((spine as any).spineItems)) {
		spineItems = (spine as any).spineItems;
	} else if ((spine as any).items && Array.isArray((spine as any).items)) {
		spineItems = (spine as any).items;
	} else if (typeof (spine as any).each === 'function') {
		// Use the each() iterator if available
		(spine as any).each((item: any) => spineItems.push(item));
	} else if ((spine as any).length) {
		// Try accessing by index
		for (let i = 0; i < (spine as any).length; i++) {
			const item = (spine as any).get(i);
			if (item) spineItems.push(item);
		}
	}

	if (spineItems.length === 0) {
		parseWarnings.push('No spine items found in EPUB - the file may be malformed or use an unsupported format');
	}

	// Process each spine item (section/chapter)
	for (const spineItem of spineItems) {
		// Start a new page at each chapter boundary (if not at start)
		if (wordIndex > 0 && wordsOnCurrentPage > 0) {
			currentPage++;
			pageStarts.push(wordIndex);
			wordsOnCurrentPage = 0;
		}

		const chapterStartWord = wordIndex;
		chapterStarts.push(chapterStartWord);

		// Find chapter title from TOC
		const tocEntry = toc.find(t => spineItem.href.includes(t.href.split('#')[0]));
		const chapterTitle = tocEntry?.label || `Section ${chapters.length + 1}`;

		try {
			// Load the section content - spineItem might be a Section object itself
			let section = spineItem;
			if (typeof spineItem.load !== 'function') {
				// It's just a reference, need to get actual section
				section = await book.section(spineItem.href || spineItem.idref);
			}

			if (!section) {
				parseWarnings.push(`Section not found: ${spineItem.href || spineItem.idref}`);
				continue;
			}

			let contents: string | Document | null = null;
			try {
				contents = await section.load(book.load.bind(book));
			} catch (loadErr) {
				console.warn('Section load error:', loadErr);
				// Try alternative loading method
				try {
					const url = await book.resolve(spineItem.href || spineItem.idref);
					if (url) {
						const response = await fetch(url);
						const html = await response.text();
						contents = html;
					}
				} catch {
					// Ignore fetch errors
				}
			}

			if (!contents) {
				parseWarnings.push(`Could not load content for: ${chapterTitle}`);
				continue;
			}

			// Extract words with formatting from content
			let formattedWords: FormattedWord[] = [];
			let markedHtml = '';
			let imageSrcs: string[] = [];
			let contentElement: Element | null = null;

			// Parse content to get element
			if (contents instanceof Element) {
				const el = contents as Element;
				let bodyEl: Element | null = el.querySelector('body');
				if (!bodyEl) {
					bodyEl = el.getElementsByTagName('body')[0] || null;
				}
				if (!bodyEl && el.children) {
					for (let i = 0; i < el.children.length; i++) {
						if (el.children[i].tagName.toLowerCase() === 'body') {
							bodyEl = el.children[i];
							break;
						}
					}
				}
				contentElement = bodyEl || el;
			} else if (contents instanceof Document) {
				if (contents.body) {
					contentElement = contents.body;
				}
			} else if (typeof contents === 'string') {
				try {
					const parser = new DOMParser();
					const doc = parser.parseFromString(contents, 'text/html');
					if (doc.body) {
						contentElement = doc.body;
					}
				} catch {
					// Fallback handled below
				}
			}

			// Extract paragraph blocks from content
			let paragraphBlocks: ParagraphBlock[] = [];
			if (contentElement) {
				paragraphBlocks = extractParagraphBlocks(contentElement);
			} else {
				// Fallback: treat entire content as one block
				const textContent = (contents as any)?.textContent || '';
				const rawWords = textContent.split(/\s+/).filter((w: string) => w.length > 0);
				formattedWords = rawWords.flatMap(splitOnDashes).map((text: string) => ({
					text,
					italic: false,
					bold: false
				}));
				if (formattedWords.length > 0) {
					paragraphBlocks = [{ words: formattedWords }];
				}
			}

			// Generate marked HTML for preview if we have a content element
			if (contentElement) {
				const markedResult = injectWordMarkers(contentElement, chapterStartWord);
				markedHtml = markedResult.html;
				imageSrcs = markedResult.imageSrcs;
			}

			// Process each paragraph block
			for (const block of paragraphBlocks) {
				if (block.words.length === 0) continue;

				// Mark paragraph start
				paragraphStarts.push(wordIndex);

				// Add all words in this paragraph
				for (const fw of block.words) {
					words.push({
						text: fw.text,
						paragraphIndex,
						pageIndex: currentPage,
						italic: fw.italic || undefined,
						bold: fw.bold || undefined
					});
					wordIndex++;
					wordsOnCurrentPage++;
				}

				paragraphIndex++;

				// After each paragraph, check if we should start a new page
				// Only break if we've exceeded the target word count
				if (wordsOnCurrentPage >= targetWordsPerPage) {
					currentPage++;
					pageStarts.push(wordIndex);
					wordsOnCurrentPage = 0;
				}
			}

			// Resolve image URLs and build chapter content
			let imageUrls = new Map<string, string>();
			if (imageSrcs.length > 0) {
				imageUrls = await resolveImageUrls(book, imageSrcs, spineItem.href || '');
				if (imageUrls.size > 0) {
					markedHtml = replaceImageUrls(markedHtml, imageUrls);
				}
			}

			// Store chapter content for preview
			const wordRangeEnd = wordIndex > chapterStartWord ? wordIndex - 1 : chapterStartWord;
			chapterContents.push({
				chapterIndex: chapters.length,
				htmlWithMarkers: markedHtml,
				wordRange: [chapterStartWord, wordRangeEnd],
				imageUrls
			});
		} catch (e) {
			const errorMsg = e instanceof Error ? e.message : 'Unknown error';
			const warning = `Failed to parse chapter "${chapterTitle}": ${errorMsg}`;
			parseWarnings.push(warning);
			console.warn(warning, e);
		}

		chapters.push({
			title: chapterTitle,
			href: spineItem.href,
			wordStart: chapterStartWord,
			wordEnd: wordIndex - 1
		});
	}

	// Clean up - but don't destroy book yet as we may need it for images
	// Note: book.destroy() should be called when document is unloaded
	book.destroy();

	return {
		words,
		paragraphStarts,
		pageStarts,
		chapterStarts,
		chapters,
		chapterContents,
		title,
		author,
		totalWords: words.length,
		totalParagraphs: paragraphIndex,
		totalPages: pageStarts.length,
		parseWarnings
	};
}

/**
 * Strip HTML tags from a string.
 */
function stripHtml(html: string): string {
	// Create a temporary div to parse HTML
	if (typeof DOMParser !== 'undefined') {
		try {
			const parser = new DOMParser();
			const doc = parser.parseFromString(html, 'text/html');
			return doc.body?.textContent || '';
		} catch {
			// Fallback to regex
		}
	}

	// Fallback: simple regex-based HTML stripping
	return html
		.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
		.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
		.replace(/<[^>]+>/g, ' ')
		.replace(/&nbsp;/g, ' ')
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/\s+/g, ' ')
		.trim();
}

/**
 * Find the chapter for a given word index.
 */
export function getChapterForWordIndex(doc: ParsedEpub, wordIndex: number): number {
	for (let i = doc.chapterStarts.length - 1; i >= 0; i--) {
		if (doc.chapterStarts[i] <= wordIndex) {
			return i;
		}
	}
	return 0;
}

/**
 * Get word index for start of a chapter.
 */
export function getWordIndexForChapter(doc: ParsedEpub, chapterIndex: number): number {
	if (chapterIndex < 0) return 0;
	if (chapterIndex >= doc.chapterStarts.length) {
		return doc.totalWords - 1;
	}
	return doc.chapterStarts[chapterIndex];
}

/**
 * Clean up blob URLs to prevent memory leaks.
 * Call this when unloading a document.
 */
export function cleanupEpubResources(doc: ParsedEpubWithContent): void {
	if (!doc.chapterContents) return;

	for (const chapter of doc.chapterContents) {
		for (const blobUrl of chapter.imageUrls.values()) {
			try {
				URL.revokeObjectURL(blobUrl);
			} catch {
				// Ignore errors
			}
		}
	}
}
