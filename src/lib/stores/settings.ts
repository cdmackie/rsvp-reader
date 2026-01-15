import { writable, derived } from 'svelte/store';
import {
	DEFAULT_WPM,
	DEFAULT_THEME,
	DEFAULT_FONT_SIZE,
	DEFAULT_FONT_FAMILY,
	THEMES,
	type Theme
} from '../constants';
import { saveSettings, loadSettings } from '../utils/storage';

export interface Settings {
	wpm: number;
	themeName: string;
	fontSize: number;
	fontFamily: string;
	pauseOnPunctuation: boolean;
	punctuationDelayMultiplier: number;
	longWordDelayMultiplier: number;
	pauseOnNames: boolean;
	nameDelayMultiplier: number;
	previewVisible: boolean;
	previewWidth: number; // percentage (20-50)
	pdfPreviewMode: 'text' | 'rendered'; // text extraction or rendered page image
	customOrpColor: string | null; // null = use theme default, string = custom color
}

const defaultSettings: Settings = {
	wpm: DEFAULT_WPM,
	themeName: DEFAULT_THEME,
	fontSize: DEFAULT_FONT_SIZE,
	fontFamily: DEFAULT_FONT_FAMILY,
	pauseOnPunctuation: true,
	punctuationDelayMultiplier: 1.5,
	longWordDelayMultiplier: 1.2,
	pauseOnNames: true,
	nameDelayMultiplier: 1.3,
	previewVisible: true,
	previewWidth: 35,
	pdfPreviewMode: 'text',
	customOrpColor: null
};

function createSettingsStore() {
	// Load saved settings or use defaults
	const saved = loadSettings();
	const initial: Settings = saved ? { ...defaultSettings, ...saved } : defaultSettings;

	const { subscribe, set, update } = writable<Settings>(initial);

	return {
		subscribe,
		set: (settings: Settings) => {
			set(settings);
			saveSettings(settings);
		},
		update: (fn: (settings: Settings) => Settings) => {
			update(current => {
				const updated = fn(current);
				saveSettings(updated);
				return updated;
			});
		},
		setWpm: (wpm: number) => {
			update(s => {
				const updated = { ...s, wpm };
				saveSettings(updated);
				return updated;
			});
		},
		setTheme: (themeName: string) => {
			update(s => {
				const updated = { ...s, themeName };
				saveSettings(updated);
				return updated;
			});
		},
		setFontSize: (fontSize: number) => {
			update(s => {
				const updated = { ...s, fontSize };
				saveSettings(updated);
				return updated;
			});
		},
		setFontFamily: (fontFamily: string) => {
			update(s => {
				const updated = { ...s, fontFamily };
				saveSettings(updated);
				return updated;
			});
		},
		setPreviewVisible: (previewVisible: boolean) => {
			update(s => {
				const updated = { ...s, previewVisible };
				saveSettings(updated);
				return updated;
			});
		},
		setPreviewWidth: (width: number) => {
			update(s => {
				// Clamp to 20-50% range
				const previewWidth = Math.max(20, Math.min(50, width));
				const updated = { ...s, previewWidth };
				saveSettings(updated);
				return updated;
			});
		},
		togglePreview: () => {
			update(s => {
				const updated = { ...s, previewVisible: !s.previewVisible };
				saveSettings(updated);
				return updated;
			});
		},
		setPdfPreviewMode: (mode: 'text' | 'rendered') => {
			update(s => {
				const updated = { ...s, pdfPreviewMode: mode };
				saveSettings(updated);
				return updated;
			});
		},
		togglePdfPreviewMode: () => {
			update(s => {
				const mode = s.pdfPreviewMode === 'text' ? 'rendered' : 'text';
				const updated = { ...s, pdfPreviewMode: mode };
				saveSettings(updated);
				return updated;
			});
		},
		setCustomOrpColor: (color: string | null) => {
			update(s => {
				const updated = { ...s, customOrpColor: color };
				saveSettings(updated);
				return updated;
			});
		},
		reset: () => {
			set(defaultSettings);
			saveSettings(defaultSettings);
		}
	};
}

export const settings = createSettingsStore();

// Derived store for the current theme object
export const currentTheme = derived(settings, ($settings): Theme => {
	const baseTheme = THEMES[$settings.themeName] || THEMES[DEFAULT_THEME];

	// Apply custom ORP color if set
	if ($settings.customOrpColor) {
		// Special value 'match-text' means use the theme's text color
		const orpColor = $settings.customOrpColor === 'match-text'
			? baseTheme.text
			: $settings.customOrpColor;

		return {
			...baseTheme,
			orp: orpColor
		};
	}

	return baseTheme;
});
