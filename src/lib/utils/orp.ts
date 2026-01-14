/**
 * Calculate the Optimal Recognition Point (ORP) index for a word.
 * The ORP is the letter where the eye naturally focuses for fastest recognition.
 *
 * ORP positioning:
 * - 1-2 letters: 1st letter (index 0)
 * - 3-6 letters: 2nd letter (index 1)
 * - 7-9 letters: 3rd letter (index 2)
 * - 10+ letters: 4th letter (index 3)
 */
export function getORPIndex(word: string): number {
	const len = word.length;
	if (len <= 2) return 0;
	if (len <= 6) return 1;
	if (len <= 9) return 2;
	return 3;
}

/**
 * Split a word into three parts for ORP display:
 * - before: letters before the ORP
 * - orp: the ORP letter (highlighted)
 * - after: letters after the ORP
 */
export function splitWordAtORP(word: string): { before: string; orp: string; after: string } {
	if (!word || word.length === 0) {
		return { before: '', orp: '', after: '' };
	}

	const orpIndex = getORPIndex(word);

	return {
		before: word.slice(0, orpIndex),
		orp: word[orpIndex] || '',
		after: word.slice(orpIndex + 1)
	};
}

/**
 * Calculate display timing for a word based on WPM and word characteristics.
 * Adds extra time for punctuation and long words.
 */
export function calculateWordDuration(
	word: string,
	wpm: number,
	punctuationDelayMultiplier = 1.5,
	longWordDelayMultiplier = 1.2,
	longWordThreshold = 10
): number {
	// Base duration in milliseconds
	const baseDuration = 60000 / wpm;

	let duration = baseDuration;

	// Check for punctuation at end of word
	const lastChar = word.slice(-1);
	const punctuation = ['.', ',', ';', ':', '!', '?', '—', '–'];
	if (punctuation.includes(lastChar)) {
		duration *= punctuationDelayMultiplier;
	}

	// Extra time for long words
	if (word.length >= longWordThreshold) {
		duration *= longWordDelayMultiplier;
	}

	return Math.round(duration);
}
