// Speed limits
export const MIN_WPM = 100;
export const MAX_WPM = 900;
export const DEFAULT_WPM = 300;
export const WPM_STEP = 50;

// Timing adjustments
export const PUNCTUATION_DELAY_MULTIPLIER = 1.5; // 50% extra time after punctuation
export const LONG_WORD_THRESHOLD = 10;
export const LONG_WORD_DELAY_MULTIPLIER = 1.2;

// Punctuation that triggers delays
export const PAUSE_PUNCTUATION = ['.', ',', ';', ':', '!', '?', '—', '–'];
export const SENTENCE_END_PUNCTUATION = ['.', '!', '?'];

// Theme definitions
export interface Theme {
	name: string;
	background: string;
	text: string;
	orp: string;
	guideLines: string;
	controlsBg: string;
	controlsText: string;
}

export const THEMES: Record<string, Theme> = {
	dark: {
		name: 'Dark',
		background: '#1a1a1a',
		text: '#e0e0e0',
		orp: '#ff4444',
		guideLines: '#444444',
		controlsBg: '#2a2a2a',
		controlsText: '#e0e0e0'
	},
	light: {
		name: 'Light',
		background: '#f5f5f5',
		text: '#1a1a1a',
		orp: '#cc0000',
		guideLines: '#cccccc',
		controlsBg: '#ffffff',
		controlsText: '#1a1a1a'
	},
	sepia: {
		name: 'Sepia',
		background: '#f4ecd8',
		text: '#5c4b37',
		orp: '#8b0000',
		guideLines: '#d4c4a8',
		controlsBg: '#e8dcc8',
		controlsText: '#5c4b37'
	},
	highContrast: {
		name: 'High Contrast',
		background: '#000000',
		text: '#ffffff',
		orp: '#ff0000',
		guideLines: '#333333',
		controlsBg: '#111111',
		controlsText: '#ffffff'
	}
};

export const DEFAULT_THEME = 'dark';

// Font settings
export const DEFAULT_FONT_SIZE = 48;
export const MIN_FONT_SIZE = 24;
export const MAX_FONT_SIZE = 96;
export const FONT_SIZE_STEP = 4;

export const FONT_FAMILIES = [
	{ name: 'System', value: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' },
	{ name: 'Inter', value: '"Inter", system-ui, sans-serif' },
	{ name: 'Georgia', value: 'Georgia, "Times New Roman", serif' },
	{ name: 'Monospace', value: 'ui-monospace, "SF Mono", Menlo, Monaco, monospace' }
];

export const DEFAULT_FONT_FAMILY = FONT_FAMILIES[0].value;

// Storage keys
export const STORAGE_KEYS = {
	settings: 'rsvp-settings',
	progress: 'rsvp-progress',
	recentFiles: 'rsvp-recent-files'
} as const;

// Navigation chunk sizes (fallback if no page info)
export const WORDS_PER_PAGE = 250;
export const WORDS_PER_PARAGRAPH = 50; // Approximate, actual paragraphs used when available
