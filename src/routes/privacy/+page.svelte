<script lang="ts">
	import { currentTheme } from '$lib/stores/settings';

	const theme = $derived($currentTheme);
</script>

<svelte:head>
	<title>Privacy Policy - QuickReader</title>
	<meta name="description" content="QuickReader privacy policy. All file processing is local - your files never leave your device. No tracking, no analytics, no cookies." />
</svelte:head>

<div
	class="page"
	style:--color-bg={theme.background}
	style:--color-text={theme.text}
	style:--color-orp={theme.orp}
	style:--color-guide={theme.guideLines}
>
	<div class="container">
		<h1>Privacy Policy</h1>

		<p class="summary">
			<strong>TL;DR:</strong> QuickReader respects your privacy. Your files never leave your device, and we don't track you.
		</p>

		<section>
			<h2>Local Processing</h2>
			<p>
				QuickReader processes all files <strong>entirely in your browser</strong>. When you open an EPUB, PDF, or text file:
			</p>
			<ul>
				<li>The file is read directly by your browser</li>
				<li>No data is sent to any server</li>
				<li>No copies are uploaded anywhere</li>
				<li>Processing happens on your device only</li>
			</ul>
			<p>
				This means QuickReader works offline after the initial page load, and your reading material remains completely private.
			</p>
		</section>

		<section>
			<h2>Local Storage</h2>
			<p>QuickReader uses your browser's local storage to save:</p>
			<ul>
				<li><strong>Reading progress:</strong> Your current position in each file</li>
				<li><strong>Settings:</strong> Your speed, theme, and font preferences</li>
				<li><strong>Recent files list:</strong> Names of recently opened files (not the file contents)</li>
				<li><strong>Last opened file:</strong> The most recent file is cached locally for quick reload</li>
			</ul>
			<p>
				This data is stored only on your device and is never transmitted. You can clear this data at any time through your browser settings.
			</p>
		</section>

		<section>
			<h2>No Tracking</h2>
			<p>QuickReader does not use:</p>
			<ul>
				<li>Analytics services (no Google Analytics, etc.)</li>
				<li>Tracking pixels or beacons</li>
				<li>Third-party advertising</li>
				<li>User behavior tracking</li>
			</ul>
			<p>We don't know what you read, how fast you read, or when you use the app.</p>
		</section>

		<section>
			<h2>No Cookies</h2>
			<p>
				QuickReader does not set any cookies. All preferences are stored in localStorage, which stays on your device.
			</p>
		</section>

		<section>
			<h2>No Accounts</h2>
			<p>
				QuickReader doesn't require registration or sign-in. There are no accounts, no emails, no personal information collected.
			</p>
		</section>

		<section>
			<h2>Third-Party Services</h2>
			<p>
				QuickReader is hosted on Cloudflare Pages. Cloudflare may collect standard web server logs (IP addresses, browser types) as part of their hosting service. See <a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noopener noreferrer">Cloudflare's Privacy Policy</a> for details.
			</p>
		</section>

		<section>
			<h2>Changes to This Policy</h2>
			<p>
				If we ever change this privacy policy, we'll update this page. Given QuickReader's design philosophy of local-first processing, we don't anticipate significant changes.
			</p>
		</section>

		<section>
			<h2>Contact</h2>
			<p>
				Questions about privacy? The code is open—you can verify how QuickReader handles your data.
			</p>
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
		margin-bottom: 1.5rem;
		border-bottom: 2px solid var(--color-guide);
		padding-bottom: 1rem;
	}

	h2 {
		font-size: 1.5rem;
		margin-top: 2.5rem;
		margin-bottom: 1rem;
		color: var(--color-orp);
	}

	section {
		margin-bottom: 1.5rem;
	}

	p {
		line-height: 1.7;
		margin-bottom: 1rem;
	}

	.summary {
		background: var(--color-guide);
		padding: 1rem;
		border-radius: 8px;
		margin-bottom: 2rem;
	}

	ul {
		line-height: 1.7;
		padding-left: 1.5rem;
		margin-bottom: 1rem;
	}

	li {
		margin-bottom: 0.5rem;
	}

	a {
		color: var(--color-orp);
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
	}
</style>
