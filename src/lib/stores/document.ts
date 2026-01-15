import { writable, derived } from 'svelte/store';
import type { ParsedDocument } from '../utils/text-parser';
import type { ParsedEpub, ChapterInfo, ParsedEpubWithContent } from '../utils/epub-parser';
import { cleanupEpubResources } from '../utils/epub-parser';
import type { ParsedPdf, PdfOutlineItem } from '../utils/pdf-parser';

// Supported file types - can be extended by adapters
export type FileType = 'text' | 'epub' | 'pdf' | 'markdown' | 'html' | 'fb2' | 'docx' | 'rtf' | 'odt' | 'mobi';

export interface DocumentState {
	loaded: boolean;
	loading: boolean;
	error: string | null;
	fileName: string;
	fileKey: string;
	fileType: FileType | null;
	document: ParsedDocument | ParsedEpub | ParsedPdf | null;
}

// Track the current document for cleanup
let currentDocument: ParsedDocument | ParsedEpub | ParsedPdf | null = null;

// Cache for PDF document objects (for rendering pages)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let cachedPdfDocument: any = null;
let cachedPdfFileKey: string | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function setPdfDocumentCache(pdfDoc: any, fileKey: string) {
	cachedPdfDocument = pdfDoc;
	cachedPdfFileKey = fileKey;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getPdfDocumentCache(fileKey: string): any | null {
	if (cachedPdfFileKey === fileKey && cachedPdfDocument) {
		return cachedPdfDocument;
	}
	return null;
}

export function clearPdfDocumentCache() {
	cachedPdfDocument = null;
	cachedPdfFileKey = null;
}

const initialState: DocumentState = {
	loaded: false,
	loading: false,
	error: null,
	fileName: '',
	fileKey: '',
	fileType: null,
	document: null
};

function createDocumentStore() {
	const { subscribe, set, update } = writable<DocumentState>(initialState);

	return {
		subscribe,
		setLoading: (fileName: string) => {
			update(state => ({
				...state,
				loading: true,
				error: null,
				fileName
			}));
		},
		setDocument: (
			document: ParsedDocument | ParsedEpub | ParsedPdf,
			fileName: string,
			fileKey: string,
			fileType: FileType
		) => {
			// Clean up previous document's blob URLs if it was an EPUB
			if (currentDocument && 'chapterContents' in currentDocument) {
				cleanupEpubResources(currentDocument as ParsedEpubWithContent);
			}
			currentDocument = document;

			set({
				loaded: true,
				loading: false,
				error: null,
				fileName,
				fileKey,
				fileType,
				document
			});
		},
		setError: (error: string) => {
			update(state => ({
				...state,
				loading: false,
				error
			}));
		},
		clear: () => {
			// Clean up blob URLs before clearing
			if (currentDocument && 'chapterContents' in currentDocument) {
				cleanupEpubResources(currentDocument as ParsedEpubWithContent);
			}
			currentDocument = null;
			set(initialState);
		}
	};
}

export const documentStore = createDocumentStore();

// Derived stores for document properties
export const isDocumentLoaded = derived(documentStore, ($doc) => $doc.loaded);
export const isDocumentLoading = derived(documentStore, ($doc) => $doc.loading);
export const documentError = derived(documentStore, ($doc) => $doc.error);
export const documentFileName = derived(documentStore, ($doc) => $doc.fileName);

export const totalWords = derived(documentStore, ($doc) => $doc.document?.totalWords ?? 0);
export const totalPages = derived(documentStore, ($doc) => $doc.document?.totalPages ?? 0);
export const totalParagraphs = derived(documentStore, ($doc) => $doc.document?.totalParagraphs ?? 0);

// EPUB-specific derived stores
export const isEpub = derived(documentStore, ($doc) => $doc.fileType === 'epub');

export const chapters = derived(documentStore, ($doc): ChapterInfo[] => {
	if ($doc.fileType === 'epub' && $doc.document) {
		return ($doc.document as ParsedEpub).chapters || [];
	}
	return [];
});

export const epubTitle = derived(documentStore, ($doc): string => {
	if ($doc.fileType === 'epub' && $doc.document) {
		return ($doc.document as ParsedEpub).title || $doc.fileName;
	}
	return $doc.fileName;
});

export const epubAuthor = derived(documentStore, ($doc): string => {
	if ($doc.fileType === 'epub' && $doc.document) {
		return ($doc.document as ParsedEpub).author || 'Unknown';
	}
	return '';
});

export const parseWarnings = derived(documentStore, ($doc): string[] => {
	if ($doc.fileType === 'epub' && $doc.document) {
		return ($doc.document as ParsedEpub).parseWarnings || [];
	}
	if ($doc.fileType === 'pdf' && $doc.document) {
		return ($doc.document as ParsedPdf).parseWarnings || [];
	}
	return [];
});

// PDF-specific derived stores
export const isPdf = derived(documentStore, ($doc) => $doc.fileType === 'pdf');

export const pdfOutline = derived(documentStore, ($doc): PdfOutlineItem[] => {
	if ($doc.fileType === 'pdf' && $doc.document) {
		return ($doc.document as ParsedPdf).outline || [];
	}
	return [];
});

export const pdfTitle = derived(documentStore, ($doc): string => {
	if ($doc.fileType === 'pdf' && $doc.document) {
		return ($doc.document as ParsedPdf).title || $doc.fileName;
	}
	return $doc.fileName;
});

export const pdfAuthor = derived(documentStore, ($doc): string => {
	if ($doc.fileType === 'pdf' && $doc.document) {
		return ($doc.document as ParsedPdf).author || 'Unknown';
	}
	return '';
});
