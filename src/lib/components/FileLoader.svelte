<script lang="ts">
	import { onMount } from 'svelte';
	import { documentStore, isDocumentLoading, documentError, parseWarnings, setPdfDocumentCache } from '../stores/document';
	import { reader } from '../stores/reader';
	import { currentTheme } from '../stores/settings';
	import { parseEpub, type ParsedEpub } from '../utils/epub-parser';
	import { parseText } from '../utils/text-parser';
	import type { ParsedPdf } from '../utils/pdf-parser';
	import { generateFileKey, addRecentFile, saveLastFile, loadLastFile } from '../utils/storage';

	// Derived store values
	const loading = $derived($isDocumentLoading);
	const error = $derived($documentError);
	const theme = $derived($currentTheme);
	const warnings = $derived($parseWarnings);

	// Local state
	let fileInput: HTMLInputElement | undefined = $state();
	let loadedFileName = $state('');
	let showWarnings = $state(false);
	let autoLoadAttempted = $state(false);

	// Auto-load last file on mount
	onMount(async () => {
		if (autoLoadAttempted) return;
		autoLoadAttempted = true;

		try {
			const lastFile = await loadLastFile();
			if (lastFile) {
				await loadFile(lastFile);
			}
		} catch (e) {
			console.error('Failed to auto-load last file:', e);
		}
	});

	/**
	 * Core file loading logic - used by both file input and auto-load
	 */
	async function loadFile(file: File, saveToStorage: boolean = false): Promise<void> {
		// Reset previous state and stop any active playback
		loadedFileName = '';
		reader.pause();
		documentStore.setLoading(file.name);

		try {
			// Generate unique file key
			const fileKey = generateFileKey(file.name, file.size);

			// Detect file type by extension
			const extension = file.name.toLowerCase().split('.').pop();

			let parsedDocument;
			let fileType: 'text' | 'epub' | 'pdf';

			// Parse based on file type
			if (extension === 'epub') {
				parsedDocument = await parseEpub(file);
				fileType = 'epub';
			} else if (extension === 'pdf') {
				// Dynamic import to avoid SSR issues (pdf.js uses browser APIs)
				const { parsePdf } = await import('../utils/pdf-parser');
				const pdfResult = await parsePdf(file);
				parsedDocument = pdfResult.parsed;
				fileType = 'pdf';
				// Cache the PDF document for rendered preview mode
				if (pdfResult.pdfDocument) {
					setPdfDocumentCache(pdfResult.pdfDocument, fileKey);
				}
			} else if (extension === 'txt') {
				const text = await file.text();
				parsedDocument = parseText(text);
				fileType = 'text';
			} else {
				throw new Error(`Unsupported file type: ${extension}`);
			}

			// Check for parse warnings
			let hasWarnings = false;
			let warningMessages: string[] = [];

			if (fileType === 'epub') {
				const epubDoc = parsedDocument as ParsedEpub;
				if (epubDoc.parseWarnings && epubDoc.parseWarnings.length > 0) {
					hasWarnings = true;
					warningMessages = epubDoc.parseWarnings;
				}
			} else if (fileType === 'pdf') {
				const pdfDoc = parsedDocument as ParsedPdf;
				if (pdfDoc.parseWarnings && pdfDoc.parseWarnings.length > 0) {
					hasWarnings = true;
					warningMessages = pdfDoc.parseWarnings;
				}
			}

			// Validate document has content
			if (!parsedDocument.words || parsedDocument.words.length === 0) {
				if (hasWarnings && warningMessages.length > 0) {
					throw new Error(warningMessages.join(' '));
				}
				throw new Error('The file appears to be empty or contains no readable text.');
			}

			// Show warnings to user if there are any
			if (hasWarnings) {
				showWarnings = true;
			}

			// Set the document in store
			documentStore.setDocument(parsedDocument, file.name, fileKey, fileType);

			// Try to restore reading progress, or reset to beginning for new files
			const hasProgress = reader.restoreProgress(fileKey);
			if (!hasProgress) {
				reader.setWordIndex(0);
			}

			// Add to recent files
			addRecentFile({
				name: file.name,
				fileKey,
				lastOpened: Date.now(),
				totalWords: parsedDocument.totalWords
			});

			// Save file to IndexedDB for auto-reload on refresh
			if (saveToStorage) {
				saveLastFile(file).catch(e => console.error('Failed to save file for reload:', e));
			}

			// Update local state
			loadedFileName = file.name;
		} catch (err) {
			const errorMessage = err instanceof Error ? err.message : 'Failed to load file';
			documentStore.setError(errorMessage);
			console.error('File loading error:', err);
		}
	}

	/**
	 * Handle file selection from input
	 */
	async function handleFileSelect(event: Event) {
		const target = event.target as HTMLInputElement;
		const file = target.files?.[0];

		if (!file) return;

		await loadFile(file, true); // Save to storage for reload

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
	accept=".epub,.txt,.pdf"
	onchange={handleFileSelect}
	class="hidden"
	aria-label="Select EPUB, PDF, or text file"
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

	{#if showWarnings && warnings.length > 0}
		<div class="warning-banner" role="alert">
			<div class="warning-content">
				<span class="warning-icon" aria-hidden="true">⚠</span>
				<span class="warning-text">
					{warnings.length} chapter{warnings.length > 1 ? 's' : ''} had parsing issues
				</span>
				<button
					type="button"
					class="warning-details-btn"
					onclick={() => alert(warnings.join('\n\n'))}
					aria-label="View warning details"
				>
					Details
				</button>
				<button
					type="button"
					class="warning-dismiss-btn"
					onclick={() => showWarnings = false}
					aria-label="Dismiss warning"
				>
					×
				</button>
			</div>
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

	.warning-banner {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		background: rgba(255, 165, 0, 0.95);
		color: #1a1a1a;
		z-index: 1000;
		padding: 0.5rem 1rem;
	}

	.warning-content {
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
		max-width: 800px;
		margin: 0 auto;
	}

	.warning-icon {
		font-size: 1.2rem;
	}

	.warning-text {
		font-size: 0.9rem;
		font-weight: 500;
	}

	.warning-details-btn {
		padding: 0.25rem 0.5rem;
		font-size: 0.8rem;
		background: rgba(0, 0, 0, 0.1);
		border: 1px solid rgba(0, 0, 0, 0.2);
		border-radius: 4px;
		cursor: pointer;
		color: inherit;
		font-family: inherit;
	}

	.warning-details-btn:hover {
		background: rgba(0, 0, 0, 0.2);
	}

	.warning-dismiss-btn {
		padding: 0.25rem 0.5rem;
		font-size: 1.2rem;
		background: none;
		border: none;
		cursor: pointer;
		color: inherit;
		line-height: 1;
		opacity: 0.7;
	}

	.warning-dismiss-btn:hover {
		opacity: 1;
	}

	@media (max-width: 640px) {
		.load-button {
			padding: 0.5rem 0.75rem;
			font-size: 0.85rem;
			min-width: 90px;
		}

		.warning-content {
			flex-wrap: wrap;
			gap: 0.5rem;
		}
	}
</style>
