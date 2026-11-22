/**
 * Silent-letter (lettres muettes) mask for one word, précision > rappel:
 * every rule either matches a closed lexicon or a safe orthographic pattern;
 * anything ambiguous is left unmarked — a wrongly grayed letter would teach
 * a wrong pronunciation, a missing one costs nothing.
 *
 * Rules apply to the LAST elision/hyphen segment only (l'histoire, peut-être)
 * and run AFTER the liaison pass: a liaison revives the final consonant
 * (c'e(s)t‿un — the t turns back on under the arc).
 */

import {
  D_PRONOUNCED,
  E_PRONOUNCED_MONOSYLLABLES,
  ENT_FINAL_T_ONLY,
  ENT_PLURAL_VERBS,
  ES_S_ONLY,
  G_SILENT_PATTERN,
  H_ASPIRE_WORDS,
  NUMBER_WORDS,
  P_SILENT,
  S_NEVER_MARK,
  SIGHT_WORD_MASKS,
  T_PRONOUNCED,
  X_PRONOUNCED,
  Z_PRONOUNCED,
} from "./lexicon";
import { VOWELS } from "./liaisons";
import type { WordInfo } from "./word-info";

export interface SilentContext {
  /** The final consonant is consumed (pronounced) by a liaison. */
  liaisonConsumesFinal: boolean;
  /** The next word (contextual `plus` rule); null at paragraph end. */
  next: WordInfo | null;
  /** Last segment of the previous word (ils/elles gate for -ent verbs). */
  prevLastSeg: string | null;
}

/**
 * Would this word's FINAL consonant be silent, were the word to end here?
 * Shared by the direct rule and the plural cascade (cha(ts) = chat + s).
 */
function finalConsonantSilent(seg: string): boolean {
  const last: string | undefined = seg.at(-1);
  const beforeLast = seg.at(-2);
  switch (last) {
    case "s": {
      return !S_NEVER_MARK.has(seg);
    }
    case "t": {
      // -ct and -st finals are unpredictable (direct vs respect, ouest) —
      // never marked outside the lexicons.
      return !T_PRONOUNCED.has(seg) && beforeLast !== "c" && beforeLast !== "s";
    }
    case "d": {
      return !D_PRONOUNCED.has(seg);
    }
    case "x": {
      return !X_PRONOUNCED.has(seg);
    }
    case "z": {
      return !Z_PRONOUNCED.has(seg);
    }
    case "p": {
      // Inverted default: loanwords pronounce a final p (stop, cap), so
      // only the known-silent allowlist is grayed.
      return P_SILENT.has(seg);
    }
    case "g": {
      return G_SILENT_PATTERN.test(seg);
    }
    default: {
      return false;
    }
  }
}

/** Rule 1 — irregular sight words: exact mask, '.'=pronounced 'x'=silent. */
function sightWordRule(seg: string): number[] | null {
  const mask = SIGHT_WORD_MASKS.get(seg);
  if (mask === undefined || mask.length !== seg.length) {
    return null;
  }
  const silent: number[] = [];
  for (let i = 0; i < mask.length; i += 1) {
    if (mask.charAt(i) === "x") {
      silent.push(i);
    }
  }
  return silent;
}

/**
 * Rule 2 — -ent: unambiguous plural-verb FORM (lexicon) or ils/elles subject
 * → verb ending fully silent; known noun/adverb → t only; anything else
 * stays UNMARKED (graying just the t of a plural verb — les amis jouen(t) —
 * would teach a wrong [ɑ̃] reading).
 */
function entRule(seg: string, prevLastSeg: string | null): number[] | null {
  if (seg.length < 4 || !seg.endsWith("ent")) {
    return null;
  }
  if (
    ENT_PLURAL_VERBS.has(seg) ||
    prevLastSeg === "ils" ||
    prevLastSeg === "elles"
  ) {
    return [seg.length - 3, seg.length - 2, seg.length - 1];
  }
  return ENT_FINAL_T_ONLY.has(seg) ? [seg.length - 1] : [];
}

/**
 * Rules 3+4 — final e muet and -es plurals: le(s) [le] keeps its e,
 * pomm(es) grays both. No cascade past the e — the consonant before it is
 * pronounced (vert(es), petit(e)).
 */
function silentERule(seg: string): number[] | null {
  const last = seg.at(-1);
  if (last === "s" && seg.at(-2) === "e") {
    return ES_S_ONLY.has(seg)
      ? [seg.length - 1]
      : [seg.length - 2, seg.length - 1];
  }
  if (last === "e") {
    return E_PRONOUNCED_MONOSYLLABLES.has(seg) ? [] : [seg.length - 1];
  }
  return null;
}

/**
 * Rule 5 — final silent consonant, with ONE cascade through a bare plural s
 * (cha(ts), gran(ds), cham(ps), lon(gs)).
 */
function consonantRule(seg: string): number[] {
  if (!finalConsonantSilent(seg)) {
    return [];
  }
  const silent = [seg.length - 1];
  if (seg.endsWith("s") && seg.length >= 3) {
    const stem = seg.slice(0, -1);
    if (finalConsonantSilent(stem) && !stem.endsWith("s")) {
      silent.unshift(seg.length - 2);
    }
  }
  return silent;
}

/**
 * Rule 6 — contextual `plus`: /ply/ vs /plys/ needs parsing in general, so
 * the generic s rule never marks it (`S_NEVER_MARK`). But directly before a
 * consonant word, /ply/ is the only reading (le plus joli, plus haut, ne
 * montent plus vers…) — EXCEPT the guarded ambiguities, each left unmarked:
 *  - trailing punctuation → phrase-final `plus` may be /plys/ (j'en veux plus !),
 *  - `plus que/de` (also elided qu'/d') → quantity reading /plys/ possible,
 *  - numbers on the right → arithmetic (deux plus deux font quatre),
 *  - vowel or h-muet/unknown-h start → the optional liaison /plyz/ exists.
 */
function plusSilentS(info: WordInfo, next: WordInfo | null): boolean {
  if (info.trail !== "") {
    return false;
  }
  if (next?.lead !== "" || next.hasDigit || next.norm === "") {
    return false;
  }
  const n = next.norm;
  if (
    NUMBER_WORDS.has(n) ||
    n === "que" ||
    n === "de" ||
    n.startsWith("qu'") ||
    n.startsWith("d'")
  ) {
    return false;
  }
  const first = n.charAt(0);
  if (first === "h") {
    return H_ASPIRE_WORDS.has(n);
  }
  return !VOWELS.has(first);
}

/** Mark the final-letter cluster of `seg`; returns silent indexes into seg. */
function finalClusterSilent(seg: string, prevLastSeg: string | null): number[] {
  if (seg.length < 2) {
    return [];
  }
  return (
    sightWordRule(seg) ??
    entRule(seg, prevLastSeg) ??
    silentERule(seg) ??
    consonantRule(seg)
  );
}

/**
 * Compute the silent mask over `info.core` (true = silent). Pure; the
 * renderer groups the mask into runs.
 */
export function silentMask(info: WordInfo, ctx: SilentContext): boolean[] {
  const mask: boolean[] = new Array(info.core.length).fill(false);
  if (info.core === "" || info.hasDigit) {
    return mask;
  }
  const seg = info.lastSeg;
  const offset = info.lastSegStart;

  if (info.isProper) {
    // Proper nouns: only the final e muet is safe (Arsèn(e)) — their
    // consonants are unpredictable (Paris vs Boris).
    if (seg.length >= 2 && seg.endsWith("e") && !ctx.liaisonConsumesFinal) {
      mask[info.core.length - 1] = true;
    }
    return mask;
  }

  // "est" the sight word is être; "l'est" may be the compass point — skip.
  const skipSight = seg === "est" && info.norm === "l'est";
  if (!skipSight) {
    for (const i of finalClusterSilent(seg, ctx.prevLastSeg)) {
      mask[offset + i] = true;
    }
  }

  // Contextual `plus` (rule 6): the only S_NEVER_MARK word with a context
  // where its s is CERTAINLY silent — see plusSilentS.
  if (seg === "plus" && plusSilentS(info, ctx.next)) {
    mask[info.core.length - 1] = true;
  }

  // Initial h is silent whether muet or aspiré (aspiration only affects the
  // liaison, handled separately) — l'(h)istoire, le (h)ibou.
  if (seg.startsWith("h")) {
    mask[offset] = true;
  }

  // Liaison override, always last: the consumed final consonant is
  // pronounced under the arc (le(s) → les‿amis).
  if (ctx.liaisonConsumesFinal) {
    mask[info.core.length - 1] = false;
  }
  return mask;
}
