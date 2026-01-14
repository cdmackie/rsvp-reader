<script lang="ts">
	import { progress, currentWordIndex, currentPage, timeRemainingFormatted, lastReadPage, isAtLastRead, reader } from '../stores/reader';
	import { totalWords, totalPages } from '../stores/document';
	import { currentTheme } from '../stores/settings';

	let progressBarElement: HTMLDivElement | undefined = $state();

	// Derived values from stores
	const progressValue = $derived($progress);
	const wordIndex = $derived($currentWordIndex);
	const pageIndex = $derived($currentPage);
	const timeRemaining = $derived($timeRemainingFormatted);
	const words = $derived($totalWords);
	const pages = $derived($totalPages);
	const theme = $derived($currentTheme);
	const lastPage = $derived($lastReadPage);
	const atLastRead = $derived($isAtLastRead);

	/**
	 * Handle click on progress bar to jump to a specific position
	 */
	function handleClick(event: MouseEvent) {
		if (!progressBarElement || words === 0) return;

		const rect = progressBarElement.getBoundingClientRect();
		const clickX = event.clientX - rect.left;
		const percentage = Math.max(0, Math.min(1, clickX / rect.width));
		const targetWordIndex = Math.floor(percentage * (words - 1));

		reader.setWordIndex(targetWordIndex);
	}

	/**
	 * Handle keyboard navigation on progress bar
	 */
	function handleKeyDown(event: KeyboardEvent) {
		if (event.key === 'ArrowLeft') {
			event.preventDefault();
			const newIndex = Math.max(0, wordIndex - 10);
			reader.setWordIndex(newIndex);
		} else if (event.key === 'ArrowRight') {
			event.preventDefault();
			const newIndex = Math.min(words - 1, wordIndex + 10);
			reader.setWordIndex(newIndex);
		}
	}
</script>

<div class="progress-bar-container">
	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div
		bind:this={progressBarElement}
		class="progress-bar"
		role="slider"
		aria-valuenow={progressValue}
		aria-valuemin={0}
		aria-valuemax={100}
		aria-label="Reading progress - click or use arrow keys to navigate"
		tabindex="0"
		onclick={handleClick}
		onkeydown={handleKeyDown}
		style:--progress="{progressValue}%"
		style:--bg-color={theme.background}
		style:--text-color={theme.text}
		style:--accent-color={theme.orp}
		style:--guide-color={theme.guideLines}
	>
		<div class="progress-fill"></div>
	</div>

	<div class="progress-info">
		<span>Word {wordIndex + 1} of {words}</span>
		<span class="separator">|</span>
		<span>Page {pageIndex + 1} of {pages}</span>
		<span class="separator">|</span>
		<span>~{timeRemaining} remaining</span>
		{#if lastPage !== null}
			<span class="separator">|</span>
			<button
				type="button"
				class="last-read-btn"
				class:at-position={atLastRead}
				onclick={() => reader.goToLastRead()}
				title={atLastRead ? "You are at your last read position" : "Return to where you were reading"}
				disabled={atLastRead}
			>
				Last read: page {lastPage + 1}
			</button>
		{/if}
	</div>
</div>

<style>
	.progress-bar-container {
		width: 100%;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.progress-bar {
		width: 100%;
		height: 8px;
		background-color: var(--guide-color);
		border-radius: 4px;
		overflow: hidden;
		cursor: pointer;
		position: relative;
		transition: height 0.2s ease;
	}

	.progress-bar:hover {
		height: 12px;
	}

	.progress-bar:focus {
		outline: 2px solid var(--accent-color);
		outline-offset: 2px;
	}

	.progress-fill {
		height: 100%;
		width: var(--progress);
		background-color: var(--accent-color);
		transition: width 0.3s ease-out;
		position: relative;
	}

	.progress-fill::after {
		content: '';
		position: absolute;
		top: 0;
		right: 0;
		bottom: 0;
		width: 3px;
		background-color: var(--text-color);
		opacity: 0.5;
	}

	.progress-info {
		display: flex;
		justify-content: center;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.875rem;
		opacity: 0.8;
		flex-wrap: wrap;
		color: var(--color-text);
	}

	.separator {
		opacity: 0.5;
	}

	.last-read-btn {
		background: none;
		border: none;
		color: var(--accent-color);
		cursor: pointer;
		font-size: inherit;
		font-family: inherit;
		padding: 0;
		text-decoration: underline;
		text-decoration-style: dotted;
		opacity: 0.9;
		transition: opacity 0.15s ease;
	}

	.last-read-btn:hover:not(:disabled) {
		opacity: 1;
		text-decoration-style: solid;
	}

	.last-read-btn.at-position {
		color: inherit;
		text-decoration: none;
		cursor: default;
		opacity: 0.7;
	}

	@media (max-width: 640px) {
		.progress-info {
			font-size: 0.75rem;
			gap: 0.375rem;
		}

		.progress-bar {
			height: 6px;
		}

		.progress-bar:hover {
			height: 10px;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		.progress-fill,
		.progress-bar {
			transition: none;
		}
	}
</style>
