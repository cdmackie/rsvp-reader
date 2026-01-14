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
	import { documentStore, isDocumentLoaded, epubTitle, epubAuthor, isEpub, chapters } from '$lib/stores/document';
	import { reader, currentChapter } from '$lib/stores/reader';
	import { WPM_STEP, MIN_WPM, MAX_WPM } from '$lib/constants';

	let settingsOpen = $state(false);
	let mounted = $state(false);

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
			<h1 class="logo">RSVP Reader</h1>
			{#if docLoaded && title}
				<span class="doc-info">
					{title}
					{#if author}
						<span class="author">by {author}</span>
					{/if}
				</span>
			{/if}
		</div>
		<div class="header-right">
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
				<h2>Welcome to RSVP Speed Reader</h2>
				<p>Load an EPUB or text file to start reading.</p>
				<p class="hint">Click "Open File" above to get started.</p>
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
						<Controls />

						<div class="speed-section">
							<SpeedSlider />
						</div>

						{#if isEpubFile && chapterList.length > 0}
							<div class="meta-section">
								<div class="chapter-select">
									<label for="chapter-select">Chapter:</label>
									<select id="chapter-select" onchange={handleChapterChange} value={currentChapterIndex}>
										{#each chapterList as chapter, index}
											<option value={index}>{chapter.title}</option>
										{/each}
									</select>
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

	.meta-section {
		display: flex;
		justify-content: space-between;
		align-items: center;
		flex-wrap: wrap;
		gap: 1rem;
		font-size: 0.9rem;
	}

	.chapter-select {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.chapter-select label {
		opacity: 0.8;
	}

	.chapter-select select {
		background: var(--color-controls-bg);
		color: var(--color-text);
		border: 1px solid var(--color-guide);
		border-radius: 0.375rem;
		padding: 0.375rem 0.75rem;
		max-width: 200px;
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

		.meta-section {
			flex-direction: column;
			align-items: stretch;
			text-align: center;
		}

		.chapter-select {
			justify-content: center;
		}

		.chapter-select select {
			max-width: none;
			flex: 1;
		}
	}
</style>
