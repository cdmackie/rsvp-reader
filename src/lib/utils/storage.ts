import { STORAGE_KEYS } from '../constants';

// IndexedDB for storing large files
const DB_NAME = 'quickreader-db';
const DB_VERSION = 1;
const FILE_STORE = 'lastFile';

/**
 * Open IndexedDB database
 */
function openDB(): Promise<IDBDatabase> {
	return new Promise((resolve, reject) => {
		const request = indexedDB.open(DB_NAME, DB_VERSION);

		request.onerror = () => reject(request.error);
		request.onsuccess = () => resolve(request.result);

		request.onupgradeneeded = (event) => {
			const db = (event.target as IDBOpenDBRequest).result;
			if (!db.objectStoreNames.contains(FILE_STORE)) {
				db.createObjectStore(FILE_STORE, { keyPath: 'id' });
			}
		};
	});
}

/**
 * Save the last opened file to IndexedDB for restoration on refresh
 */
export async function saveLastFile(file: File): Promise<void> {
	try {
		const db = await openDB();
		const transaction = db.transaction(FILE_STORE, 'readwrite');
		const store = transaction.objectStore(FILE_STORE);

		// Store file as ArrayBuffer with metadata
		const arrayBuffer = await file.arrayBuffer();

		store.put({
			id: 'lastFile',
			name: file.name,
			type: file.type,
			size: file.size,
			data: arrayBuffer,
			savedAt: Date.now()
		});

		await new Promise<void>((resolve, reject) => {
			transaction.oncomplete = () => resolve();
			transaction.onerror = () => reject(transaction.error);
		});

		db.close();
	} catch (e) {
		console.error('Failed to save last file:', e);
	}
}

/**
 * Load the last opened file from IndexedDB
 */
export async function loadLastFile(): Promise<File | null> {
	try {
		const db = await openDB();
		const transaction = db.transaction(FILE_STORE, 'readonly');
		const store = transaction.objectStore(FILE_STORE);

		const result = await new Promise<{
			name: string;
			type: string;
			size: number;
			data: ArrayBuffer;
			savedAt: number;
		} | undefined>((resolve, reject) => {
			const request = store.get('lastFile');
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});

		db.close();

		if (!result) return null;

		// Reconstruct File from stored data
		const blob = new Blob([result.data], { type: result.type });
		return new File([blob], result.name, { type: result.type });
	} catch (e) {
		console.error('Failed to load last file:', e);
		return null;
	}
}

/**
 * Clear the stored last file
 */
export async function clearLastFile(): Promise<void> {
	try {
		const db = await openDB();
		const transaction = db.transaction(FILE_STORE, 'readwrite');
		const store = transaction.objectStore(FILE_STORE);

		store.delete('lastFile');

		await new Promise<void>((resolve, reject) => {
			transaction.oncomplete = () => resolve();
			transaction.onerror = () => reject(transaction.error);
		});

		db.close();
	} catch (e) {
		console.error('Failed to clear last file:', e);
	}
}

/**
 * Check if there's a stored file without loading it
 */
export async function hasLastFile(): Promise<boolean> {
	try {
		const db = await openDB();
		const transaction = db.transaction(FILE_STORE, 'readonly');
		const store = transaction.objectStore(FILE_STORE);

		const count = await new Promise<number>((resolve, reject) => {
			const request = store.count('lastFile');
			request.onsuccess = () => resolve(request.result);
			request.onerror = () => reject(request.error);
		});

		db.close();
		return count > 0;
	} catch (e) {
		return false;
	}
}

/**
 * Generate a simple hash for a file to use as a unique identifier.
 * Combines filename and file size for reasonable uniqueness.
 */
export function generateFileKey(filename: string, fileSize: number): string {
	return `${filename}_${fileSize}`;
}

/**
 * Save reading progress for a file.
 */
export function saveProgress(fileKey: string, wordIndex: number, totalWords: number): void {
	try {
		const progress = loadAllProgress();
		progress[fileKey] = {
			wordIndex,
			totalWords,
			lastRead: Date.now()
		};
		localStorage.setItem(STORAGE_KEYS.progress, JSON.stringify(progress));
	} catch (e) {
		console.error('Failed to save progress:', e);
	}
}

/**
 * Load reading progress for a file.
 */
export function loadProgress(fileKey: string): { wordIndex: number; totalWords: number } | null {
	try {
		const progress = loadAllProgress();
		return progress[fileKey] || null;
	} catch (e) {
		console.error('Failed to load progress:', e);
		return null;
	}
}

/**
 * Load all saved progress.
 */
export function loadAllProgress(): Record<string, { wordIndex: number; totalWords: number; lastRead: number }> {
	try {
		const stored = localStorage.getItem(STORAGE_KEYS.progress);
		return stored ? JSON.parse(stored) : {};
	} catch (e) {
		console.error('Failed to load progress:', e);
		return {};
	}
}

/**
 * Clear progress for a specific file.
 */
export function clearProgress(fileKey: string): void {
	try {
		const progress = loadAllProgress();
		delete progress[fileKey];
		localStorage.setItem(STORAGE_KEYS.progress, JSON.stringify(progress));
	} catch (e) {
		console.error('Failed to clear progress:', e);
	}
}

/**
 * Save user settings.
 */
export function saveSettings(settings: Record<string, unknown>): void {
	try {
		localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
	} catch (e) {
		console.error('Failed to save settings:', e);
	}
}

/**
 * Load user settings.
 */
export function loadSettings(): Record<string, unknown> | null {
	try {
		const stored = localStorage.getItem(STORAGE_KEYS.settings);
		return stored ? JSON.parse(stored) : null;
	} catch (e) {
		console.error('Failed to load settings:', e);
		return null;
	}
}

/**
 * Recent files management
 */
interface RecentFile {
	name: string;
	fileKey: string;
	lastOpened: number;
	totalWords: number;
}

export function addRecentFile(file: RecentFile): void {
	try {
		const recent = loadRecentFiles();
		// Remove if already exists
		const filtered = recent.filter(f => f.fileKey !== file.fileKey);
		// Add to front
		filtered.unshift(file);
		// Keep only last 10
		const trimmed = filtered.slice(0, 10);
		localStorage.setItem(STORAGE_KEYS.recentFiles, JSON.stringify(trimmed));
	} catch (e) {
		console.error('Failed to add recent file:', e);
	}
}

export function loadRecentFiles(): RecentFile[] {
	try {
		const stored = localStorage.getItem(STORAGE_KEYS.recentFiles);
		return stored ? JSON.parse(stored) : [];
	} catch (e) {
		console.error('Failed to load recent files:', e);
		return [];
	}
}

export function clearRecentFiles(): void {
	try {
		localStorage.removeItem(STORAGE_KEYS.recentFiles);
	} catch (e) {
		console.error('Failed to clear recent files:', e);
	}
}

/**
 * Book-specific preferences (per fileKey)
 */
interface BookPrefs {
	hiddenImages: string[]; // Original src values of hidden images
}

function loadAllBookPrefs(): Record<string, BookPrefs> {
	try {
		const stored = localStorage.getItem(STORAGE_KEYS.bookPrefs);
		return stored ? JSON.parse(stored) : {};
	} catch (e) {
		console.error('Failed to load book prefs:', e);
		return {};
	}
}

function saveAllBookPrefs(prefs: Record<string, BookPrefs>): void {
	try {
		localStorage.setItem(STORAGE_KEYS.bookPrefs, JSON.stringify(prefs));
	} catch (e) {
		console.error('Failed to save book prefs:', e);
	}
}

/**
 * Get hidden images for a specific book.
 */
export function getHiddenImages(fileKey: string): string[] {
	const prefs = loadAllBookPrefs();
	return prefs[fileKey]?.hiddenImages || [];
}

/**
 * Hide an image (by original src) for a specific book.
 */
export function hideImage(fileKey: string, originalSrc: string): void {
	const prefs = loadAllBookPrefs();
	if (!prefs[fileKey]) {
		prefs[fileKey] = { hiddenImages: [] };
	}
	if (!prefs[fileKey].hiddenImages.includes(originalSrc)) {
		prefs[fileKey].hiddenImages.push(originalSrc);
	}
	saveAllBookPrefs(prefs);
}

/**
 * Show a previously hidden image.
 */
export function showImage(fileKey: string, originalSrc: string): void {
	const prefs = loadAllBookPrefs();
	if (prefs[fileKey]?.hiddenImages) {
		prefs[fileKey].hiddenImages = prefs[fileKey].hiddenImages.filter(src => src !== originalSrc);
		saveAllBookPrefs(prefs);
	}
}

/**
 * Show all hidden images for a book.
 */
export function showAllImages(fileKey: string): void {
	const prefs = loadAllBookPrefs();
	if (prefs[fileKey]) {
		prefs[fileKey].hiddenImages = [];
		saveAllBookPrefs(prefs);
	}
}
