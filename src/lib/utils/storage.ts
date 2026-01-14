import { STORAGE_KEYS } from '../constants';

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
