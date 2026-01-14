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
 * Check if a word contains a number.
 * Matches any word containing digits, which covers:
 * - Integers: "42", "-100", "+5"
 * - Decimals: "98.4", "3.14", "-0.5"
 * - Scientific notation: "1.5e10", "6.022e23"
 * - Percentages: "100%", "98.4%"
 * - Fractions: "1/2", "3/4"
 * - Dates, times, measurements, etc.
 */
function containsNumber(word: string): boolean {
	return /\d/.test(word);
}

/**
 * Check if a word looks like a proper name.
 * Heuristic: starts with capital letter, not all caps (not an acronym),
 * and has at least 2 letters.
 */
function looksLikeName(word: string): boolean {
	if (word.length < 2) return false;

	// Get just the alphabetic part (strip leading punctuation like quotes)
	const alphaStart = word.search(/[a-zA-Z]/);
	if (alphaStart === -1) return false;

	const alphaWord = word.slice(alphaStart).replace(/[^a-zA-Z]/g, '');
	if (alphaWord.length < 2) return false;

	const firstLetter = alphaWord[0];

	// Must start with uppercase
	if (firstLetter !== firstLetter.toUpperCase()) return false;

	// Must not be all uppercase (likely an acronym)
	if (alphaWord === alphaWord.toUpperCase()) return false;

	return true;
}

/**
 * Calculate display timing for a word based on WPM and word characteristics.
 * Adds extra time for punctuation, long words, names, and numbers.
 */
export function calculateWordDuration(
	word: string,
	wpm: number,
	punctuationDelayMultiplier = 1.5,
	longWordDelayMultiplier = 1.2,
	longWordThreshold = 10,
	nameDelayMultiplier = 1.3,
	numberDelayMultiplier = 1.3
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

	// Extra time for names/proper nouns
	if (nameDelayMultiplier > 1 && looksLikeName(word)) {
		duration *= nameDelayMultiplier;
	}

	// Extra time for numbers (dates, percentages, decimals, etc.)
	if (numberDelayMultiplier > 1 && containsNumber(word)) {
		duration *= numberDelayMultiplier;
	}

	return Math.round(duration);
}
