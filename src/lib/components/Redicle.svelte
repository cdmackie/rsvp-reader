<script lang="ts">
	import { splitWordAtORP } from '../utils/orp';
	import { currentWordText, reader } from '../stores/reader';
	import { currentTheme, settings } from '../stores/settings';

	// Derived store values
	const word = $derived($currentWordText);
	const theme = $derived($currentTheme);
	const fontSize = $derived($settings.fontSize);
	const fontFamily = $derived($settings.fontFamily);

	// Split word into ORP parts
	const parts = $derived(splitWordAtORP(word));

	// Handle click to toggle play/pause
	function handleClick() {
		reader.toggle();
	}

	// Handle keyboard interaction (Enter/Space)
	function handleKeydown(event: KeyboardEvent) {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			reader.toggle();
		}
	}
</script>

<div
	class="redicle-container"
	role="button"
	tabindex="0"
	onclick={handleClick}
	onkeydown={handleKeydown}
	aria-label="RSVP reader display. Click or press Space to toggle play/pause"
	style:--bg-color={theme.background}
	style:--text-color={theme.text}
	style:--orp-color={theme.orp}
	style:--guide-color={theme.guideLines}
	style:--font-size="{fontSize}px"
	style:--font-family={fontFamily}
>
	<div class="redicle-box">
		<!-- Top guide line with center marker -->
		<div class="guide-line top">
			<div class="center-mark"></div>
		</div>

		<!-- Word display with ORP alignment -->
		<div class="word-container">
			<div class="word-display">
				<span class="before-orp">{parts.before}</span>
				<span class="orp-letter">{parts.orp}</span>
				<span class="after-orp">{parts.after}</span>
			</div>
		</div>

		<!-- Bottom guide line with center marker -->
		<div class="guide-line bottom">
			<div class="center-mark"></div>
		</div>
	</div>
</div>

<style>
	.redicle-container {
		width: 100%;
		max-width: 800px;
		margin: 0 auto;
		padding: 2rem 1rem;
		cursor: pointer;
		user-select: none;
		-webkit-user-select: none;
		transition: opacity 0.2s ease;
	}

	.redicle-container:hover {
		opacity: 0.95;
	}

	.redicle-container:focus {
		outline: none;
	}

	.redicle-container:focus-visible {
		outline: 3px solid var(--orp-color);
		outline-offset: 4px;
		border-radius: 12px;
	}

	.redicle-box {
		position: relative;
		background-color: var(--bg-color);
		border: 2px solid var(--guide-color);
		border-radius: 8px;
		padding: 2.5rem 2rem;
		min-height: 180px;
		display: flex;
		flex-direction: column;
		justify-content: center;
		align-items: center;
		gap: 0.5rem;
	}

	.guide-line {
		width: 100%;
		height: 1px;
		background-color: var(--guide-color);
		position: relative;
		display: flex;
		justify-content: center;
	}

	.center-mark {
		width: 2px;
		height: 16px;
		background-color: var(--orp-color);
		opacity: 0.6;
	}

	.guide-line.top .center-mark {
		transform: translateY(-8px);
	}

	.guide-line.bottom .center-mark {
		transform: translateY(-8px);
	}

	.word-container {
		flex: 1;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 100%;
		padding: 1rem 0;
		position: relative;
	}

	.word-display {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: baseline;
		font-family: var(--font-family);
		font-size: var(--font-size);
		line-height: 1.2;
		color: var(--text-color);
		white-space: nowrap;
		width: 100%;
		max-width: 100%;
	}

	.before-orp {
		text-align: right;
		color: var(--text-color);
		overflow: hidden;
		text-overflow: clip;
		justify-self: end;
	}

	.orp-letter {
		color: var(--orp-color);
		font-weight: 700;
		/* ORP letter is the fixed center point */
		text-align: center;
	}

	.after-orp {
		text-align: left;
		color: var(--text-color);
		overflow: hidden;
		text-overflow: clip;
		justify-self: start;
	}

	@media (max-width: 768px) {
		.redicle-container {
			padding: 1.5rem 0.75rem;
		}

		.redicle-box {
			padding: 2rem 1rem;
			min-height: 150px;
		}
	}

	@media (max-width: 480px) {
		.redicle-container {
			padding: 1rem 0.5rem;
		}

		.redicle-box {
			padding: 1.5rem 0.75rem;
			min-height: 120px;
		}

		.center-mark {
			height: 12px;
		}
	}
</style>
