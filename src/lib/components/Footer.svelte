<script lang="ts">
	import { currentTheme } from '../stores/settings';

	const theme = $derived($currentTheme);
</script>

<footer
	class="footer"
	style:--bg-color={theme.controlsBg}
	style:--text-color={theme.text}
	style:--border-color={theme.guideLines}
>
	<div class="footer-content">
		<nav class="footer-nav">
			<a href="/about">About</a>
			<span class="divider">·</span>
			<a href="/help">Help</a>
			<span class="divider">·</span>
			<a href="/privacy">Privacy</a>
			<span class="divider">·</span>
			<a href="https://github.com/cdmackie/quickreader" target="_blank" rel="noopener noreferrer">GitHub</a>
		</nav>
		<p class="copyright">© {new Date().getFullYear()} CoinsTax LLC. Open source under MIT License.</p>
	</div>
</footer>

<style>
	.footer {
		background: var(--bg-color);
		border-top: 1px solid var(--border-color);
		padding: 1.5rem;
		margin-top: auto;
	}

	.footer-content {
		max-width: 900px;
		margin: 0 auto;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 0.75rem;
		text-align: center;
	}

	.footer-nav {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		font-size: 0.9rem;
	}

	.footer-nav a {
		color: var(--text-color);
		text-decoration: none;
		opacity: 0.8;
		transition: opacity 0.2s ease;
	}

	.footer-nav a:hover {
		opacity: 1;
		text-decoration: underline;
	}

	.divider {
		color: var(--text-color);
		opacity: 0.4;
	}

	.copyright {
		font-size: 0.8rem;
		color: var(--text-color);
		opacity: 0.5;
		margin: 0;
	}

	@media (max-width: 480px) {
		.footer {
			padding: 1rem;
		}

		.footer-nav {
			font-size: 0.85rem;
			gap: 0.5rem;
			flex-wrap: wrap;
			justify-content: center;
		}

		.copyright {
			font-size: 0.75rem;
		}
	}
</style>
