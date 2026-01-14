<script lang="ts">
	import { currentTheme } from '$lib/stores/settings';

	const theme = $derived($currentTheme);
</script>

<svelte:head>
	<title>Help - QuickReader Keyboard Shortcuts & User Guide</title>
	<meta name="description" content="Learn how to use QuickReader with keyboard shortcuts, navigation tips, and speed reading best practices." />
</svelte:head>

<div
	class="page"
	style:--color-bg={theme.background}
	style:--color-text={theme.text}
	style:--color-orp={theme.orp}
	style:--color-guide={theme.guideLines}
	style:--color-controls-bg={theme.controlsBg}
>
	<div class="container">
		<h1>Help & User Guide</h1>

		<section>
			<h2>Getting Started</h2>
			<ol>
				<li>Click <strong>"Open File"</strong> and select an EPUB, PDF, or text file</li>
				<li>Press <kbd>Space</kbd> or click the play button to start reading</li>
				<li>Adjust speed with the slider or keyboard shortcuts</li>
				<li>Your progress is saved automatically</li>
			</ol>
		</section>

		<section>
			<h2>Keyboard Shortcuts</h2>
			<div class="shortcuts-table">
				<div class="shortcut-group">
					<h3>Playback</h3>
					<div class="shortcut-row">
						<kbd>Space</kbd>
						<span>Play / Pause</span>
					</div>
				</div>

				<div class="shortcut-group">
					<h3>Navigation</h3>
					<div class="shortcut-row">
						<kbd>←</kbd>
						<span>Previous word</span>
					</div>
					<div class="shortcut-row">
						<kbd>→</kbd>
						<span>Next word</span>
					</div>
					<div class="shortcut-row">
						<kbd>Ctrl</kbd> + <kbd>←</kbd>
						<span>Previous paragraph</span>
					</div>
					<div class="shortcut-row">
						<kbd>Ctrl</kbd> + <kbd>→</kbd>
						<span>Next paragraph</span>
					</div>
					<div class="shortcut-row">
						<kbd>Page Up</kbd>
						<span>Previous page</span>
					</div>
					<div class="shortcut-row">
						<kbd>Page Down</kbd>
						<span>Next page</span>
					</div>
					<div class="shortcut-row">
						<kbd>Home</kbd>
						<span>Go to start</span>
					</div>
					<div class="shortcut-row">
						<kbd>End</kbd>
						<span>Go to end</span>
					</div>
				</div>

				<div class="shortcut-group">
					<h3>Speed Control</h3>
					<div class="shortcut-row">
						<kbd>[</kbd>
						<span>Decrease speed by 50 WPM</span>
					</div>
					<div class="shortcut-row">
						<kbd>]</kbd>
						<span>Increase speed by 50 WPM</span>
					</div>
				</div>
			</div>
		</section>

		<section>
			<h2>Tips for Effective Speed Reading</h2>
			<ul>
				<li><strong>Start slow:</strong> Begin at 200-300 WPM and gradually increase as you get comfortable</li>
				<li><strong>Stay focused:</strong> Keep your eyes on the highlighted letter—don't try to look ahead</li>
				<li><strong>Practice regularly:</strong> Your comprehension at higher speeds improves with practice</li>
				<li><strong>Take breaks:</strong> Speed reading requires concentration—rest your eyes periodically</li>
				<li><strong>Use the preview panel:</strong> On desktop, enable the preview panel to see context around the current word</li>
			</ul>
		</section>

		<section>
			<h2>FAQ</h2>

			<details>
				<summary>How fast can I read?</summary>
				<p>QuickReader supports speeds from 100 to 900+ WPM. Most people start comfortably at 250-350 WPM and can work up to 500+ WPM with practice. The average reading speed without RSVP is about 200-250 WPM.</p>
			</details>

			<details>
				<summary>Is my progress saved?</summary>
				<p>Yes! QuickReader automatically saves your position in each file. When you reopen a file, you'll pick up right where you left off. Your settings (speed, theme, etc.) are also saved.</p>
			</details>

			<details>
				<summary>Are my files uploaded anywhere?</summary>
				<p>No. All processing happens locally in your browser. Your files never leave your device—QuickReader works entirely offline once loaded.</p>
			</details>

			<details>
				<summary>Why can't I read my PDF?</summary>
				<p>QuickReader can only read PDFs with selectable text. Scanned documents (images of text) won't work. Try using OCR software to convert scanned PDFs to text-based PDFs first.</p>
			</details>

			<details>
				<summary>Can I customize the appearance?</summary>
				<p>Yes! Click the gear icon in the top right to access settings. You can change the color theme, font size, and font family.</p>
			</details>
		</section>

		<section class="cta">
			<p>
				<a href="/" class="btn">Start Reading</a>
			</p>
		</section>
	</div>
</div>

<style>
	.page {
		min-height: 100vh;
		background: var(--color-bg);
		color: var(--color-text);
		padding: 2rem 1.5rem;
	}

	.container {
		max-width: 700px;
		margin: 0 auto;
	}

	h1 {
		font-size: 2.5rem;
		margin-bottom: 2rem;
		border-bottom: 2px solid var(--color-guide);
		padding-bottom: 1rem;
	}

	h2 {
		font-size: 1.5rem;
		margin-top: 2.5rem;
		margin-bottom: 1rem;
		color: var(--color-orp);
	}

	h3 {
		font-size: 1.1rem;
		margin-bottom: 0.75rem;
		opacity: 0.8;
	}

	section {
		margin-bottom: 1.5rem;
	}

	ol, ul {
		line-height: 1.7;
		padding-left: 1.5rem;
		margin-bottom: 1rem;
	}

	li {
		margin-bottom: 0.5rem;
	}

	kbd {
		display: inline-block;
		background: var(--color-controls-bg);
		border: 1px solid var(--color-guide);
		border-radius: 4px;
		padding: 0.2rem 0.5rem;
		font-size: 0.85rem;
		font-family: inherit;
		min-width: 1.5rem;
		text-align: center;
	}

	.shortcuts-table {
		display: flex;
		flex-direction: column;
		gap: 1.5rem;
	}

	.shortcut-group {
		background: var(--color-controls-bg);
		border: 1px solid var(--color-guide);
		border-radius: 8px;
		padding: 1rem;
	}

	.shortcut-row {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 0.5rem 0;
		border-bottom: 1px solid var(--color-guide);
	}

	.shortcut-row:last-child {
		border-bottom: none;
	}

	.shortcut-row span {
		flex: 1;
	}

	details {
		background: var(--color-controls-bg);
		border: 1px solid var(--color-guide);
		border-radius: 8px;
		margin-bottom: 0.75rem;
		overflow: hidden;
	}

	summary {
		padding: 1rem;
		cursor: pointer;
		font-weight: 500;
	}

	summary:hover {
		background: var(--color-guide);
	}

	details p {
		padding: 0 1rem 1rem;
		margin: 0;
		line-height: 1.6;
	}

	.cta {
		text-align: center;
		margin-top: 3rem;
	}

	.btn {
		display: inline-block;
		background: var(--color-orp);
		color: var(--color-bg);
		padding: 0.75rem 2rem;
		border-radius: 6px;
		text-decoration: none;
		font-weight: 600;
		transition: filter 0.2s ease, transform 0.1s ease;
	}

	.btn:hover {
		filter: brightness(1.1);
		transform: translateY(-1px);
	}

	@media (max-width: 640px) {
		h1 {
			font-size: 2rem;
		}

		h2 {
			font-size: 1.3rem;
		}

		.page {
			padding: 1.5rem 1rem;
		}

		.shortcut-row {
			flex-direction: column;
			align-items: flex-start;
			gap: 0.25rem;
		}
	}
</style>
