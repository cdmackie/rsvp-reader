import { writable, derived, get } from 'svelte/store';
import { documentStore, totalWords } from './document';
import { settings } from './settings';
import { calculateWordDuration } from '../utils/orp';
import {
	getPageForWordIndex,
	getParagraphForWordIndex,
	getNextParagraphStart,
	getPreviousParagraphStart,
	getNextPageStart,
	getPreviousPageStart,
	type ParsedDocument
} from '../utils/text-parser';
import {
	getChapterForWordIndex,
	getWordIndexForChapter,
	type ParsedEpub
} from '../utils/epub-parser';
import { saveProgress, loadProgress } from '../utils/storage';

export interface ReaderState {
	wordIndex: number;
	isPlaying: boolean;
	hasStarted: boolean;
}

const initialState: ReaderState = {
	wordIndex: 0,
	isPlaying: false,
	hasStarted: false
};

function createReaderStore() {
	const { subscribe, set, update } = writable<ReaderState>(initialState);
	let playbackInterval: ReturnType<typeof setTimeout> | null = null;

	const clearPlayback = () => {
		if (playbackInterval) {
			clearTimeout(playbackInterval);
			playbackInterval = null;
		}
	};

	const scheduleNextWord = () => {
		const state = get({ subscribe });
		const doc = get(documentStore);
		const currentSettings = get(settings);

		if (!state.isPlaying || !doc.document) {
			clearPlayback();
			return;
		}

		const words = doc.document.words;
		if (state.wordIndex >= words.length - 1) {
			// Reached end
			update(s => ({ ...s, isPlaying: false }));
			clearPlayback();
			return;
		}

		const currentWord = words[state.wordIndex];
		// Guard against undefined word (race condition/edge case)
		if (!currentWord) {
			clearPlayback();
			update(s => ({ ...s, isPlaying: false }));
			return;
		}

		const duration = calculateWordDuration(
			currentWord.text,
			currentSettings.wpm,
			currentSettings.pauseOnPunctuation ? currentSettings.punctuationDelayMultiplier : 1,
			currentSettings.longWordDelayMultiplier,
			10, // longWordThreshold
			currentSettings.pauseOnNames ? currentSettings.nameDelayMultiplier : 1
		);

		playbackInterval = setTimeout(() => {
			// Re-fetch document to avoid stale reference
			const currentDoc = get(documentStore);
			if (!currentDoc.document) {
				clearPlayback();
				return;
			}

			update(s => {
				const newIndex = s.wordIndex + 1;
				// Save progress periodically (every 10 words)
				if (newIndex % 10 === 0 && currentDoc.fileKey) {
					saveProgress(currentDoc.fileKey, newIndex, currentDoc.document!.words.length);
				}
				return { ...s, wordIndex: newIndex };
			});
			scheduleNextWord();
		}, duration);
	};

	return {
		subscribe,
		play: () => {
			update(s => ({ ...s, isPlaying: true, hasStarted: true }));
			scheduleNextWord();
		},
		pause: () => {
			clearPlayback();
			update(s => ({ ...s, isPlaying: false }));
			// Save progress on pause
			const doc = get(documentStore);
			const state = get({ subscribe });
			if (doc.fileKey && doc.document) {
				saveProgress(doc.fileKey, state.wordIndex, doc.document.words.length);
			}
		},
		toggle: () => {
			const state = get({ subscribe });
			if (state.isPlaying) {
				clearPlayback();
				update(s => ({ ...s, isPlaying: false }));
				const doc = get(documentStore);
				if (doc.fileKey && doc.document) {
					saveProgress(doc.fileKey, state.wordIndex, doc.document.words.length);
				}
			} else {
				update(s => ({ ...s, isPlaying: true, hasStarted: true }));
				scheduleNextWord();
			}
		},
		setWordIndex: (index: number) => {
			const doc = get(documentStore);
			if (!doc.document) return;

			const maxIndex = doc.document.words.length - 1;
			const clampedIndex = Math.max(0, Math.min(index, maxIndex));

			update(s => ({ ...s, wordIndex: clampedIndex, hasStarted: true }));
		},
		nextWord: () => {
			update(s => {
				const doc = get(documentStore);
				if (!doc.document) return s;
				const maxIndex = doc.document.words.length - 1;
				return { ...s, wordIndex: Math.min(s.wordIndex + 1, maxIndex), hasStarted: true };
			});
		},
		prevWord: () => {
			update(s => ({ ...s, wordIndex: Math.max(s.wordIndex - 1, 0), hasStarted: true }));
		},
		nextParagraph: () => {
			update(s => {
				const doc = get(documentStore);
				if (!doc.document) return s;
				const newIndex = getNextParagraphStart(doc.document, s.wordIndex);
				return { ...s, wordIndex: newIndex, hasStarted: true };
			});
		},
		prevParagraph: () => {
			update(s => {
				const doc = get(documentStore);
				if (!doc.document) return s;
				const newIndex = getPreviousParagraphStart(doc.document, s.wordIndex);
				return { ...s, wordIndex: newIndex, hasStarted: true };
			});
		},
		nextPage: () => {
			update(s => {
				const doc = get(documentStore);
				if (!doc.document) return s;
				const newIndex = getNextPageStart(doc.document, s.wordIndex);
				return { ...s, wordIndex: newIndex, hasStarted: true };
			});
		},
		prevPage: () => {
			update(s => {
				const doc = get(documentStore);
				if (!doc.document) return s;
				const newIndex = getPreviousPageStart(doc.document, s.wordIndex);
				return { ...s, wordIndex: newIndex, hasStarted: true };
			});
		},
		goToChapter: (chapterIndex: number) => {
			update(s => {
				const doc = get(documentStore);
				if (!doc.document || doc.fileType !== 'epub') return s;
				const newIndex = getWordIndexForChapter(doc.document as ParsedEpub, chapterIndex);
				return { ...s, wordIndex: newIndex, hasStarted: true };
			});
		},
		goToStart: () => {
			update(s => ({ ...s, wordIndex: 0 }));
		},
		goToEnd: () => {
			update(s => {
				const doc = get(documentStore);
				if (!doc.document) return s;
				return { ...s, wordIndex: doc.document.words.length - 1, hasStarted: true };
			});
		},
		restoreProgress: (fileKey: string) => {
			const progress = loadProgress(fileKey);
			if (progress) {
				update(s => ({ ...s, wordIndex: progress.wordIndex }));
				return true;
			}
			return false;
		},
		reset: () => {
			clearPlayback();
			set(initialState);
		}
	};
}

export const reader = createReaderStore();

// Derived stores
export const currentWordIndex = derived(reader, ($reader) => $reader.wordIndex);
export const isPlaying = derived(reader, ($reader) => $reader.isPlaying);
export const hasStarted = derived(reader, ($reader) => $reader.hasStarted);

export const currentWord = derived(
	[reader, documentStore],
	([$reader, $doc]) => {
		if (!$doc.document || $doc.document.words.length === 0) {
			return null;
		}
		return $doc.document.words[$reader.wordIndex] || null;
	}
);

export const currentWordText = derived(currentWord, ($word) => $word?.text ?? '');

export const currentPage = derived(
	[reader, documentStore],
	([$reader, $doc]) => {
		if (!$doc.document) return 0;
		return getPageForWordIndex($doc.document, $reader.wordIndex);
	}
);

export const currentParagraph = derived(
	[reader, documentStore],
	([$reader, $doc]) => {
		if (!$doc.document) return 0;
		return getParagraphForWordIndex($doc.document, $reader.wordIndex);
	}
);

export const currentChapter = derived(
	[reader, documentStore],
	([$reader, $doc]) => {
		if (!$doc.document || $doc.fileType !== 'epub') return 0;
		return getChapterForWordIndex($doc.document as ParsedEpub, $reader.wordIndex);
	}
);

export const progress = derived(
	[reader, totalWords],
	([$reader, $totalWords]) => {
		if ($totalWords <= 1) return 0;
		return ($reader.wordIndex / ($totalWords - 1)) * 100;
	}
);

export const timeRemaining = derived(
	[reader, totalWords, settings],
	([$reader, $totalWords, $settings]) => {
		const wordsLeft = $totalWords - $reader.wordIndex;
		if (wordsLeft <= 0 || $settings.wpm <= 0) return 0;
		return Math.ceil((wordsLeft / $settings.wpm) * 60); // seconds
	}
);

export const timeRemainingFormatted = derived(timeRemaining, ($seconds) => {
	if ($seconds <= 0) return '0:00';
	const minutes = Math.floor($seconds / 60);
	const secs = $seconds % 60;
	if (minutes >= 60) {
		const hours = Math.floor(minutes / 60);
		const mins = minutes % 60;
		return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
	}
	return `${minutes}:${secs.toString().padStart(2, '0')}`;
});
