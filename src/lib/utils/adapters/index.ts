/**
 * File format adapters for QuickReader.
 *
 * This module exports all available file format adapters and
 * provides a pre-configured registry with all adapters registered.
 */

// Export types
export type { FileAdapter, AdapterParseResult, PreviewContent } from './types';
export { canAdapterHandle } from './types';

// Export registry
export { registry } from './registry';

// Export individual adapters
export { epubAdapter } from './epub-adapter';
export { pdfAdapter } from './pdf-adapter';
export { textAdapter } from './text-adapter';
export { htmlAdapter } from './html-adapter';
export { markdownAdapter } from './markdown-adapter';
export { fb2Adapter } from './fb2-adapter';
export { docxAdapter } from './docx-adapter';
export { rtfAdapter } from './rtf-adapter';
export { odtAdapter } from './odt-adapter';
export { mobiAdapter } from './mobi-adapter';

// Import registry for registration
import { registry } from './registry';

// Import all adapters
import { epubAdapter } from './epub-adapter';
import { pdfAdapter } from './pdf-adapter';
import { textAdapter } from './text-adapter';
import { htmlAdapter } from './html-adapter';
import { markdownAdapter } from './markdown-adapter';
import { fb2Adapter } from './fb2-adapter';
import { docxAdapter } from './docx-adapter';
import { rtfAdapter } from './rtf-adapter';
import { odtAdapter } from './odt-adapter';
import { mobiAdapter } from './mobi-adapter';

// Register all adapters
// Order matters - first match wins for MIME type conflicts
registry.register(epubAdapter);
registry.register(pdfAdapter);
registry.register(textAdapter);
registry.register(htmlAdapter);
registry.register(markdownAdapter);
registry.register(fb2Adapter);
registry.register(docxAdapter);
registry.register(rtfAdapter);
registry.register(odtAdapter);
registry.register(mobiAdapter);

/**
 * Parse a file using the appropriate adapter.
 * @param file The file to parse
 * @returns Promise with the parse result, or throws if no adapter found
 */
export async function parseFile(file: File) {
	const adapter = registry.getAdapterForFile(file);

	if (!adapter) {
		const extension = file.name.split('.').pop()?.toLowerCase() || 'unknown';
		throw new Error(
			`Unsupported file type: .${extension}\n\n` +
			`Supported formats: ${registry.getSupportedExtensions().map(e => `.${e}`).join(', ')}`
		);
	}

	return adapter.parse(file);
}

/**
 * Check if a file is supported.
 * @param file The file to check
 * @returns True if the file type is supported
 */
export function isFileSupported(file: File): boolean {
	return registry.getAdapterForFile(file) !== null;
}

/**
 * Get the accept string for file inputs.
 * @returns Accept string like ".epub,.pdf,.txt"
 */
export function getAcceptString(): string {
	return registry.getAcceptString();
}

/**
 * Get human-readable list of supported formats.
 * @returns Array of format descriptions
 */
export function getSupportedFormats(): { name: string; extensions: string[] }[] {
	return registry.getAdapters().map(adapter => ({
		name: adapter.formatName,
		extensions: adapter.extensions
	}));
}
