/**
 * File format adapter types for QuickReader.
 * All file parsers implement the FileAdapter interface.
 */

import type { ParsedDocument } from '../text-parser';
import type { ChapterContent, ChapterInfo } from '../epub-parser';

/**
 * Preview content for the side panel.
 * Supports paginated preview with word markers for click-to-navigate.
 */
export interface PreviewContent {
	/** HTML content per chapter/page with word markers */
	chapterContents: ChapterContent[];
	/** Chapter/section metadata */
	chapters: ChapterInfo[];
	/** Chapter start word indices */
	chapterStarts: number[];
}

/**
 * Result from parsing a file.
 */
export interface AdapterParseResult {
	/** The parsed document with words and structure */
	document: ParsedDocument;
	/** Document title (from metadata if available) */
	title?: string;
	/** Document author (from metadata if available) */
	author?: string;
	/** Preview content for the side panel (optional) */
	preview?: PreviewContent;
	/** Any warnings encountered during parsing */
	warnings: string[];
	/** Additional data specific to the format (e.g., PDF document reference) */
	extra?: Record<string, unknown>;
}

/**
 * Interface that all file format adapters must implement.
 */
export interface FileAdapter {
	/** File extensions this adapter handles (lowercase, no dot) */
	readonly extensions: string[];

	/** MIME types this adapter handles */
	readonly mimeTypes: string[];

	/** Human-readable format name */
	readonly formatName: string;

	/** Whether this format supports rich preview content */
	readonly supportsPreview: boolean;

	/**
	 * Parse the file and return a structured document.
	 * @param file The file to parse
	 * @returns Promise with parsed document and metadata
	 */
	parse(file: File): Promise<AdapterParseResult>;
}

/**
 * Check if an adapter can handle a given file.
 */
export function canAdapterHandle(adapter: FileAdapter, file: File): boolean {
	const extension = file.name.toLowerCase().split('.').pop() || '';
	const mimeType = file.type.toLowerCase();

	return (
		adapter.extensions.includes(extension) ||
		adapter.mimeTypes.includes(mimeType)
	);
}
