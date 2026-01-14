<script lang="ts">
	import { documentStore, isDocumentLoading, documentError } from '../stores/document';
	import { reader } from '../stores/reader';
	import { currentTheme } from '../stores/settings';
	import { parseEpub } from '../utils/epub-parser';
	import { parseText } from '../utils/text-parser';
	import { generateFileKey, addRecentFile } from '../utils/storage';

	// Derived store values
	const loading = $derived($isDocumentLoading);
	const error = $derived($documentError);
	const theme = $derived($currentTheme);

	// Local state
	let fileInput: HTMLInputElement | undefined = $state();
	let loadedFileName = $state('');

	/**
	 * Handle file selection and loading
	 */
	async function handleFileSelect(event: Event) {
		const target = event.target as HTMLInputElement;
		const file = target.files?.[0];

		if (!file) return;

		// Reset previous state and stop any active playback
		loadedFileName = '';
		reader.pause(); // Stop playback and clear timer before loading new document
		documentStore.setLoading(file.name);

		try {
			// Generate unique file key
			const fileKey = generateFileKey(file.name, file.size);

			// Detect file type by extension
			const extension = file.name.toLowerCase().split('.').pop();

			let parsedDocument;
			let fileType: 'text' | 'epub';

			// Parse based on file type
			if (extension === 'epub') {
				parsedDocument = await parseEpub(file);
				fileType = 'epub';
			} else if (extension === 'txt') {
				const text = await file.text();
				parsedDocument = parseText(text);
				fileType = 'text';
			} else {
				throw new Error(`Unsupported file type: ${extension}`);
			}

			// Set the document in store
			documentStore.setDocument(parsedDocument, file.name, fileKey, fileType);

			// Try to restore reading progress
			reader.restoreProgress(fileKey);

			// Add to recent files
			addRecentFile({
				name: file.name,
				fileKey,
				lastOpened: Date.now(),
				totalWords: parsedDocument.totalWords
			});

			// Update local state
			loadedFileName = file.name;
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : 'Failed to load file';
			documentStore.setError(errorMessage);
			console.error('File loading error:', err);
		}

		// Clear the input so the same file can be loaded again
		target.value = '';
	}

	/**
	 * Trigger the hidden file input
	 */
	function openFileDialog() {
		fileInput?.click();
	}
</script>

<input
	bind:this={fileInput}
	type="file"
	accept=".epub,.txt"
	onchange={handleFileSelect}
	class="hidden"
	aria-label="Select EPUB or text file"
/>

<div class="file-loader">
	<button
		type="button"
		onclick={openFileDialog}
		disabled={loading}
		class="load-button"
		aria-busy={loading}
	>
		{#if loading}
			<span class="loader-spinner" aria-hidden="true"></span>
			<span>Loading...</span>
		{:else}
			<span>Open File</span>
		{/if}
	</button>

	{#if error}
		<div class="error-message" role="alert">
			<span class="error-icon" aria-hidden="true">!</span>
			<span>{error}</span>
		</div>
	{/if}
</div>

<style>
	.file-loader {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}

	.hidden {
		display: none;
	}

	.load-button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.5rem;
		padding: 0.5rem 1rem;
		font-size: 0.9rem;
		font-weight: 600;
		background: var(--color-orp);
		color: var(--color-bg);
		border: none;
		border-radius: 6px;
		cursor: pointer;
		transition: all 0.2s ease;
		min-width: 100px;
		font-family: inherit;
	}

	.load-button:hover:not(:disabled) {
		transform: translateY(-1px);
		filter: brightness(1.1);
	}

	.load-button:active:not(:disabled) {
		transform: translateY(0);
	}

	.load-button:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.loader-spinner {
		display: inline-block;
		width: 14px;
		height: 14px;
		border: 2px solid currentColor;
		border-right-color: transparent;
		border-radius: 50%;
		animation: spin 0.6s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}

	.error-message {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.375rem 0.75rem;
		border-radius: 4px;
		font-size: 0.8rem;
		background: rgba(255, 68, 68, 0.15);
		color: #ff4444;
	}

	.error-icon {
		display: flex;
		align-items: center;
		justify-content: center;
		width: 16px;
		height: 16px;
		background: #ff4444;
		color: white;
		border-radius: 50%;
		font-size: 0.7rem;
		font-weight: bold;
	}

	@media (max-width: 640px) {
		.load-button {
			padding: 0.5rem 0.75rem;
			font-size: 0.85rem;
			min-width: 90px;
		}
	}
</style>
