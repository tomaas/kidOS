/**
 * The reading-aids pipeline: paragraph string → annotated tokens.
 * Tokenization is the exact `/(\s+)/` split the screen renderer already
 * uses, so wrapping and copy/paste stay byte-identical; liaisons are decided
 * first (they revive the consumed final consonant), silent letters second.
 */

import { decideLiaison } from "./liaisons";
import { silentMask } from "./silent-letters";
import type { AnnotatedToken, LetterRun } from "./types";
import { endsSentence, parseWord } from "./word-info";
import type { WordInfo } from "./word-info";

// Word / whitespace splitter that keeps the separators.
const WHITESPACE_SPLIT = /(\s+)/;

const WHITESPACE = /^\s+$/;

/** Fold a per-character silent mask into minimal same-state runs. */
function toRuns(info: WordInfo, mask: boolean[]): LetterRun[] {
  const runs: LetterRun[] = [];
  const push = (text: string, silent: boolean) => {
    if (text === "") {
      return;
    }
    const prev = runs.at(-1);
    if (prev && prev.silent === silent) {
      prev.text += text;
    } else {
      runs.push({ silent, text });
    }
  };
  push(info.lead, false);
  for (let i = 0; i < info.core.length; i += 1) {
    push(info.core.charAt(i), mask[i] === true);
  }
  push(info.trail, false);
  return runs;
}

/** Annotate one paragraph. Pure and deterministic — safe to memoize. */
export function annotateParagraph(text: string): AnnotatedToken[] {
  const rawTokens = text
    .split(WHITESPACE_SPLIT)
    .filter((token) => token.length > 0);

  // First pass: parse every word with sentence-position tracking (the
  // proper-noun gate needs to know mid-sentence capitals).
  const infos: (WordInfo | null)[] = [];
  let sentenceStart = true;
  for (const raw of rawTokens) {
    if (WHITESPACE.test(raw)) {
      infos.push(null);
      continue;
    }
    const info = parseWord(raw, sentenceStart);
    infos.push(info);
    if (endsSentence(info)) {
      sentenceStart = true;
    } else if (info.core !== "") {
      sentenceStart = false;
    }
  }

  // Word neighbours (the split alternates word/gap, so words sit 2 apart).
  // Guard i < 0: Array.at() would wrap to the end of the paragraph.
  const wordAt = (i: number): WordInfo | null =>
    i >= 0 ? (infos.at(i) ?? null) : null;

  // Liaison pass: pairs of adjacent words across a single gap.
  const liaisonAfter: boolean[] = rawTokens.map(() => false);
  for (let i = 0; i < infos.length; i += 1) {
    const w1 = infos.at(i);
    if (!w1) {
      continue;
    }
    const gap = infos.at(i + 1) === null && i + 1 < infos.length;
    const w2 = wordAt(i + 2);
    if (gap && w2) {
      liaisonAfter[i] = decideLiaison(wordAt(i - 2), w1, w2);
    }
  }

  // Silent pass + assembly.
  const tokens: AnnotatedToken[] = [];
  for (let i = 0; i < rawTokens.length; i += 1) {
    const info = infos.at(i);
    if (!info) {
      tokens.push({
        kind: "gap",
        liaison: i > 0 && liaisonAfter[i - 1] === true,
        text: rawTokens.at(i) ?? "",
      });
      continue;
    }
    const mask = silentMask(info, {
      liaisonConsumesFinal: liaisonAfter[i] === true,
      next: wordAt(i + 2),
      prevLastSeg: wordAt(i - 2)?.lastSeg ?? null,
    });
    tokens.push({
      kind: "word",
      liaisonToNext: liaisonAfter[i] === true,
      runs: toRuns(info, mask),
      text: info.raw,
    });
  }
  return tokens;
}

/**
 * Human-readable serialization for the golden tests: silent runs in
 * parentheses, liaison gaps as ‿ — "Les‿ami(s) jou(ent)".
 */
export function annotationToString(tokens: AnnotatedToken[]): string {
  let out = "";
  for (const token of tokens) {
    if (token.kind === "gap") {
      out += token.liaison ? "‿" : token.text;
      continue;
    }
    for (const run of token.runs) {
      out += run.silent ? `(${run.text})` : run.text;
    }
  }
  return out;
}

/** Concatenation invariant helper (tests): tokens → original text. */
export function annotationToPlainText(tokens: AnnotatedToken[]): string {
  return tokens
    .map((token) =>
      token.kind === "gap"
        ? token.text
        : token.runs.map((run) => run.text).join("")
    )
    .join("");
}
