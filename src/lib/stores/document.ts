import { writable, derived } from 'svelte/store';
import type { ParsedDocument } from '../utils/text-parser';
import type { ParsedEpub, ChapterInfo } from '../utils/epub-parser';

export interface DocumentState {
	loaded: boolean;
	loading: boolean;
	error: string | null;
	fileName: string;
	fileKey: string;
	fileType: 'text' | 'epub' | null;
	document: ParsedDocument | ParsedEpub | null;
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
			document: ParsedDocument | ParsedEpub,
			fileName: string,
			fileKey: string,
			fileType: 'text' | 'epub'
		) => {
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
