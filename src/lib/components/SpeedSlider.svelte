<script lang="ts">
	import { settings, currentTheme } from '../stores/settings';
	import { MIN_WPM, MAX_WPM, WPM_STEP } from '../constants';

	// Derived values from stores
	const wpm = $derived($settings.wpm);
	const theme = $derived($currentTheme);

	// Update store when slider changes
	function handleInput(event: Event) {
		const target = event.target as HTMLInputElement;
		settings.setWpm(parseInt(target.value, 10));
	}

	// Increment/decrement functions for +/- buttons
	function increment() {
		const newWpm = Math.min(wpm + WPM_STEP, MAX_WPM);
		settings.setWpm(newWpm);
	}

	function decrement() {
		const newWpm = Math.max(wpm - WPM_STEP, MIN_WPM);
		settings.setWpm(newWpm);
	}

	// Calculate slider fill percentage for visual feedback
	const fillPercentage = $derived(((wpm - MIN_WPM) / (MAX_WPM - MIN_WPM)) * 100);
</script>

<div class="speed-slider-container">
	<label for="speed-slider" class="speed-label">Speed:</label>

	<div class="slider-wrapper">
		<button
			class="adjust-btn"
			onclick={decrement}
			disabled={wpm <= MIN_WPM}
			aria-label="Decrease speed"
			type="button"
		>
			−
		</button>

		<div class="slider-track-container">
			<input
				id="speed-slider"
				type="range"
				min={MIN_WPM}
				max={MAX_WPM}
				step={WPM_STEP}
				value={wpm}
				oninput={handleInput}
				aria-label="Reading speed in words per minute"
				class="slider"
				style="--fill-percentage: {fillPercentage}%; --orp-color: {theme.orp}; --controls-bg: {theme.controlsBg}; --controls-text: {theme.controlsText};"
			/>
		</div>

		<button
			class="adjust-btn"
			onclick={increment}
			disabled={wpm >= MAX_WPM}
			aria-label="Increase speed"
			type="button"
		>
			+
		</button>
	</div>

	<span class="wpm-display" aria-live="polite">{wpm} WPM</span>
</div>

<style>
	.speed-slider-container {
		display: flex;
		align-items: center;
		gap: 1rem;
		width: 100%;
		max-width: 600px;
		margin: 0 auto;
	}

	.speed-label {
		font-weight: 600;
		font-size: 0.95rem;
		white-space: nowrap;
		color: var(--controls-text);
	}

	.slider-wrapper {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex: 1;
	}

	.adjust-btn {
		width: 32px;
		height: 32px;
		border-radius: 50%;
		border: 2px solid var(--orp-color);
		background: var(--controls-bg);
		color: var(--orp-color);
		font-size: 1.25rem;
		font-weight: bold;
		cursor: pointer;
		transition: all 0.2s ease;
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}

	.adjust-btn:hover:not(:disabled) {
		background: var(--orp-color);
		color: var(--controls-bg);
		transform: scale(1.1);
	}

	.adjust-btn:active:not(:disabled) {
		transform: scale(0.95);
	}

	.adjust-btn:disabled {
		opacity: 0.3;
		cursor: not-allowed;
	}

	.slider-track-container {
		flex: 1;
		position: relative;
	}

	.slider {
		-webkit-appearance: none;
		appearance: none;
		width: 100%;
		height: 8px;
		border-radius: 4px;
		background: linear-gradient(
			to right,
			var(--orp-color) 0%,
			var(--orp-color) var(--fill-percentage),
			var(--controls-bg) var(--fill-percentage),
			var(--controls-bg) 100%
		);
		outline: none;
		cursor: pointer;
		border: 1px solid rgba(128, 128, 128, 0.2);
	}

	/* Webkit browsers (Chrome, Safari, Edge) */
	.slider::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		width: 20px;
		height: 20px;
		border-radius: 50%;
		background: var(--orp-color);
		cursor: pointer;
		border: 2px solid var(--controls-bg);
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
		transition: all 0.2s ease;
	}

	.slider::-webkit-slider-thumb:hover {
		transform: scale(1.2);
		box-shadow: 0 3px 6px rgba(0, 0, 0, 0.3);
	}

	.slider::-webkit-slider-thumb:active {
		transform: scale(1.1);
	}

	/* Firefox */
	.slider::-moz-range-thumb {
		width: 20px;
		height: 20px;
		border-radius: 50%;
		background: var(--orp-color);
		cursor: pointer;
		border: 2px solid var(--controls-bg);
		box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
		transition: all 0.2s ease;
	}

	.slider::-moz-range-thumb:hover {
		transform: scale(1.2);
		box-shadow: 0 3px 6px rgba(0, 0, 0, 0.3);
	}

	.slider::-moz-range-thumb:active {
		transform: scale(1.1);
	}

	.slider::-moz-range-track {
		background: transparent;
		border: none;
	}

	.wpm-display {
		font-weight: 700;
		font-size: 1.1rem;
		min-width: 80px;
		text-align: right;
		color: var(--orp-color);
		white-space: nowrap;
	}

	/* Responsive adjustments */
	@media (max-width: 640px) {
		.speed-slider-container {
			flex-direction: column;
			align-items: stretch;
			gap: 0.5rem;
		}

		.speed-label {
			text-align: center;
		}

		.wpm-display {
			text-align: center;
			font-size: 1.25rem;
		}

		.slider-wrapper {
			width: 100%;
		}
	}

	@media (max-width: 400px) {
		.adjust-btn {
			width: 28px;
			height: 28px;
			font-size: 1.1rem;
		}

		.slider-wrapper {
			gap: 0.5rem;
		}
	}
</style>
