/**
 * Reading aid: renders a paragraph word-by-word so that hovering the text
 * highlights ONLY the single word under the cursor (a soft rounded tint),
 * helping a young reader keep their place. Pure CSS `:hover` on per-word
 * spans — no JS mouse tracking — so it stays smooth and never gates reading.
 *
 * Whitespace is kept as its own spans so the text wraps and copies exactly as
 * the plain paragraph would; only the word tokens carry the hover style.
 *
 * Two optional CP-book reading aids (Sami-et-Julie style) layer on top:
 * `showSilent` fades the lettres muettes (`.story-silent` runs) and
 * `showLiaisons` draws an arc under mandatory liaisons (`.story-liaison-gap`
 * on the whitespace span, liaised words grouped in a nowrap span so the arc
 * never breaks across lines). Both default OFF: the legacy render path is
 * byte-identical to before. All decoration — never changes the text itself.
 */

import { useMemo } from "react";

import { annotateParagraph } from "~/lib/reading-aids";
import type { AnnotatedToken, WordToken } from "~/lib/reading-aids";

// Split into alternating word / whitespace tokens, keeping separators.
const WHITESPACE_SPLIT = /(\s+)/;

const WHITESPACE = /^\s+$/;

type RenderGroup =
  | { kind: "single"; token: AnnotatedToken; key: string }
  | { kind: "chain"; tokens: AnnotatedToken[]; key: string };

/**
 * Fold annotated tokens into render groups: maximal liaison chains
 * (word‿word[‿word…]) become one nowrap group; everything else passes
 * through. With liaisons off, every token stays single.
 */
function toRenderGroups(text: string, withChains: boolean): RenderGroup[] {
  const tokens = annotateParagraph(text);
  const groups: RenderGroup[] = [];
  let i = 0;
  while (i < tokens.length) {
    const start = tokens.at(i);
    if (!start) {
      break;
    }
    const key = `${i}:${start.text}`;
    if (withChains && start.kind === "word" && start.liaisonToNext) {
      const chain: AnnotatedToken[] = [start];
      let j = i;
      let word = tokens.at(j);
      let gap = tokens.at(j + 1);
      let next = tokens.at(j + 2);
      while (
        word?.kind === "word" &&
        word.liaisonToNext &&
        gap?.kind === "gap" &&
        next?.kind === "word"
      ) {
        chain.push(gap, next);
        j += 2;
        word = tokens.at(j);
        gap = tokens.at(j + 1);
        next = tokens.at(j + 2);
      }
      groups.push({ key, kind: "chain", tokens: chain });
      i = j + 1;
    } else {
      groups.push({ key, kind: "single", token: start });
      i += 1;
    }
  }
  return groups;
}

/** One word: silent runs get a faded span, pronounced runs stay plain. */
function AidedWord({
  word,
  showSilent,
}: {
  word: WordToken;
  showSilent: boolean;
}) {
  const faded = showSilent && word.runs.some((run) => run.silent);
  if (!faded) {
    return <span className="story-word">{word.text}</span>;
  }
  // Runs are derived synchronously from immutable text and never reorder;
  // the character offset within the word is a stable, unique key.
  const keyed: { run: (typeof word.runs)[number]; key: string }[] = [];
  let offset = 0;
  for (const run of word.runs) {
    keyed.push({ key: `${offset}:${run.text}`, run });
    offset += run.text.length;
  }
  return (
    <span className="story-word">
      {keyed.map(({ run, key }) =>
        run.silent ? (
          <span className="story-silent" key={key}>
            {run.text}
          </span>
        ) : (
          <span key={key}>{run.text}</span>
        )
      )}
    </span>
  );
}

function AidedGroup({
  group,
  showSilent,
  showLiaisons,
}: {
  group: RenderGroup;
  showSilent: boolean;
  showLiaisons: boolean;
}) {
  if (group.kind === "chain") {
    // Same stable-key scheme as AidedWord: character offset within the chain.
    const keyed: { token: AnnotatedToken; key: string }[] = [];
    let offset = 0;
    for (const token of group.tokens) {
      keyed.push({ key: `${offset}:${token.text}`, token });
      offset += token.text.length;
    }
    return (
      <span className="story-liaison-group">
        {keyed.map(({ token, key }) =>
          token.kind === "gap" ? (
            <span className="story-liaison-gap" key={key}>
              {token.text}
            </span>
          ) : (
            <AidedWord key={key} showSilent={showSilent} word={token} />
          )
        )}
      </span>
    );
  }
  const { token } = group;
  if (token.kind === "gap") {
    // A non-liaison gap renders verbatim; with liaisons off an annotated
    // liaison gap also lands here (no arc styling).
    const liaised = showLiaisons && token.liaison;
    return liaised ? (
      <span className="story-liaison-gap">{token.text}</span>
    ) : (
      <span>{token.text}</span>
    );
  }
  return <AidedWord showSilent={showSilent} word={token} />;
}

function HighlightableText({
  text,
  showSilent = false,
  showLiaisons = false,
}: {
  text: string;
  showSilent?: boolean;
  showLiaisons?: boolean;
}) {
  const aidsOn = showSilent || showLiaisons;
  // Annotation is pure and derived from the paragraph only — memoized so
  // replays/re-renders never re-run the rules pipeline.
  const groups = useMemo(
    () => (aidsOn ? toRenderGroups(text, showLiaisons) : null),
    [aidsOn, showLiaisons, text]
  );

  if (groups) {
    return (
      <>
        {groups.map((group) => (
          <AidedGroup
            group={group}
            key={group.key}
            showLiaisons={showLiaisons}
            showSilent={showSilent}
          />
        ))}
      </>
    );
  }

  // Legacy path (aids off): split into alternating word / whitespace tokens,
  // keeping the separators so spacing and line wrapping are identical to a
  // plain paragraph. The token list is derived synchronously from immutable
  // text and never reorders, so a position-based key is stable.
  const tokens = text
    .split(WHITESPACE_SPLIT)
    .filter((token) => token.length > 0)
    .map((token, position) => ({ key: `${position}:${token}`, token }));
  return (
    <>
      {tokens.map(({ token, key }) =>
        // Whitespace tokens render verbatim (no hover target).
        WHITESPACE.test(token) ? (
          <span key={key}>{token}</span>
        ) : (
          <span className="story-word" key={key}>
            {token}
          </span>
        )
      )}
    </>
  );
}

export { HighlightableText };
