/**
 * Adapter registry for file format handlers.
 * Provides centralized file type detection and adapter lookup.
 */

import type { FileAdapter } from './types';
import { canAdapterHandle } from './types';

/**
 * Registry of all available file format adapters.
 */
class AdapterRegistry {
	private adapters: FileAdapter[] = [];

	/**
	 * Register a new adapter.
	 * @param adapter The adapter to register
	 */
	register(adapter: FileAdapter): void {
		// Avoid duplicate registrations
		const existing = this.adapters.find(
			a => a.formatName === adapter.formatName
		);
		if (!existing) {
			this.adapters.push(adapter);
		}
	}

	/**
	 * Get an adapter that can handle the given file.
	 * @param file The file to find an adapter for
	 * @returns The matching adapter, or null if none found
	 */
	getAdapterForFile(file: File): FileAdapter | null {
		for (const adapter of this.adapters) {
			if (canAdapterHandle(adapter, file)) {
				return adapter;
			}
		}
		return null;
	}

	/**
	 * Get all supported file extensions.
	 * @returns Array of extensions (lowercase, no dot)
	 */
	getSupportedExtensions(): string[] {
		const extensions = new Set<string>();
		for (const adapter of this.adapters) {
			for (const ext of adapter.extensions) {
				extensions.add(ext);
			}
		}
		return Array.from(extensions).sort();
	}

	/**
	 * Get all supported MIME types.
	 * @returns Array of MIME types
	 */
	getSupportedMimeTypes(): string[] {
		const mimeTypes = new Set<string>();
		for (const adapter of this.adapters) {
			for (const mime of adapter.mimeTypes) {
				mimeTypes.add(mime);
			}
		}
		return Array.from(mimeTypes).sort();
	}

	/**
	 * Get a comma-separated accept string for file inputs.
	 * @returns Accept string like ".epub,.pdf,.txt"
	 */
	getAcceptString(): string {
		return this.getSupportedExtensions()
			.map(ext => `.${ext}`)
			.join(',');
	}

	/**
	 * Get all registered adapters.
	 * @returns Array of registered adapters
	 */
	getAdapters(): readonly FileAdapter[] {
		return this.adapters;
	}

	/**
	 * Check if a file extension is supported.
	 * @param extension The extension to check (lowercase, no dot)
	 * @returns True if supported
	 */
	isExtensionSupported(extension: string): boolean {
		return this.getSupportedExtensions().includes(extension.toLowerCase());
	}
}

/**
 * Global adapter registry singleton.
 */
export const registry = new AdapterRegistry();
