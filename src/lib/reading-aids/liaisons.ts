/**
 * Mandatory-liaison decision for an adjacent word pair. MANDATORY only —
 * optional liaisons (il est‿un, sept‿ours) are deliberately skipped so an
 * arc is never wrong, only sometimes missing (précision > rappel).
 *
 * This pass runs BEFORE the silent-letter pass: a final consonant consumed
 * by a liaison is pronounced, so the caller keeps it un-grayed under the arc
 * (the convention of French reading-education books).
 */

import {
  ADJECTIVE_GATE_EXTRAS,
  H_MUET_WORDS,
  LIAISON_ADJECTIVES,
  LIAISON_ADVERBS_PREPS,
  LIAISON_CEST,
  LIAISON_DETERMINERS,
  LIAISON_PRONOUNS,
  LIAISON_TARGET_BLOCK,
  LIAISON_Y_ALLOW,
} from "./lexicon";
import type { WordInfo } from "./word-info";

/** Final consonants that can carry a liaison ([z] [t] [n]…). */
const LIAISON_FINALS = new Set(["s", "x", "z", "t", "d", "n"]);

/** Vowel LETTERS (not sounds) — shared with the contextual `plus` rule. */
export const VOWELS: ReadonlySet<string> = new Set("aàâäeéèêëiîïoôöuùûüœæ");

/** Can a liaison LAND on this word? (vowel sound start, no blockers) */
function acceptsLiaison(w2: WordInfo): boolean {
  if (w2.lead !== "" || w2.hasDigit || w2.norm === "") {
    return false;
  }
  if (LIAISON_TARGET_BLOCK.has(w2.norm)) {
    return false;
  }
  const first = w2.norm.charAt(0);
  if (first === "h") {
    // Default-deny: an h-word liaises only if KNOWN h muet (les‿heures);
    // unknown h is treated as aspiré (le hibou, les | hérissons).
    return H_MUET_WORDS.has(w2.norm);
  }
  if (first === "y") {
    return LIAISON_Y_ALLOW.has(w2.norm);
  }
  return VOWELS.has(first);
}

/** Is this word a liaison trigger in its context? (prev = word before w1) */
function triggersLiaison(prev: WordInfo | null, w1: WordInfo): boolean {
  if (LIAISON_CEST.has(w1.norm)) {
    return true;
  }
  const t = w1.lastSeg; // covers elided triggers: qu'ils‿ont, n'en‿ai
  if (
    LIAISON_DETERMINERS.has(t) ||
    LIAISON_PRONOUNS.has(t) ||
    LIAISON_ADVERBS_PREPS.has(t)
  ) {
    return true;
  }
  if (LIAISON_ADJECTIVES.has(t)) {
    // Prenominal only: gated on a preceding determiner (un petit‿ours),
    // never as a predicate (il est grand aussi).
    const gate = prev?.lastSeg ?? "";
    return LIAISON_DETERMINERS.has(gate) || ADJECTIVE_GATE_EXTRAS.has(gate);
  }
  return false;
}

/**
 * Decide the mandatory liaison w1 → w2. `prev` is the word before w1 (the
 * determiner gate for prenominal adjectives).
 */
export function decideLiaison(
  prev: WordInfo | null,
  w1: WordInfo,
  w2: WordInfo
): boolean {
  // Any punctuation between the words kills the liaison (les, amis).
  if (w1.trail !== "" || w1.hasDigit || w1.norm === "") {
    return false;
  }
  if (!LIAISON_FINALS.has(w1.norm.at(-1) ?? "")) {
    return false;
  }
  return acceptsLiaison(w2) && triggersLiaison(prev, w1);
}
