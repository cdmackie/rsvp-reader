<script lang="ts">
	import { reader, currentWordIndex, currentPage, isPlaying } from '../stores/reader';
	import { documentStore, totalPages, getPdfDocumentCache } from '../stores/document';
	import { currentTheme, settings } from '../stores/settings';
	import type { ParsedEpubWithContent, ChapterContent } from '../utils/epub-parser';
	import type { ParsedDocument } from '../utils/text-parser';
	import type { ParsedPdf } from '../utils/pdf-parser';
	import { getHiddenImages, hideImage, showAllImages } from '../utils/storage';

	// Reactive state
	const wordIndex = $derived($currentWordIndex);
	const pageIndex = $derived($currentPage);
	const pageCount = $derived($totalPages);
	const doc = $derived($documentStore);
	const theme = $derived($currentTheme);
	const playing = $derived($isPlaying);
	const pdfPreviewMode = $derived($settings.pdfPreviewMode);
	const isPdf = $derived(doc.fileType === 'pdf');

	// Canvas ref for rendered PDF mode
	let pdfCanvas: HTMLCanvasElement | undefined = $state();
	let pdfContainerRef: HTMLDivElement | undefined = $state();
	let pdfRenderScale = $state(1.5); // Render at higher res for quality
	let pdfTextLayerScale = $state(1); // Scale factor for text layer


	// Hidden images state
	let hiddenImages = $state<string[]>([]);
	let contextMenu = $state<{ x: number; y: number; imageSrc: string } | null>(null);

	// Load hidden images when document changes
	$effect(() => {
		if (doc.fileKey) {
			hiddenImages = getHiddenImages(doc.fileKey);
		} else {
			hiddenImages = [];
		}
	});

	// Get page boundaries from document
	const pageBounds = $derived.by((): [number, number] | null => {
		if (!doc.document) return null;

		const pageStarts = doc.document.pageStarts;
		if (!pageStarts || pageStarts.length === 0) return null;

		const startIdx = pageStarts[pageIndex] ?? 0;
		const endIdx = pageStarts[pageIndex + 1] !== undefined
			? pageStarts[pageIndex + 1] - 1
			: doc.document.totalWords - 1;

		return [startIdx, endIdx];
	});

	// Check if document has chapterContents (EPUB, Markdown, FB2, HTML, etc.)
	const hasChapterContents = $derived.by((): boolean => {
		if (!doc.document) return false;
		const docWithChapters = doc.document as ParsedEpubWithContent;
		return !!docWithChapters.chapterContents && docWithChapters.chapterContents.length > 0;
	});

	// For formats with chapterContents: Get current chapter's HTML and filter to current page
	const chapterPageHtml = $derived.by((): string | null => {
		if (!doc.document || doc.fileType === 'pdf' || !pageBounds || !hasChapterContents) return null;

		const docWithChapters = doc.document as ParsedEpubWithContent;
		if (!docWithChapters.chapterContents) return null;

		const [pageStart, pageEnd] = pageBounds;

		// Find chapter containing CURRENT WORD (not page start)
		// Use findLast() to get the latest chapter when word ranges overlap
		// (this can happen with image-only chapters that have no text words)
		const chapter = docWithChapters.chapterContents.findLast(
			c => wordIndex >= c.wordRange[0] && wordIndex <= c.wordRange[1]
		);

		if (!chapter?.htmlWithMarkers) return null;

		// Parse HTML and filter to only show words in current page range
		const parser = new DOMParser();
		const htmlDoc = parser.parseFromString(chapter.htmlWithMarkers, 'text/html');

		// Find all word spans and hide those outside page range
		// Exclude images - they should be visible for the entire page, not tied to a specific word
		const wordSpans = htmlDoc.querySelectorAll('[data-word-index]:not(img)');
		wordSpans.forEach(span => {
			const idx = parseInt(span.getAttribute('data-word-index') || '', 10);
			if (isNaN(idx) || idx < pageStart || idx > pageEnd) {
				// Hide words outside current page
				(span as HTMLElement).style.display = 'none';
			}
		});

		// Handle images separately - show if their word index is within page range
		const images = htmlDoc.querySelectorAll('img[data-word-index]');
		images.forEach(img => {
			const idx = parseInt(img.getAttribute('data-word-index') || '', 10);
			if (isNaN(idx) || idx < pageStart || idx > pageEnd) {
				(img as HTMLElement).style.display = 'none';
			}
		});

		// Hide images that user has marked as hidden
		const hiddenCheckImages = htmlDoc.querySelectorAll('img[data-original-src]');
		hiddenCheckImages.forEach(img => {
			const originalSrc = img.getAttribute('data-original-src');
			if (originalSrc && hiddenImages.includes(originalSrc)) {
				(img as HTMLElement).style.display = 'none';
			}
		});

		// Remove empty paragraphs/elements that have no visible content
		// BUT preserve elements that contain visible images/SVGs (for image-only pages like covers)
		const allElements = htmlDoc.body.querySelectorAll('p, li, h1, h2, h3, h4, h5, h6, div, blockquote, section, article');
		allElements.forEach(el => {
			const visibleWords = el.querySelectorAll('[data-word-index]:not([style*="display: none"])');
			const visibleImages = el.querySelectorAll('img:not([style*="display: none"]), svg:not([style*="display: none"])');
			if (visibleWords.length === 0 && visibleImages.length === 0) {
				(el as HTMLElement).style.display = 'none';
			}
		});

		return htmlDoc.body.innerHTML;
	});

	// For plain text: Generate HTML for the current page
	const textPageHtml = $derived.by((): string | null => {
		if (!doc.document || doc.fileType !== 'text' || !pageBounds) return null;

		const [startIdx, endIdx] = pageBounds;
		const words = doc.document.words;

		if (!words || words.length === 0) return null;

		// Group words by paragraph for proper formatting
		const paragraphs: Map<number, string[]> = new Map();

		for (let i = startIdx; i <= endIdx && i < words.length; i++) {
			const word = words[i];
			const pIdx = word.paragraphIndex;

			if (!paragraphs.has(pIdx)) {
				paragraphs.set(pIdx, []);
			}

			// Create span with word index and styling
			let wordHtml = `<span data-word-index="${i}"`;
			const styles: string[] = [];
			if (word.italic) styles.push('font-style: italic');
			if (word.bold) styles.push('font-weight: bold');
			if (styles.length > 0) wordHtml += ` style="${styles.join('; ')}"`;
			wordHtml += `>${escapeHtml(word.text)}</span>`;

			paragraphs.get(pIdx)!.push(wordHtml);
		}

		// Build HTML from paragraphs
		const sortedParas = Array.from(paragraphs.entries()).sort((a, b) => a[0] - b[0]);
		return sortedParas.map(([_, wordList]) => `<p>${wordList.join(' ')}</p>`).join('\n');
	});

	// For PDF: Get current page's HTML from chapterContents (unified with EPUB after adapter refactor)
	const pdfPageHtml = $derived.by((): string | null => {
		if (!doc.document || doc.fileType !== 'pdf' || !pageBounds) return null;

		// After the adapter refactor, PDF uses chapterContents like EPUB
		const pdfDoc = doc.document as ParsedEpubWithContent;
		if (!pdfDoc.chapterContents) return null;

		// Find page content for current page
		const pageContent = pdfDoc.chapterContents.findLast(
			c => wordIndex >= c.wordRange[0] && wordIndex <= c.wordRange[1]
		);

		return pageContent?.htmlWithMarkers || null;
	});

	// Combined preview HTML (chapterPageHtml handles EPUB, Markdown, FB2, HTML, etc.)
	const pagePreviewHtml = $derived(chapterPageHtml || pdfPageHtml || textPageHtml);

	// Escape HTML special characters
	function escapeHtml(text: string): string {
		return text
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#039;');
	}

	// Highlight current word (no scroll - just highlight)
	$effect(() => {
		// Capture wordIndex before setTimeout so Svelte tracks the dependency
		const currentIdx = wordIndex;

		// Use a small delay to ensure DOM is updated after page change
		const timeout = setTimeout(() => {
			const container = document.querySelector('.preview-content');
			if (!container) return;

			// Remove previous highlight
			const prev = container.querySelector('[data-word-index].current');
			prev?.classList.remove('current');

			// Add new highlight
			const current = container.querySelector(`[data-word-index="${currentIdx}"]`);
			if (current) {
				current.classList.add('current');
			}
		}, 0);

		return () => clearTimeout(timeout);
	});

	// Handle click on words to navigate
	function handleWordNavigation(target: HTMLElement) {
		const wordSpan = target.closest('[data-word-index]');

		if (wordSpan) {
			const index = parseInt(wordSpan.getAttribute('data-word-index') || '', 10);
			if (!isNaN(index)) {
				reader.setWordIndex(index);
			}
		}
	}

	function handleClick(event: MouseEvent) {
		handleWordNavigation(event.target as HTMLElement);
	}

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			handleWordNavigation(event.target as HTMLElement);
		}
	}

	// Context menu for images
	function handleContextMenu(event: MouseEvent) {
		const target = event.target as HTMLElement;
		const img = target.closest('img');

		if (img) {
			const originalSrc = img.getAttribute('data-original-src');
			if (originalSrc) {
				event.preventDefault();
				contextMenu = {
					x: event.clientX,
					y: event.clientY,
					imageSrc: originalSrc
				};
			}
		}
	}

	function handleHideImage() {
		if (contextMenu && doc.fileKey) {
			hideImage(doc.fileKey, contextMenu.imageSrc);
			hiddenImages = getHiddenImages(doc.fileKey);
			contextMenu = null;
		}
	}

	function handleShowAllImages() {
		if (doc.fileKey) {
			showAllImages(doc.fileKey);
			hiddenImages = [];
			contextMenu = null;
		}
	}

	function closeContextMenu() {
		contextMenu = null;
	}

	// Toggle PDF preview mode
	function togglePdfMode() {
		settings.togglePdfPreviewMode();
	}

	// Reference to text layer container
	let textLayerRef: HTMLDivElement | undefined = $state();

	// Render PDF page to canvas when in rendered mode
	$effect(() => {
		if (!isPdf || pdfPreviewMode !== 'rendered' || !pdfCanvas) return;

		const fileKey = doc.fileKey;
		if (!fileKey) return;

		// Get the actual page number (1-indexed for pdf.js)
		const pdfPageNum = pageIndex + 1;

		// Get cached PDF document
		const cachedPdf = getPdfDocumentCache(fileKey);
		if (!cachedPdf) return;

		// Get word index range for this page from parsed document
		const pdfDoc = doc.document as ParsedPdf;
		const pageStarts = pdfDoc?.pageStarts || [];
		const pageStartWordIndex = pageStarts[pageIndex] ?? 0;

		// Render the page and build text layer
		(async () => {
			try {
				const page = await cachedPdf.getPage(pdfPageNum);
				const viewport = page.getViewport({ scale: pdfRenderScale });

				pdfCanvas.width = viewport.width;
				pdfCanvas.height = viewport.height;

				const ctx = pdfCanvas.getContext('2d');
				if (ctx) {
					await page.render({
						canvasContext: ctx,
						viewport
					}).promise;
				}

				// Build text overlay manually with correct positioning
				const textContent = await page.getTextContent();

				if (textLayerRef) {
					// Clear previous content and set dimensions to match canvas
					textLayerRef.innerHTML = '';

					// Store canvas dimensions for scaling
					const canvasWidth = viewport.width;
					const canvasHeight = viewport.height;

					let wordCounter = 0;

					for (const item of textContent.items) {
						if (!('str' in item) || !item.str.trim()) continue;

						const str = item.str;
						const tx = item.transform;

						// Get font height from transform matrix
						const fontHeight = Math.sqrt(tx[2] * tx[2] + tx[3] * tx[3]);
						const scaledHeight = fontHeight * viewport.scale;

						// Convert PDF coordinates (origin bottom-left) to screen (origin top-left)
						// tx[4] = x position, tx[5] = y position from bottom
						const x = tx[4] * viewport.scale;
						const y = viewport.height - (tx[5] * viewport.scale) - scaledHeight;

						// Create a positioned span for this text item
						const itemSpan = document.createElement('span');
						itemSpan.style.cssText = `
							position: absolute;
							left: ${x}px;
							top: ${y}px;
							font-size: ${scaledHeight}px;
							font-family: sans-serif;
							white-space: pre;
							color: transparent;
						`;

						// Split into words and create clickable spans
						const words = str.split(/(\s+)/);
						words.forEach(part => {
							if (!part) return;
							if (/^\s+$/.test(part)) {
								// Whitespace - just add it
								itemSpan.appendChild(document.createTextNode(part));
							} else {
								// Word - make it clickable
								const wordSpan = document.createElement('span');
								wordSpan.textContent = part;
								wordSpan.dataset.wordIndex = String(pageStartWordIndex + wordCounter);
								wordSpan.className = 'pdf-word';
								itemSpan.appendChild(wordSpan);
								wordCounter++;
							}
						});

						textLayerRef.appendChild(itemSpan);
					}

					// Calculate scale after canvas is displayed
					requestAnimationFrame(() => {
						if (pdfCanvas && textLayerRef) {
							const displayedWidth = pdfCanvas.clientWidth;
							const scale = displayedWidth / canvasWidth;
							pdfTextLayerScale = scale;
							textLayerRef.style.width = `${canvasWidth}px`;
							textLayerRef.style.height = `${canvasHeight}px`;
							textLayerRef.style.transform = `scale(${scale})`;
							textLayerRef.style.transformOrigin = 'top left';
						}
					});
				}

			} catch (err) {
				console.error('Failed to render PDF page:', err);
			}
		})();
	});

	// Highlight current word in PDF text layer
	$effect(() => {
		if (!isPdf || pdfPreviewMode !== 'rendered' || !textLayerRef) return;

		// Remove previous highlight
		const prev = textLayerRef.querySelector('.pdf-word.current');
		prev?.classList.remove('current');

		// Add highlight to current word
		const current = textLayerRef.querySelector(`[data-word-index="${wordIndex}"]`);
		current?.classList.add('current');
	});

	// Handle mouse wheel scrolling - advance pages when at top/bottom
	function handleWheel(event: WheelEvent) {
		const target = event.currentTarget as HTMLElement;
		const { scrollTop, scrollHeight, clientHeight } = target;

		// Check if content is scrollable
		const isScrollable = scrollHeight > clientHeight + 10;
		const atBottom = !isScrollable || (scrollTop + clientHeight >= scrollHeight - 10);
		const atTop = !isScrollable || scrollTop <= 10;

		if (event.deltaY > 0 && atBottom && pageIndex < pageCount - 1) {
			// Scrolling down at bottom - go to next page
			event.preventDefault();
			reader.nextPage();
		} else if (event.deltaY < 0 && atTop && pageIndex > 0) {
			// Scrolling up at top - go to previous page
			event.preventDefault();
			reader.prevPage();
		}
	}

	// Close context menu on click outside
	function handleDocumentClick(event: MouseEvent) {
		if (contextMenu) {
			const target = event.target as HTMLElement;
			if (!target.closest('.context-menu')) {
				contextMenu = null;
			}
		}
	}
</script>

<div
	class="preview-container"
	class:is-playing={playing}
	style:--text-color={theme.text}
	style:--bg-color={theme.background}
	style:--orp-color={theme.orp}
	style:--guide-color={theme.guideLines}
>
	<div class="preview-header">
		<span class="preview-title">Page {pageIndex + 1} of {pageCount}</span>
		{#if isPdf}
			<button
				type="button"
				class="mode-toggle"
				onclick={togglePdfMode}
				title={pdfPreviewMode === 'text' ? 'Switch to rendered preview' : 'Switch to text preview'}
			>
				{pdfPreviewMode === 'text' ? '📄' : '🖼️'}
				<span class="mode-label">{pdfPreviewMode === 'text' ? 'Text' : 'Rendered'}</span>
			</button>
		{/if}
	</div>

	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_noninteractive_element_interactions a11y_no_noninteractive_tabindex -->
	<div
		class="preview-content"
		onclick={handleClick}
		onkeydown={handleKeydown}
		oncontextmenu={handleContextMenu}
		onwheel={handleWheel}
		tabindex="0"
		role="application"
		aria-label="Page preview. Click on any word to navigate to it. Scroll to change pages."
	>
		<div class="page-box">
			{#if isPdf && pdfPreviewMode === 'rendered'}
				<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
				<div
					bind:this={pdfContainerRef}
					class="pdf-rendered-container"
					class:is-playing={playing}
					onclick={(e) => {
						const target = e.target as HTMLElement;
						const wordSpan = target.closest('[data-word-index]');
						if (wordSpan) {
							const idx = parseInt(wordSpan.getAttribute('data-word-index') || '', 10);
							if (!isNaN(idx)) reader.setWordIndex(idx);
						}
					}}
				>
					<canvas bind:this={pdfCanvas} class="pdf-canvas"></canvas>
					<div bind:this={textLayerRef} class="pdf-text-layer"></div>
				</div>
			{:else if pagePreviewHtml}
				{@html pagePreviewHtml}
			{:else if !doc.document}
				<p class="preview-message">Load a document to see preview</p>
			{:else}
				<p class="preview-message">No preview available</p>
			{/if}
		</div>
	</div>
</div>

<!-- Context menu for hiding images -->
{#if contextMenu}
	<!-- svelte-ignore a11y_click_events_have_key_events a11y_no_static_element_interactions -->
	<div
		class="context-menu"
		style:left="{contextMenu.x}px"
		style:top="{contextMenu.y}px"
		style:--bg-color={theme.controlsBg}
		style:--text-color={theme.controlsText}
		style:--border-color={theme.guideLines}
	>
		<button class="context-menu-item" onclick={handleHideImage}>
			Hide this image
		</button>
		{#if hiddenImages.length > 0}
			<button class="context-menu-item" onclick={handleShowAllImages}>
				Show all hidden images ({hiddenImages.length})
			</button>
		{/if}
	</div>
{/if}

<svelte:window onclick={handleDocumentClick} />

<style>
	.preview-container {
		display: flex;
		flex-direction: column;
		height: 100%;
		background-color: var(--bg-color);
		color: var(--text-color);
		border-radius: 8px;
		overflow: hidden;
	}

	.preview-header {
		padding: 0.75rem 1rem;
		border-bottom: 1px solid var(--guide-color);
		flex-shrink: 0;
		display: flex;
		justify-content: space-between;
		align-items: center;
	}

	.preview-title {
		font-size: 0.875rem;
		font-weight: 600;
		opacity: 0.7;
		text-transform: uppercase;
		letter-spacing: 0.05em;
	}

	.mode-toggle {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.25rem 0.5rem;
		background: rgba(128, 128, 128, 0.2);
		border: 1px solid var(--guide-color);
		border-radius: 4px;
		color: var(--text-color);
		font-size: 0.75rem;
		cursor: pointer;
		transition: background-color 0.15s ease;
	}

	.mode-toggle:hover {
		background: rgba(128, 128, 128, 0.3);
	}

	.mode-label {
		font-weight: 500;
	}

	.preview-content {
		flex: 1;
		overflow-y: auto;
		padding: 1rem;
		display: flex;
		justify-content: center;
		align-items: flex-start;
	}

	.page-box {
		background: var(--bg-color);
		border: 1px solid var(--guide-color);
		border-radius: 4px;
		padding: 1.5rem;
		max-width: 100%;
		width: 100%;
		min-height: 300px;
		box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
		font-size: 0.9rem;
		line-height: 1.7;
	}

	/* Style for word spans */
	.page-box :global([data-word-index]) {
		cursor: pointer;
		border-radius: 2px;
		padding: 0 1px;
		transition: background-color 0.15s ease;
	}

	.page-box :global([data-word-index]:hover) {
		background-color: rgba(128, 128, 128, 0.2);
	}

	/* Current word highlight - bright when paused */
	.page-box :global([data-word-index].current) {
		background-color: var(--orp-color);
		color: var(--bg-color);
		padding: 0 2px;
		font-weight: 600;
	}

	/* Subtle highlight when actively reading - not distracting in peripheral vision */
	.preview-container.is-playing .page-box :global([data-word-index].current) {
		background-color: rgba(128, 128, 128, 0.15);
		color: inherit;
		font-weight: inherit;
	}

	/* Paragraph styling */
	.page-box :global(p) {
		margin: 0 0 1em 0;
	}

	.page-box :global(p:last-child) {
		margin-bottom: 0;
	}

	/* Header styling */
	.page-box :global(h1),
	.page-box :global(h2),
	.page-box :global(h3),
	.page-box :global(h4),
	.page-box :global(h5),
	.page-box :global(h6) {
		margin: 1.5em 0 0.5em 0;
		font-weight: 600;
		line-height: 1.3;
	}

	.page-box :global(h1) { font-size: 1.5em; }
	.page-box :global(h2) { font-size: 1.3em; }
	.page-box :global(h3) { font-size: 1.15em; }
	.page-box :global(h4),
	.page-box :global(h5),
	.page-box :global(h6) { font-size: 1em; }

	.page-box :global(h1:first-child),
	.page-box :global(h2:first-child),
	.page-box :global(h3:first-child) {
		margin-top: 0;
	}

	/* Code styling */
	.page-box :global(code) {
		font-family: 'SF Mono', 'Monaco', 'Consolas', monospace;
		font-size: 0.85em;
		background: rgba(128, 128, 128, 0.15);
		padding: 0.15em 0.4em;
		border-radius: 3px;
	}

	.page-box :global(pre) {
		background: rgba(0, 0, 0, 0.3);
		padding: 1em;
		border-radius: 6px;
		overflow-x: auto;
		margin: 1em 0;
	}

	.page-box :global(pre code) {
		background: none;
		padding: 0;
		font-size: 0.8em;
		line-height: 1.5;
		white-space: pre;
	}

	/* Blockquote styling */
	.page-box :global(blockquote) {
		margin: 1em 0;
		padding: 0.5em 1em;
		border-left: 3px solid var(--orp-color);
		background: rgba(128, 128, 128, 0.1);
		font-style: italic;
	}

	/* List styling */
	.page-box :global(ul),
	.page-box :global(ol) {
		margin: 0.5em 0;
		padding-left: 1.5em;
	}

	.page-box :global(li) {
		margin: 0.25em 0;
	}

	/* Link styling */
	.page-box :global(a) {
		color: var(--orp-color);
		text-decoration: underline;
	}

	/* Horizontal rule */
	.page-box :global(hr) {
		border: none;
		border-top: 1px solid var(--guide-color);
		margin: 1.5em 0;
	}

	/* Image styling - fit within preview box */
	.page-box :global(img) {
		max-width: 100%;
		height: auto;
		display: block;
		margin: 0 auto;
	}

	/* PDF rendered container with overlay */
	.pdf-rendered-container {
		position: relative;
		margin: 0 auto;
		max-width: 100%;
		display: inline-block;
	}

	/* PDF canvas for rendered mode */
	.pdf-canvas {
		display: block;
		max-width: 100%;
		height: auto;
	}

	/* PDF text layer - positioned on top of canvas */
	.pdf-text-layer {
		position: absolute;
		top: 0;
		left: 0;
		/* Width, height, and transform set dynamically to match canvas */
		overflow: visible;
		pointer-events: none;
	}

	/* Word spans for click handling */
	.pdf-text-layer :global(.pdf-word) {
		pointer-events: auto;
		cursor: pointer;
		border-radius: 2px;
	}

	.pdf-text-layer :global(.pdf-word:hover) {
		background-color: rgba(255, 255, 0, 0.3);
	}

	/* Current word highlight - bright when paused */
	.pdf-text-layer :global(.pdf-word.current) {
		background-color: var(--orp-color);
		opacity: 0.7;
	}

	/* Subtle highlight when actively reading */
	.pdf-rendered-container.is-playing .pdf-text-layer :global(.pdf-word.current) {
		background-color: rgba(128, 128, 128, 0.3);
		opacity: 1;
	}

	.preview-message {
		opacity: 0.5;
		font-style: italic;
		text-align: center;
		padding: 2rem;
	}

	/* Scrollbar styling */
	.preview-content::-webkit-scrollbar {
		width: 8px;
	}

	.preview-content::-webkit-scrollbar-track {
		background: transparent;
	}

	.preview-content::-webkit-scrollbar-thumb {
		background-color: var(--guide-color);
		border-radius: 4px;
	}

	.preview-content::-webkit-scrollbar-thumb:hover {
		background-color: var(--text-color);
		opacity: 0.5;
	}

	/* Context menu styling */
	.context-menu {
		position: fixed;
		background: var(--bg-color);
		border: 1px solid var(--border-color);
		border-radius: 6px;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
		padding: 0.25rem;
		z-index: 1000;
		min-width: 180px;
	}

	.context-menu-item {
		display: block;
		width: 100%;
		padding: 0.5rem 0.75rem;
		border: none;
		background: transparent;
		color: var(--text-color);
		text-align: left;
		cursor: pointer;
		border-radius: 4px;
		font-size: 0.875rem;
	}

	.context-menu-item:hover {
		background: rgba(128, 128, 128, 0.2);
	}
</style>
