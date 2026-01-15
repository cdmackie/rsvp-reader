<script lang="ts">
	import { currentTheme } from '$lib/stores/settings';

	const theme = $derived($currentTheme);
</script>

<svelte:head>
	<title>About QuickReader - RSVP Speed Reading Technology</title>
	<meta name="description" content="Learn how QuickReader uses RSVP (Rapid Serial Visual Presentation) and ORP technology to help you read faster. Speed read ebooks and documents in EPUB, PDF, MOBI, DOCX, and more." />
</svelte:head>

<div
	class="page"
	style:--color-bg={theme.background}
	style:--color-text={theme.text}
	style:--color-orp={theme.orp}
	style:--color-guide={theme.guideLines}
>
	<div class="container">
		<h1>About QuickReader</h1>

		<section>
			<h2>What is RSVP?</h2>
			<p>
				<strong>RSVP (Rapid Serial Visual Presentation)</strong> is a speed reading technique that displays text one word at a time at a fixed focal point. Instead of moving your eyes across lines of text, the words come to you—eliminating the time spent on eye movements and allowing you to read significantly faster.
			</p>
		</section>

		<section>
			<h2>The Science Behind It</h2>
			<p>
				Traditional reading requires constant eye movements called <em>saccades</em>, which consume roughly 20% of your reading time. RSVP eliminates these movements entirely by presenting each word at the same location on screen.
			</p>
			<p>
				QuickReader enhances this technique with <strong>ORP (Optimal Recognition Point)</strong> alignment. Each word is positioned so that a specific letter—the optimal recognition point—appears at the center of your focus. This letter is highlighted in <span class="orp-example">red</span> to guide your eye, making word recognition nearly instantaneous.
			</p>
		</section>

		<section>
			<h2>How ORP Works</h2>
			<p>Research shows that we don't actually read every letter in a word—our brain recognizes word patterns based on key letters. The optimal recognition point varies by word length:</p>
			<ul>
				<li><strong>1-2 letters:</strong> Focus on the 1st letter</li>
				<li><strong>3-6 letters:</strong> Focus on the 2nd letter</li>
				<li><strong>7-9 letters:</strong> Focus on the 3rd letter</li>
				<li><strong>10+ letters:</strong> Focus on the 4th letter</li>
			</ul>
			<p>QuickReader automatically aligns each word to its optimal recognition point, so you can read effortlessly at high speeds.</p>
		</section>

		<section>
			<h2>Supported File Formats</h2>
			<h3>Ebooks</h3>
			<ul>
				<li><strong>EPUB:</strong> Full chapter navigation, formatting, and images</li>
				<li><strong>MOBI/AZW3:</strong> Kindle format ebooks (DRM-free)</li>
				<li><strong>FB2:</strong> FictionBook format popular in many regions</li>
			</ul>
			<h3>Documents</h3>
			<ul>
				<li><strong>PDF:</strong> Text extraction with bookmark navigation</li>
				<li><strong>DOCX:</strong> Microsoft Word documents</li>
				<li><strong>ODT:</strong> OpenDocument text files</li>
				<li><strong>RTF:</strong> Rich Text Format</li>
			</ul>
			<h3>Text</h3>
			<ul>
				<li><strong>Markdown:</strong> Formatted text with preview support</li>
				<li><strong>HTML:</strong> Web pages and HTML documents</li>
				<li><strong>TXT:</strong> Plain text files</li>
			</ul>
		</section>

		<section>
			<h2>Key Features</h2>
			<ul>
				<li>Adjustable reading speed from 100 to 900+ words per minute</li>
				<li>Automatic progress saving—pick up where you left off</li>
				<li>Multiple color themes including dark mode and sepia</li>
				<li>Chapter navigation for structured documents</li>
				<li>Keyboard shortcuts for hands-free control</li>
				<li>Works entirely in your browser—no uploads, no accounts</li>
			</ul>
		</section>

		<section class="cta">
			<h2>Ready to Read Faster?</h2>
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
		margin-top: 1.5rem;
		margin-bottom: 0.5rem;
		opacity: 0.85;
	}

	section {
		margin-bottom: 1.5rem;
	}

	p {
		line-height: 1.7;
		margin-bottom: 1rem;
	}

	ul {
		line-height: 1.7;
		padding-left: 1.5rem;
		margin-bottom: 1rem;
	}

	li {
		margin-bottom: 0.5rem;
	}

	.orp-example {
		color: var(--color-orp);
		font-weight: 700;
	}

	.cta {
		text-align: center;
		margin-top: 3rem;
		padding: 2rem;
		border: 1px solid var(--color-guide);
		border-radius: 8px;
	}

	.cta h2 {
		margin-top: 0;
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
	}
</style>
