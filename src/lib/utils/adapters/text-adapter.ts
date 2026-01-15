/**
 * Plain text file format adapter.
 * Wraps the existing text-parser for the adapter interface.
 */

import type { FileAdapter, AdapterParseResult } from './types';
import { parseText } from '../text-parser';

/**
 * Adapter for plain text files.
 */
export const textAdapter: FileAdapter = {
	extensions: ['txt', 'text'],
	mimeTypes: ['text/plain'],
	formatName: 'Plain Text',
	supportsPreview: false,

	async parse(file: File): Promise<AdapterParseResult> {
		const text = await file.text();
		const parsed = parseText(text);

		// Extract title from filename
		const title = file.name.replace(/\.(txt|text)$/i, '');

		return {
			document: parsed,
			title,
			warnings: [],
			extra: {
				fileType: 'text'
			}
		};
	}
};
