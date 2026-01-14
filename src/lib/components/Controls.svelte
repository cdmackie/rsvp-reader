<script lang="ts">
	import { reader, isPlaying, currentWordIndex } from '../stores/reader';
	import { totalWords } from '../stores/document';
	import { currentTheme } from '../stores/settings';

	// Derived store values
	const playing = $derived($isPlaying);
	const wordIndex = $derived($currentWordIndex);
	const total = $derived($totalWords);
	const theme = $derived($currentTheme);

	// Computed disabled states
	const atStart = $derived(wordIndex <= 0);
	const atEnd = $derived(total === 0 || wordIndex >= total - 1);
	const noDocument = $derived(total === 0);
</script>

<div
	class="controls"
	style:--bg-color={theme.controlsBg}
	style:--text-color={theme.controlsText}
	style:--accent-color={theme.orp}
	style:--border-color={theme.guideLines}
>
	<button
		class="control-btn"
		onclick={() => reader.goToStart()}
		disabled={atStart || noDocument}
		aria-label="Go to start"
		title="Go to start (Home)"
	>
		<span class="btn-icon">|◀</span>
	</button>

	<button
		class="control-btn"
		onclick={() => reader.prevPage()}
		disabled={atStart || noDocument}
		aria-label="Previous page"
		title="Previous page (Page Up)"
	>
		<span class="btn-icon">◀◀</span>
	</button>

	<button
		class="control-btn"
		onclick={() => reader.prevWord()}
		disabled={atStart || noDocument}
		aria-label="Previous word"
		title="Previous word (←)"
	>
		<span class="btn-icon">◀</span>
	</button>

	<button
		class="control-btn play-btn"
		onclick={() => reader.toggle()}
		disabled={noDocument}
		aria-label={playing ? 'Pause' : 'Play'}
		title={playing ? 'Pause (Space)' : 'Play (Space)'}
	>
		<span class="btn-icon">{playing ? '❚❚' : '▶'}</span>
	</button>

	<button
		class="control-btn"
		onclick={() => reader.nextWord()}
		disabled={atEnd || noDocument}
		aria-label="Next word"
		title="Next word (→)"
	>
		<span class="btn-icon">▶</span>
	</button>

	<button
		class="control-btn"
		onclick={() => reader.nextPage()}
		disabled={atEnd || noDocument}
		aria-label="Next page"
		title="Next page (Page Down)"
	>
		<span class="btn-icon">▶▶</span>
	</button>

	<button
		class="control-btn"
		onclick={() => reader.goToEnd()}
		disabled={atEnd || noDocument}
		aria-label="Go to end"
		title="Go to end (End)"
	>
		<span class="btn-icon">▶|</span>
	</button>
</div>

<style>
	.controls {
		display: flex;
		justify-content: center;
		align-items: center;
		gap: 0.5rem;
		padding: 1rem;
		flex-wrap: wrap;
	}

	.control-btn {
		min-width: 3rem;
		min-height: 3rem;
		padding: 0.75rem 1rem;
		background: var(--bg-color);
		color: var(--text-color);
		border: 2px solid var(--border-color);
		border-radius: 0.5rem;
		font-size: 1.25rem;
		font-weight: bold;
		cursor: pointer;
		transition: all 0.2s ease;
		user-select: none;
		-webkit-tap-highlight-color: transparent;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.control-btn:hover:not(:disabled) {
		background: var(--border-color);
		transform: scale(1.05);
	}

	.control-btn:active:not(:disabled) {
		transform: scale(0.95);
	}

	.control-btn:disabled {
		opacity: 0.3;
		cursor: not-allowed;
	}

	.control-btn.play-btn {
		background: var(--accent-color);
		border-color: var(--accent-color);
		color: var(--bg-color);
		min-width: 4rem;
		min-height: 4rem;
		font-size: 1.5rem;
	}

	.control-btn.play-btn:hover:not(:disabled) {
		filter: brightness(1.2);
		transform: scale(1.1);
	}

	.btn-icon {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		line-height: 1;
	}

	@media (max-width: 640px) {
		.controls {
			gap: 0.375rem;
			padding: 0.75rem;
		}

		.control-btn {
			min-width: 2.5rem;
			min-height: 2.5rem;
			padding: 0.5rem 0.75rem;
			font-size: 1rem;
		}

		.control-btn.play-btn {
			min-width: 3.5rem;
			min-height: 3.5rem;
			font-size: 1.25rem;
		}
	}

	@media (min-width: 641px) and (max-width: 1024px) {
		.control-btn {
			min-width: 3.5rem;
			min-height: 3.5rem;
		}

		.control-btn.play-btn {
			min-width: 4.5rem;
			min-height: 4.5rem;
		}
	}

	.control-btn:focus-visible {
		outline: 3px solid var(--accent-color);
		outline-offset: 2px;
	}

	@media (prefers-reduced-motion: reduce) {
		.control-btn {
			transition: none;
		}

		.control-btn:hover:not(:disabled),
		.control-btn:active:not(:disabled) {
			transform: none;
		}
	}
</style>
