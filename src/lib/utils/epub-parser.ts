import ePub, { type Book, type NavItem } from 'epubjs';
import type { ParsedDocument, ParsedWord } from './text-parser';
import { mergeOrphanedPunctuation } from './text-parser';

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
 * Extract all raw words from an element in document order.
 * This is used to pre-compute the merged word list before injecting markers.
 * Returns the raw words (after splitOnDashes) and whether each is from an image.
 */
function extractRawWordsFromElement(element: Element): { words: string[]; isImage: boolean[] } {
	const words: string[] = [];
	const isImage: boolean[] = [];

	const walker = document.createTreeWalker(
		element,
		NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
		{
			acceptNode: (node) => {
				if (node.nodeType === Node.ELEMENT_NODE) {
					const tagName = (node as Element).tagName.toUpperCase();
					if (tagName === 'IMG' || tagName === 'IMAGE' || tagName === 'SVG') {
						return NodeFilter.FILTER_ACCEPT;
					}
					if (tagName === 'SCRIPT' || tagName === 'STYLE') {
						return NodeFilter.FILTER_REJECT;
					}
					return NodeFilter.FILTER_SKIP;
				}
				// Skip text nodes inside SVG elements
				let parent = node.parentElement;
				while (parent) {
					if (parent.tagName.toUpperCase() === 'SVG') {
						return NodeFilter.FILTER_REJECT;
					}
					parent = parent.parentElement;
				}
				return NodeFilter.FILTER_ACCEPT;
			}
		}
	);

	while (walker.nextNode()) {
		const node = walker.currentNode;

		if (node.nodeType === Node.ELEMENT_NODE) {
			const tagName = (node as Element).tagName.toUpperCase();
			if (tagName === 'IMG' || tagName === 'IMAGE' || tagName === 'SVG') {
				// Images get a placeholder word entry
				words.push('[IMAGE]');
				isImage.push(true);
			}
			continue;
		}

		// Text node
		const text = node.textContent || '';
		if (!text.trim()) continue;

		const parts = text.split(/\s+/).filter(w => w.length > 0);
		for (const part of parts) {
			const subWords = splitOnDashes(part);
			for (const subWord of subWords) {
				words.push(subWord);
				isImage.push(false);
			}
		}
	}

	return { words, isImage };
}

/**
 * Compute merged word indices for an element.
 * Returns a mapping from raw word index to final (merged) word index.
 *
 * Images are NOT counted as separate words - they share the index of the
 * nearest text word for page filtering purposes. This ensures the word count
 * matches the text-only extraction used for the RSVP word array.
 */
function computeMergedIndices(element: Element, startWordIndex: number): {
	mergedWords: string[];
	rawToMergedIndex: number[];
	isImage: boolean[];
} {
	const { words: rawWords, isImage } = extractRawWordsFromElement(element);

	// Extract just text words (not images) for merging
	const textWords: string[] = [];
	for (let i = 0; i < rawWords.length; i++) {
		if (!isImage[i]) {
			textWords.push(rawWords[i]);
		}
	}

	// Apply punctuation merging to text words only
	const mergeResult = mergeOrphanedPunctuation(textWords);

	// Build the raw-to-merged index mapping
	// Images get the index of the nearest text word (preceding if available, else next)
	const finalRawToMerged: number[] = new Array(rawWords.length);

	let finalIdx = startWordIndex;
	let prevMergedTextIdx = -1;
	let textIdx = 0;
	let lastTextWordIdx = startWordIndex; // Track the last text word index for images

	for (let rawIdx = 0; rawIdx < rawWords.length; rawIdx++) {
		if (isImage[rawIdx]) {
			// Image - use the last text word's index (or startWordIndex if no text yet)
			finalRawToMerged[rawIdx] = lastTextWordIdx;
		} else {
			// Text word
			const mergedTextIdx = mergeResult.indexMap[textIdx];

			if (mergedTextIdx !== prevMergedTextIdx) {
				// This is a new merged word (not merged with previous)
				finalRawToMerged[rawIdx] = finalIdx;
				lastTextWordIdx = finalIdx;
				finalIdx++;
				prevMergedTextIdx = mergedTextIdx;
			} else {
				// This word was merged with the previous - use same index
				finalRawToMerged[rawIdx] = finalIdx - 1;
				lastTextWordIdx = finalIdx - 1;
			}
			textIdx++;
		}
	}

	// If there were images before any text, update their indices to point to first text
	if (textWords.length > 0) {
		const firstTextIdx = startWordIndex;
		for (let rawIdx = 0; rawIdx < rawWords.length; rawIdx++) {
			if (isImage[rawIdx] && finalRawToMerged[rawIdx] === startWordIndex && rawIdx < rawWords.length - 1) {
				// This image was before any text - keep pointing to first text word
				finalRawToMerged[rawIdx] = firstTextIdx;
			}
			// Stop once we hit the first text word
			if (!isImage[rawIdx]) break;
		}
	}

	return {
		mergedWords: mergeResult.words,  // Only text words (merged)
		rawToMergedIndex: finalRawToMerged,
		isImage
	};
}

/**
 * Inject word index markers into an HTML element for preview highlighting.
 * Each word gets wrapped in <span data-word-index="N">.
 * Images also get data-word-index to track their position for page filtering.
 *
 * Uses two-pass approach:
 * 1. First extracts all raw words and computes merged indices (handling punctuation merging)
 * 2. Then injects markers using the pre-computed merged indices
 *
 * This ensures word indices in HTML match the merged word array used for RSVP display.
 */
function injectWordMarkers(element: Element, startWordIndex: number): MarkedHtmlResult {
	// First pass: compute merged indices
	const { mergedWords, rawToMergedIndex, isImage } = computeMergedIndices(element, startWordIndex);

	// Clone to avoid mutating original
	const clone = element.cloneNode(true) as Element;
	const imageSrcs: string[] = [];

	// Collect image sources (case-insensitive for XHTML compatibility)
	clone.querySelectorAll('img, IMG, image, IMAGE').forEach(img => {
		const src = img.getAttribute('src') || img.getAttribute('xlink:href') || img.getAttribute('href');
		if (src) imageSrcs.push(src);
	});

	// Track current raw word index as we walk the DOM
	let rawWordIndex = 0;

	// Walk all nodes (text and elements) in document order
	const walker = document.createTreeWalker(
		clone,
		NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT,
		{
			acceptNode: (node) => {
				if (node.nodeType === Node.ELEMENT_NODE) {
					const tagName = (node as Element).tagName.toUpperCase();
					if (tagName === 'IMG' || tagName === 'IMAGE' || tagName === 'SVG') {
						return NodeFilter.FILTER_ACCEPT;
					}
					if (tagName === 'SCRIPT' || tagName === 'STYLE') {
						return NodeFilter.FILTER_REJECT;
					}
					return NodeFilter.FILTER_SKIP;
				}
				// Skip text nodes inside SVG elements
				let parent = node.parentElement;
				while (parent) {
					if (parent.tagName.toUpperCase() === 'SVG') {
						return NodeFilter.FILTER_REJECT;
					}
					parent = parent.parentElement;
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
			if (tagName === 'IMG' || tagName === 'IMAGE' || tagName === 'SVG') {
				// Mark image/SVG with its merged index
				const mergedIdx = rawToMergedIndex[rawWordIndex] ?? rawWordIndex + startWordIndex;
				(node as Element).setAttribute('data-word-index', String(mergedIdx));
				rawWordIndex++;
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
				// Word - split on dashes/ellipsis and wrap each with merged index
				const subWords = splitOnDashes(part);
				for (let i = 0; i < subWords.length; i++) {
					const subWord = subWords[i];
					const mergedIdx = rawToMergedIndex[rawWordIndex] ?? rawWordIndex + startWordIndex;

					const span = document.createElement('span');
					span.setAttribute('data-word-index', String(mergedIdx));
					span.textContent = subWord;
					fragment.appendChild(span);

					// Add space between split words
					if (i < subWords.length - 1) {
						fragment.appendChild(document.createTextNode(' '));
					}
					rawWordIndex++;
				}
			}
		}

		textNode.parentNode?.replaceChild(fragment, textNode);
	}

	// Return the count of merged words (not raw words)
	const finalWordCount = mergedWords.length;

	return {
		html: clone.innerHTML,
		wordCount: finalWordCount,
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
			// Resolve path to find file within EPUB archive
			let resolvedPath = src;

			if (src.startsWith('/')) {
				// Absolute path within EPUB - strip leading slash and try with package dir
				resolvedPath = packageDir + src.substring(1);
			} else if (src.startsWith('../') || src.startsWith('./') || !src.includes('://')) {
				// Relative path - resolve from chapter location
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
			if (!blob && archive?.zip?.file) {
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

			// Method 3: For absolute paths, try just stripping the leading slash
			if (!blob && archive?.zip?.file && src.startsWith('/')) {
				try {
					const pathWithoutSlash = src.substring(1);
					const zipFile = archive.zip.file(pathWithoutSlash);
					if (zipFile) {
						blob = await zipFile.async('blob');
					}
				} catch (e) {
					// Failed, try next method
				}
			}

			// Method 4: Try listing all files to find a match by filename (case-insensitive)
			if (!blob && archive?.zip?.files) {
				try {
					const files = archive.zip.files;
					// Get just the filename from the original src
					const fileName = src.split('/').pop()?.toLowerCase();
					if (fileName) {
						// Look for a file with matching name (case-insensitive)
						for (const path of Object.keys(files)) {
							const pathLower = path.toLowerCase();
							if (pathLower.endsWith('/' + fileName) || pathLower === fileName) {
								const zipFile = files[path];
								if (!zipFile.dir) {
									blob = await zipFile.async('blob');
									break;
								}
							}
						}
					}
				} catch (e) {
					// file search method failed
				}
			}

			// Method 5: Try common EPUB image directory patterns
			if (!blob && archive?.zip?.file) {
				const fileName = src.split('/').pop();
				const commonPaths = [
					`images/${fileName}`,
					`Images/${fileName}`,
					`OEBPS/images/${fileName}`,
					`OEBPS/Images/${fileName}`,
					`OPS/images/${fileName}`,
					`OPS/Images/${fileName}`,
					fileName // root level
				];
				for (const tryPath of commonPaths) {
					if (tryPath) {
						try {
							const zipFile = archive.zip.file(tryPath);
							if (zipFile) {
								blob = await zipFile.async('blob');
								break;
							}
						} catch (e) {
							// continue trying
						}
					}
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
 * Images that couldn't be resolved are replaced with placeholders to prevent external loading.
 * Uses DOM parsing for reliable handling of all image formats.
 */
function replaceImageUrls(html: string, urlMap: Map<string, string>): string {
	const placeholder = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

	// Parse HTML as a document fragment
	const parser = new DOMParser();
	const doc = parser.parseFromString(`<div>${html}</div>`, 'text/html');
	const container = doc.body.firstChild as Element;

	// Process all img elements
	container.querySelectorAll('img, IMG').forEach(img => {
		const src = img.getAttribute('src');
		if (src) {
			const blobUrl = urlMap.get(src);
			img.setAttribute('data-original-src', src);
			if (blobUrl) {
				img.setAttribute('src', blobUrl);
			} else {
				// Replace with placeholder and hide
				img.setAttribute('src', placeholder);
				img.setAttribute('data-missing', 'true');
				img.setAttribute('style', 'display:none');
			}
		}
	});

	// Process all SVG image elements (both xlink:href and href)
	container.querySelectorAll('image, IMAGE').forEach(img => {
		const src = img.getAttribute('xlink:href') || img.getAttribute('href');
		if (src) {
			const blobUrl = urlMap.get(src);
			img.setAttribute('data-original-src', src);
			if (blobUrl) {
				if (img.hasAttribute('xlink:href')) {
					img.setAttribute('xlink:href', blobUrl);
				}
				if (img.hasAttribute('href')) {
					img.setAttribute('href', blobUrl);
				}
			} else {
				// Replace with placeholder and hide
				if (img.hasAttribute('xlink:href')) {
					img.setAttribute('xlink:href', placeholder);
				}
				if (img.hasAttribute('href')) {
					img.setAttribute('href', placeholder);
				}
				img.setAttribute('data-missing', 'true');
				img.setAttribute('style', 'display:none');
			}
		}
	});

	return container.innerHTML;
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
			let markedWordCount = 0;
			if (contentElement) {
				const markedResult = injectWordMarkers(contentElement, chapterStartWord);
				markedHtml = markedResult.html;
				imageSrcs = markedResult.imageSrcs;
				markedWordCount = markedResult.wordCount;
			}

			// Process paragraph blocks with merging applied
			// Collect all words from all paragraphs for this chapter
			interface WordWithMeta {
				text: string;
				italic: boolean;
				bold: boolean;
				localParagraphIdx: number;  // 0-based within this chapter
			}
			const allChapterWords: WordWithMeta[] = [];
			let localParagraphIdx = 0;
			for (const block of paragraphBlocks) {
				for (const fw of block.words) {
					allChapterWords.push({
						text: fw.text,
						italic: fw.italic,
						bold: fw.bold,
						localParagraphIdx
					});
				}
				localParagraphIdx++;
			}

			// Apply punctuation merging across all text words in this chapter
			// This matches what injectWordMarkers does
			if (allChapterWords.length > 0) {
				const rawTexts = allChapterWords.map(w => w.text);
				const mergeResult = mergeOrphanedPunctuation(rawTexts);

				// Track paragraph transitions based on merged indices
				let prevMergedIdx = -1;
				let prevLocalParagraphIdx = -1;

				for (let rawIdx = 0; rawIdx < allChapterWords.length; rawIdx++) {
					const mergedIdx = mergeResult.indexMap[rawIdx];
					const wordMeta = allChapterWords[rawIdx];

					// Skip if this raw word was merged into previous
					if (mergedIdx === prevMergedIdx) {
						prevLocalParagraphIdx = wordMeta.localParagraphIdx;
						continue;
					}

					// New merged word - check if we're starting a new paragraph
					if (wordMeta.localParagraphIdx !== prevLocalParagraphIdx || prevMergedIdx === -1) {
						paragraphStarts.push(wordIndex);
					}

					const mergedText = mergeResult.words[mergedIdx];

					words.push({
						text: mergedText,
						paragraphIndex,
						pageIndex: currentPage,
						italic: wordMeta.italic || undefined,
						bold: wordMeta.bold || undefined
					});
					wordIndex++;
					wordsOnCurrentPage++;

					// Check for page break at paragraph boundaries
					if (wordMeta.localParagraphIdx !== prevLocalParagraphIdx && prevLocalParagraphIdx !== -1) {
						paragraphIndex++;
						// After each paragraph, check if we should start a new page
						if (wordsOnCurrentPage >= targetWordsPerPage) {
							currentPage++;
							pageStarts.push(wordIndex);
							wordsOnCurrentPage = 0;
						}
					}

					prevMergedIdx = mergedIdx;
					prevLocalParagraphIdx = wordMeta.localParagraphIdx;
				}

				// Increment paragraph index for the last paragraph
				if (prevLocalParagraphIdx !== -1) {
					paragraphIndex++;
				}
			}

			// For image-only chapters (no text words), add a placeholder entry
			// This ensures the chapter has a valid word range and can be navigated to
			// Images share the index of this placeholder word
			const textWordsAdded = wordIndex - chapterStartWord;
			if (textWordsAdded === 0 && imageSrcs.length > 0) {
				// Chapter has images but no text - add ONE placeholder entry
				paragraphStarts.push(wordIndex);
				words.push({
					text: '', // Empty text - will be skipped in RSVP display
					paragraphIndex,
					pageIndex: currentPage,
				});
				wordIndex++;
				wordsOnCurrentPage++;
				paragraphIndex++;

				// Force a page break after image-only chapters so they get their own page
				// This ensures the next chapter starts on a fresh page
				currentPage++;
				pageStarts.push(wordIndex);
				wordsOnCurrentPage = 0;
			}

			// Resolve image URLs and build chapter content
			let imageUrls = new Map<string, string>();
			if (imageSrcs.length > 0) {
				imageUrls = await resolveImageUrls(book, imageSrcs, spineItem.href || '');
			}
			// Always process images to replace unresolved ones with placeholders
			// This prevents 404 errors from external image loading attempts
			markedHtml = replaceImageUrls(markedHtml, imageUrls);

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
