<script lang="ts">
	import { settings, currentTheme } from '../stores/settings';
	import { THEMES, FONT_FAMILIES, MIN_FONT_SIZE, MAX_FONT_SIZE, FONT_SIZE_STEP } from '../constants';

	interface Props {
		open: boolean;
		onClose: () => void;
	}

	let { open, onClose }: Props = $props();

	// Derived store values
	const settingsValue = $derived($settings);
	const theme = $derived($currentTheme);

	// Focus trap refs
	let dialogElement: HTMLDivElement | undefined = $state();

	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Escape' && open) {
			event.preventDefault();
			onClose();
		}
	}

	function handleOverlayClick(event: MouseEvent) {
		if (event.target === event.currentTarget) {
			onClose();
		}
	}

	function handleOverlayKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			onClose();
		}
	}

	// Handle focus when modal opens
	$effect(() => {
		if (open && dialogElement) {
			const firstFocusable = dialogElement.querySelector<HTMLElement>(
				'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
			);
			const timer = setTimeout(() => firstFocusable?.focus(), 0);
			return () => clearTimeout(timer);
		}
	});

	// Setting update handlers
	function handleThemeChange(event: Event) {
		const target = event.target as HTMLSelectElement;
		settings.setTheme(target.value);
	}

	function handleFontSizeChange(event: Event) {
		const target = event.target as HTMLInputElement;
		settings.setFontSize(Number(target.value));
	}

	function handleFontFamilyChange(event: Event) {
		const target = event.target as HTMLSelectElement;
		settings.setFontFamily(target.value);
	}

	function handlePauseOnPunctuationChange(event: Event) {
		const target = event.target as HTMLInputElement;
		settings.update(s => ({ ...s, pauseOnPunctuation: target.checked }));
	}

	function handlePunctuationDelayChange(event: Event) {
		const target = event.target as HTMLInputElement;
		settings.update(s => ({ ...s, punctuationDelayMultiplier: Number(target.value) }));
	}

	function handleLongWordDelayChange(event: Event) {
		const target = event.target as HTMLInputElement;
		settings.update(s => ({ ...s, longWordDelayMultiplier: Number(target.value) }));
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if open}
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div
		class="modal-overlay"
		role="dialog"
		aria-modal="true"
		aria-labelledby="settings-title"
		onclick={handleOverlayClick}
		onkeydown={handleOverlayKeydown}
		tabindex="-1"
	>
		<div
			bind:this={dialogElement}
			class="settings-panel"
			style:background-color={theme.controlsBg}
			style:color={theme.controlsText}
		>
			<div class="settings-header">
				<h2 id="settings-title">Settings</h2>
				<button
					class="close-button"
					onclick={onClose}
					aria-label="Close settings"
				>
					<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
						<line x1="18" y1="6" x2="6" y2="18"></line>
						<line x1="6" y1="6" x2="18" y2="18"></line>
					</svg>
				</button>
			</div>

			<div class="settings-content">
				<!-- Theme Selector -->
				<section class="setting-group">
					<label for="theme-select" class="setting-label">Theme</label>
					<select
						id="theme-select"
						value={settingsValue.themeName}
						onchange={handleThemeChange}
						class="setting-select"
						style:background-color={theme.background}
						style:color={theme.text}
						style:border-color={theme.guideLines}
					>
						{#each Object.entries(THEMES) as [key, themeOption]}
							<option value={key}>{themeOption.name}</option>
						{/each}
					</select>
				</section>

				<!-- Font Size -->
				<section class="setting-group">
					<div class="setting-label-row">
						<label for="font-size-slider" class="setting-label">Font Size</label>
						<span class="setting-value">{settingsValue.fontSize}px</span>
					</div>
					<input
						id="font-size-slider"
						type="range"
						min={MIN_FONT_SIZE}
						max={MAX_FONT_SIZE}
						step={FONT_SIZE_STEP}
						value={settingsValue.fontSize}
						oninput={handleFontSizeChange}
						class="setting-slider"
						style:--slider-track-color={theme.guideLines}
						style:--slider-thumb-color={theme.orp}
					/>
					<div class="setting-range-labels">
						<span>{MIN_FONT_SIZE}px</span>
						<span>{MAX_FONT_SIZE}px</span>
					</div>
				</section>

				<!-- Font Family -->
				<section class="setting-group">
					<label for="font-family-select" class="setting-label">Font Family</label>
					<select
						id="font-family-select"
						value={settingsValue.fontFamily}
						onchange={handleFontFamilyChange}
						class="setting-select"
						style:background-color={theme.background}
						style:color={theme.text}
						style:border-color={theme.guideLines}
					>
						{#each FONT_FAMILIES as font}
							<option value={font.value}>{font.name}</option>
						{/each}
					</select>
				</section>

				<!-- Pause on Punctuation -->
				<section class="setting-group">
					<label class="setting-checkbox-label">
						<input
							type="checkbox"
							checked={settingsValue.pauseOnPunctuation}
							onchange={handlePauseOnPunctuationChange}
							class="setting-checkbox"
							style:accent-color={theme.orp}
						/>
						<span>Pause on punctuation</span>
					</label>
					<p class="setting-description">Adds delay after periods, commas, and other punctuation</p>
				</section>

				<!-- Punctuation Delay Multiplier -->
				{#if settingsValue.pauseOnPunctuation}
					<section class="setting-group setting-indented">
						<div class="setting-label-row">
							<label for="punctuation-delay-slider" class="setting-label">Punctuation delay</label>
							<span class="setting-value">{settingsValue.punctuationDelayMultiplier.toFixed(1)}x</span>
						</div>
						<input
							id="punctuation-delay-slider"
							type="range"
							min="1.0"
							max="2.0"
							step="0.1"
							value={settingsValue.punctuationDelayMultiplier}
							oninput={handlePunctuationDelayChange}
							class="setting-slider"
							style:--slider-track-color={theme.guideLines}
							style:--slider-thumb-color={theme.orp}
						/>
						<div class="setting-range-labels">
							<span>1.0x</span>
							<span>2.0x</span>
						</div>
					</section>
				{/if}

				<!-- Long Word Delay Multiplier -->
				<section class="setting-group">
					<div class="setting-label-row">
						<label for="long-word-delay-slider" class="setting-label">Long word delay</label>
						<span class="setting-value">{settingsValue.longWordDelayMultiplier.toFixed(1)}x</span>
					</div>
					<input
						id="long-word-delay-slider"
						type="range"
						min="1.0"
						max="1.5"
						step="0.1"
						value={settingsValue.longWordDelayMultiplier}
						oninput={handleLongWordDelayChange}
						class="setting-slider"
						style:--slider-track-color={theme.guideLines}
						style:--slider-thumb-color={theme.orp}
					/>
					<div class="setting-range-labels">
						<span>1.0x</span>
						<span>1.5x</span>
					</div>
					<p class="setting-description">Extra time for words with 10+ characters</p>
				</section>
			</div>
		</div>
	</div>
{/if}

<style>
	.modal-overlay {
		position: fixed;
		inset: 0;
		z-index: 1000;
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1rem;
		background-color: rgba(0, 0, 0, 0.7);
	}

	.settings-panel {
		width: 100%;
		max-width: 500px;
		max-height: 90vh;
		border-radius: 12px;
		box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
		display: flex;
		flex-direction: column;
		overflow: hidden;
	}

	.settings-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 1.5rem;
		border-bottom: 1px solid rgba(128, 128, 128, 0.2);
	}

	.settings-header h2 {
		margin: 0;
		font-size: 1.5rem;
		font-weight: 600;
	}

	.close-button {
		background: none;
		border: none;
		padding: 0.5rem;
		cursor: pointer;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 6px;
		transition: background-color 0.2s;
		color: inherit;
	}

	.close-button:hover {
		background-color: rgba(128, 128, 128, 0.1);
	}

	.close-button:focus-visible {
		outline: 2px solid currentColor;
		outline-offset: 2px;
	}

	.settings-content {
		padding: 1.5rem;
		overflow-y: auto;
		flex: 1;
	}

	.setting-group {
		margin-bottom: 2rem;
	}

	.setting-group:last-child {
		margin-bottom: 0;
	}

	.setting-indented {
		padding-left: 1.5rem;
		margin-top: -0.5rem;
	}

	.setting-label {
		display: block;
		font-weight: 500;
		margin-bottom: 0.5rem;
		font-size: 0.9rem;
	}

	.setting-label-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.5rem;
	}

	.setting-value {
		font-size: 0.9rem;
		font-weight: 500;
		font-variant-numeric: tabular-nums;
	}

	.setting-select {
		width: 100%;
		padding: 0.75rem;
		border: 1px solid;
		border-radius: 6px;
		font-size: 1rem;
		cursor: pointer;
		transition: all 0.2s;
	}

	.setting-select:hover {
		opacity: 0.9;
	}

	.setting-select:focus-visible {
		outline: 2px solid var(--slider-thumb-color, currentColor);
		outline-offset: 2px;
	}

	.setting-slider {
		width: 100%;
		height: 6px;
		-webkit-appearance: none;
		appearance: none;
		background: var(--slider-track-color);
		border-radius: 3px;
		outline: none;
		cursor: pointer;
	}

	.setting-slider::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		width: 20px;
		height: 20px;
		background: var(--slider-thumb-color);
		border-radius: 50%;
		cursor: pointer;
		transition: transform 0.2s;
	}

	.setting-slider::-moz-range-thumb {
		width: 20px;
		height: 20px;
		background: var(--slider-thumb-color);
		border: none;
		border-radius: 50%;
		cursor: pointer;
		transition: transform 0.2s;
	}

	.setting-slider::-webkit-slider-thumb:hover,
	.setting-slider::-moz-range-thumb:hover {
		transform: scale(1.1);
	}

	.setting-slider:focus-visible {
		outline: 2px solid var(--slider-thumb-color);
		outline-offset: 4px;
	}

	.setting-range-labels {
		display: flex;
		justify-content: space-between;
		margin-top: 0.25rem;
		font-size: 0.75rem;
		opacity: 0.7;
	}

	.setting-checkbox-label {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		cursor: pointer;
		font-size: 1rem;
		user-select: none;
	}

	.setting-checkbox {
		width: 20px;
		height: 20px;
		cursor: pointer;
	}

	.setting-checkbox:focus-visible {
		outline: 2px solid currentColor;
		outline-offset: 2px;
	}

	.setting-description {
		margin: 0.5rem 0 0 0;
		font-size: 0.85rem;
		opacity: 0.7;
		line-height: 1.4;
	}

	@media (max-width: 600px) {
		.settings-panel {
			max-width: 100%;
			max-height: 100vh;
			border-radius: 0;
		}

		.settings-header,
		.settings-content {
			padding: 1rem;
		}
	}
</style>
