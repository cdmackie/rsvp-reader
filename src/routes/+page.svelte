<script lang="ts">
	import { onMount } from 'svelte';
	import Redicle from '$lib/components/Redicle.svelte';
	import Controls from '$lib/components/Controls.svelte';
	import SpeedSlider from '$lib/components/SpeedSlider.svelte';
	import ProgressBar from '$lib/components/ProgressBar.svelte';
	import FileLoader from '$lib/components/FileLoader.svelte';
	import Settings from '$lib/components/Settings.svelte';
	import Preview from '$lib/components/Preview.svelte';

	import { currentTheme, settings } from '$lib/stores/settings';
	import { documentStore, isDocumentLoaded, isDocumentLoading, documentFileName, epubTitle, epubAuthor, isEpub, chapters } from '$lib/stores/document';
	import { reader, currentChapter } from '$lib/stores/reader';
	import { WPM_STEP, MIN_WPM, MAX_WPM } from '$lib/constants';
	import { parseFile } from '$lib/utils/adapters';
	import { generateFileKey, addRecentFile } from '$lib/utils/storage';

	let settingsOpen = $state(false);
	let mounted = $state(false);
	let loadingSample = $state<string | null>(null);

	// Sample files available for first-time users
	const sampleFiles = [
		{ name: 'welcome.txt', title: 'QuickReader Guide', description: 'Learn how to use RSVP speed reading' },
		{ name: 'the-signal.epub', title: 'The Signal (EPUB)', description: 'A sci-fi story with chapters' },
		{ name: 'alice-wonderland.azw3', title: 'Alice in Wonderland', description: 'Classic tale with illustrations' },
		{ name: 'short-story.txt', title: 'Short Story', description: 'A brief tale to practice with' }
	];

	// Set of sample file names for quick lookup
	const sampleFileNames = new Set(sampleFiles.map(s => s.name));

	async function loadSampleFile(filename: string) {
		if (loadingSample) return;
		loadingSample = filename;

		try {
			const response = await fetch(`/samples/${filename}`);
			if (!response.ok) {
				throw new Error(`Failed to load sample: ${response.statusText}`);
			}

			const blob = await response.blob();
			// Determine MIME type from extension if server doesn't provide one
			let mimeType = blob.type;
			if (!mimeType || mimeType === 'application/octet-stream') {
				const ext = filename.split('.').pop()?.toLowerCase();
				const mimeMap: Record<string, string> = {
					'epub': 'application/epub+zip',
					'pdf': 'application/pdf',
					'mobi': 'application/x-mobipocket-ebook',
					'azw': 'application/x-mobipocket-ebook',
					'azw3': 'application/x-mobipocket-ebook',
					'txt': 'text/plain',
					'md': 'text/markdown',
					'html': 'text/html',
					'htm': 'text/html'
				};
				mimeType = mimeMap[ext || ''] || 'application/octet-stream';
			}
			const file = new File([blob], filename, { type: mimeType });

			// Stop any active playback
			reader.pause();
			documentStore.setLoading(file.name);

			// Generate unique file key
			const fileKey = generateFileKey(file.name, file.size);

			// Parse file using adapter system
			const result = await parseFile(file);

			// Determine file type from extra data
			const fileType = (result.extra?.fileType as import('$lib/stores/document').FileType) || 'text';

			// Validate document has content
			if (!result.document.words || result.document.words.length === 0) {
				throw new Error('The file appears to be empty or contains no readable text.');
			}

			// Build the parsed document structure
			const parsedDocument = {
				...result.document,
				title: result.title,
				author: result.author,
				parseWarnings: result.warnings,
				...(result.preview ? {
					chapters: result.preview.chapters,
					chapterStarts: result.preview.chapterStarts,
					chapterContents: result.preview.chapterContents
				} : {})
			};

			// Set the document in store
			documentStore.setDocument(parsedDocument, file.name, fileKey, fileType);

			// Reset to beginning for sample files
			reader.setWordIndex(0);

			// Add to recent files
			addRecentFile({
				name: file.name,
				fileKey,
				lastOpened: Date.now(),
				totalWords: result.document.totalWords
			});
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : 'Failed to load sample file';
			documentStore.setError(errorMessage);
			console.error('Sample file loading error:', err);
		} finally {
			loadingSample = null;
		}
	}

	// Get current values from stores
	const theme = $derived($currentTheme);
	const docLoaded = $derived($isDocumentLoaded);
	const title = $derived($epubTitle);
	const author = $derived($epubAuthor);
	const isEpubFile = $derived($isEpub);
	const chapterList = $derived($chapters);
	const currentChapterIndex = $derived($currentChapter);
	const currentWpm = $derived($settings.wpm);
	const previewVisible = $derived($settings.previewVisible);
	const previewWidth = $derived($settings.previewWidth);
	const currentFileName = $derived($documentFileName);
	const isSampleFile = $derived(currentFileName ? sampleFileNames.has(currentFileName) : false);

	onMount(() => {
		mounted = true;
	});

	// Keyboard shortcuts
	function handleKeydown(event: KeyboardEvent) {
		// Don't handle if typing in an input or modal is open
		if (
			event.target instanceof HTMLInputElement ||
			event.target instanceof HTMLTextAreaElement ||
			event.target instanceof HTMLSelectElement ||
			settingsOpen
		) {
			return;
		}

		switch (event.key) {
			case ' ':
				event.preventDefault();
				reader.toggle();
				break;
			case 'ArrowLeft':
				event.preventDefault();
				if (event.ctrlKey || event.metaKey) {
					reader.prevParagraph();
				} else {
					reader.prevWord();
				}
				break;
			case 'ArrowRight':
				event.preventDefault();
				if (event.ctrlKey || event.metaKey) {
					reader.nextParagraph();
				} else {
					reader.nextWord();
				}
				break;
			case 'PageUp':
				event.preventDefault();
				reader.prevPage();
				break;
			case 'PageDown':
				event.preventDefault();
				reader.nextPage();
				break;
			case '[':
				event.preventDefault();
				settings.setWpm(Math.max(MIN_WPM, currentWpm - WPM_STEP));
				break;
			case ']':
				event.preventDefault();
				settings.setWpm(Math.min(MAX_WPM, currentWpm + WPM_STEP));
				break;
			case 'Home':
				event.preventDefault();
				reader.goToStart();
				break;
			case 'End':
				event.preventDefault();
				reader.goToEnd();
				break;
		}
	}

	function handleChapterChange(event: Event) {
		const select = event.target as HTMLSelectElement;
		const chapterIndex = parseInt(select.value, 10);
		if (!isNaN(chapterIndex)) {
			reader.goToChapter(chapterIndex);
		}
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<div
	class="app"
	style:--color-bg={theme.background}
	style:--color-text={theme.text}
	style:--color-orp={theme.orp}
	style:--color-guide={theme.guideLines}
	style:--color-controls-bg={theme.controlsBg}
	style:--color-controls-text={theme.controlsText}
>
	<header class="header">
		<div class="header-left">
			<h1 class="logo">QuickReader <span class="tagline">RSVP Speed Reader</span></h1>
		</div>
		<div class="header-right">
			{#if docLoaded && title}
				<span class="doc-info">
					{title}
					{#if author}
						<span class="author">by {author}</span>
					{/if}
				</span>
			{/if}
			<FileLoader />
			{#if docLoaded}
				<button
					class="preview-btn"
					class:active={previewVisible}
					onclick={() => settings.togglePreview()}
					aria-label={previewVisible ? "Hide preview panel" : "Show preview panel"}
					title={previewVisible ? "Hide preview" : "Show preview"}
				>
					<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
						<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
						<path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
					</svg>
				</button>
			{/if}
			<button class="settings-btn" onclick={() => (settingsOpen = true)} aria-label="Open settings">
				<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
					<circle cx="12" cy="12" r="3"></circle>
					<path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
				</svg>
			</button>
		</div>
	</header>

	<main class="main" class:with-preview={docLoaded && previewVisible} style:--preview-width="{previewWidth}%">
		{#if !docLoaded}
			<div class="welcome">
				<h2>Welcome to QuickReader</h2>
				<p>Load ebooks, documents, or text files to start speed reading.</p>
				<p class="hint">Click "Open File" above or try a sample below.</p>

				<div class="sample-files">
					<h3>Try a Sample</h3>
					<div class="sample-grid">
						{#each sampleFiles as sample}
							<button
								type="button"
								class="sample-card"
								onclick={() => loadSampleFile(sample.name)}
								disabled={loadingSample !== null}
							>
								{#if loadingSample === sample.name}
									<span class="sample-spinner"></span>
								{:else}
									<span class="sample-icon">
										{#if sample.name.endsWith('.epub') || sample.name.endsWith('.azw3') || sample.name.endsWith('.mobi')}
											<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
										{:else if sample.name.endsWith('.md')}
											<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
										{:else}
											<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><line x1="10" y1="9" x2="8" y2="9"></line></svg>
										{/if}
									</span>
								{/if}
								<span class="sample-title">{sample.title}</span>
								<span class="sample-desc">{sample.description}</span>
							</button>
						{/each}
					</div>
				</div>

				<div class="keyboard-hints">
					<h3>Keyboard Shortcuts</h3>
					<ul>
						<li><kbd>Space</kbd> Play/Pause</li>
						<li><kbd>←</kbd> / <kbd>→</kbd> Previous/Next word</li>
						<li><kbd>Ctrl</kbd>+<kbd>←</kbd> / <kbd>→</kbd> Previous/Next paragraph</li>
						<li><kbd>Page Up</kbd> / <kbd>Page Down</kbd> Previous/Next page</li>
						<li><kbd>[</kbd> / <kbd>]</kbd> Decrease/Increase speed</li>
						<li><kbd>Home</kbd> / <kbd>End</kbd> Go to start/end</li>
					</ul>
				</div>
			</div>
		{:else}
			<div class="reader-layout">
				<div class="reader-area">
					<Redicle />

					<div class="progress-section">
						<ProgressBar />
					</div>

					<div class="controls-section">
						{#if isEpubFile && chapterList.length > 0}
							<div class="chapter-section">
								<label for="chapter-select">Chapter:</label>
								<select id="chapter-select" onchange={handleChapterChange} value={currentChapterIndex}>
									{#each chapterList as chapter, index}
										<option value={index}>{chapter.title}</option>
									{/each}
								</select>
							</div>
						{/if}

						<Controls />

						<div class="speed-section">
							<SpeedSlider />
						</div>

						{#if isSampleFile}
							<div class="sample-switcher">
								<span class="sample-switcher-label">Try another sample:</span>
								<div class="sample-switcher-buttons">
									{#each sampleFiles as sample}
										<button
											type="button"
											class="sample-switch-btn"
											class:active={currentFileName === sample.name}
											onclick={() => loadSampleFile(sample.name)}
											disabled={loadingSample !== null || currentFileName === sample.name}
										>
											{#if loadingSample === sample.name}
												<span class="sample-switch-spinner"></span>
											{/if}
											{sample.title}
										</button>
									{/each}
								</div>
							</div>
						{/if}
					</div>
				</div>

				{#if previewVisible}
					<aside class="preview-panel">
						<Preview />
					</aside>
				{/if}
			</div>
		{/if}
	</main>

	<Settings open={settingsOpen} onClose={() => (settingsOpen = false)} />
</div>

<style>
	.app {
		min-height: 100vh;
		background-color: var(--color-bg);
		color: var(--color-text);
		display: flex;
		flex-direction: column;
		transition: background-color 0.3s ease, color 0.3s ease;
	}

	.header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 1rem 1.5rem;
		border-bottom: 1px solid var(--color-guide);
		flex-wrap: wrap;
		gap: 1rem;
	}

	.header-left {
		display: flex;
		align-items: center;
		gap: 1.5rem;
		flex-wrap: wrap;
	}

	.logo {
		font-size: 1.5rem;
		font-weight: 700;
		margin: 0;
	}

	.tagline {
		font-size: 0.9rem;
		font-weight: 400;
		opacity: 0.7;
		margin-left: 0.5rem;
	}

	.doc-info {
		font-size: 0.9rem;
		opacity: 0.8;
	}

	.author {
		opacity: 0.7;
		font-style: italic;
	}

	.header-right {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.settings-btn,
	.preview-btn {
		padding: 0.5rem;
		border-radius: 0.5rem;
		color: var(--color-text);
		background: var(--color-controls-bg);
		border: 1px solid var(--color-guide);
		transition: background-color 0.2s ease, transform 0.1s ease;
	}

	.settings-btn:hover,
	.preview-btn:hover {
		background: var(--color-guide);
	}

	.settings-btn:active,
	.preview-btn:active {
		transform: scale(0.95);
	}

	.preview-btn.active {
		background: var(--color-orp);
		color: var(--color-bg);
		border-color: var(--color-orp);
	}

	.preview-btn.active:hover {
		opacity: 0.9;
	}

	.main {
		flex: 1;
		display: flex;
		flex-direction: column;
		padding: 2rem 1.5rem;
		overflow: hidden;
	}

	.reader-layout {
		flex: 1;
		display: flex;
		flex-direction: column;
		min-height: 0;
	}

	.main.with-preview .reader-layout {
		display: grid;
		grid-template-columns: 1fr var(--preview-width, 35%);
		gap: 1.5rem;
	}

	.preview-panel {
		min-height: 0;
		overflow: hidden;
		display: flex;
		flex-direction: column;
	}

	.welcome {
		max-width: 600px;
		margin: auto;
		text-align: center;
	}

	.welcome h2 {
		font-size: 2rem;
		margin-bottom: 1rem;
	}

	.welcome p {
		font-size: 1.1rem;
		opacity: 0.8;
		margin-bottom: 0.5rem;
	}

	.welcome .hint {
		margin-top: 1.5rem;
		font-size: 0.95rem;
	}

	.sample-files {
		margin-top: 2rem;
		text-align: left;
	}

	.sample-files h3 {
		font-size: 1rem;
		margin-bottom: 1rem;
		opacity: 0.9;
		text-align: center;
	}

	.sample-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
		gap: 1rem;
	}

	.sample-card {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		padding: 1.25rem 1rem;
		background: var(--color-controls-bg);
		border: 1px solid var(--color-guide);
		border-radius: 0.75rem;
		cursor: pointer;
		transition: all 0.2s ease;
		text-align: center;
		font-family: inherit;
		color: var(--color-text);
	}

	.sample-card:hover:not(:disabled) {
		border-color: var(--color-orp);
		transform: translateY(-2px);
	}

	.sample-card:active:not(:disabled) {
		transform: translateY(0);
	}

	.sample-card:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.sample-icon {
		opacity: 0.7;
	}

	.sample-title {
		font-weight: 600;
		font-size: 0.95rem;
	}

	.sample-desc {
		font-size: 0.8rem;
		opacity: 0.7;
	}

	.sample-spinner {
		display: inline-block;
		width: 24px;
		height: 24px;
		border: 2px solid var(--color-guide);
		border-top-color: var(--color-orp);
		border-radius: 50%;
		animation: spin 0.6s linear infinite;
	}

	/* Sample switcher in reader view */
	.sample-switcher {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
		padding-top: 1rem;
		border-top: 1px solid var(--color-guide);
	}

	.sample-switcher-label {
		font-size: 0.85rem;
		opacity: 0.7;
	}

	.sample-switcher-buttons {
		display: flex;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.5rem;
	}

	.sample-switch-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.375rem 0.75rem;
		font-size: 0.8rem;
		font-family: inherit;
		background: var(--color-controls-bg);
		color: var(--color-text);
		border: 1px solid var(--color-guide);
		border-radius: 1rem;
		cursor: pointer;
		transition: all 0.2s ease;
	}

	.sample-switch-btn:hover:not(:disabled) {
		border-color: var(--color-orp);
	}

	.sample-switch-btn.active {
		background: var(--color-orp);
		color: var(--color-bg);
		border-color: var(--color-orp);
		cursor: default;
	}

	.sample-switch-btn:disabled:not(.active) {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.sample-switch-spinner {
		display: inline-block;
		width: 12px;
		height: 12px;
		border: 2px solid currentColor;
		border-right-color: transparent;
		border-radius: 50%;
		animation: spin 0.6s linear infinite;
	}

	.keyboard-hints {
		margin-top: 3rem;
		text-align: left;
		background: var(--color-controls-bg);
		padding: 1.5rem;
		border-radius: 0.75rem;
		border: 1px solid var(--color-guide);
	}

	.keyboard-hints h3 {
		font-size: 1rem;
		margin-bottom: 1rem;
		opacity: 0.9;
	}

	.keyboard-hints ul {
		list-style: none;
		display: grid;
		gap: 0.5rem;
	}

	.keyboard-hints li {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.9rem;
	}

	kbd {
		background: var(--color-bg);
		border: 1px solid var(--color-guide);
		border-radius: 0.25rem;
		padding: 0.15rem 0.4rem;
		font-size: 0.8rem;
		font-family: inherit;
	}

	.reader-area {
		flex: 1;
		display: flex;
		flex-direction: column;
		max-width: 900px;
		width: 100%;
		margin: 0 auto;
	}

	.progress-section {
		margin-top: 2rem;
	}

	.controls-section {
		margin-top: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.speed-section {
		display: flex;
		justify-content: center;
	}

	.chapter-section {
		display: flex;
		justify-content: center;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.9rem;
	}

	.chapter-section label {
		opacity: 0.8;
	}

	.chapter-section select {
		background: var(--color-controls-bg);
		color: var(--color-text);
		border: 1px solid var(--color-guide);
		border-radius: 0.375rem;
		padding: 0.375rem 0.75rem;
		max-width: 250px;
	}

	/* Responsive */
	@media (max-width: 1024px) {
		/* Hide preview panel on smaller screens */
		.preview-panel {
			display: none;
		}

		.preview-btn {
			display: none;
		}

		.main.with-preview .reader-layout {
			display: flex;
			flex-direction: column;
		}
	}

	@media (max-width: 768px) {
		.header {
			padding: 0.75rem 1rem;
		}

		.logo {
			font-size: 1.25rem;
		}

		.tagline {
			display: none;
		}

		.doc-info {
			display: none;
		}

		.main {
			padding: 1rem;
		}

		.welcome h2 {
			font-size: 1.5rem;
		}

		.keyboard-hints {
			display: none;
		}
	}

	@media (max-width: 480px) {
		.header-left {
			width: 100%;
			justify-content: center;
		}

		.header-right {
			width: 100%;
			justify-content: center;
		}

		.chapter-section {
			flex-wrap: wrap;
		}

		.chapter-section select {
			max-width: none;
			flex: 1;
			min-width: 150px;
		}
	}
</style>
