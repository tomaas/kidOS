import type { Place } from "~/config/places";

export type Lang = "fr" | "ru" | "en";

/**
 * The optional comforting companion, resolved (snapshot or config) for prompt
 * building. `promptHint` goes into the TEXT prompt, `imageHint` into the IMAGE
 * prompt. Undefined = no doudou → nothing injected.
 */
export interface DoudouContext {
  imageHint: string;
  label: string;
  promptHint: string;
}

/**
 * One hero, resolved (snapshot or config) for prompt building. Heroes are
 * MULTI-select: `hero[0]` is the PRIMARY hero (named-hard safety contract);
 * `label` is the name shown to the child + checked in the safety validation,
 * `promptHint` is the GUIDING DESCRIPTION injected into the TEXT prompt (the
 * old single `Character.description`), `imageHint` drives the IMAGE prompt.
 */
export interface HeroContext {
  imageHint: string;
  label: string;
  promptHint: string;
}

/**
 * One surprise element, resolved (snapshot or config) for prompt building.
 * MULTI-select. `promptHint` is the GUIDING DESCRIPTION injected into the TEXT
 * prompt (the old single `StoryElement.promptHint`). Elements never drive the
 * illustration, so there is no image hint.
 */
export interface ElementContext {
  label: string;
  promptHint: string;
}

/** A prior beat, compacted for conditioning the next one. */
export interface BeatHistoryEntry {
  chosenLabel: string;
  // The two labels that were offered, and which one the child picked.
  offered: [string, string];
  paragraphs: string[];
  // The scene the illustrator was given for this beat. Rendered into the next
  // beat's prompt so the model SEES the prior scenes and keeps the new
  // sceneHint's time-of-day/light/setting continuous instead of jumping from
  // day to night between pages. Undefined on older segments → line omitted.
  sceneHint?: string;
}

export interface GenerateBeatInput {
  // Optional, already-sanitized "saveur" frozen on the story; passed into EVERY
  // beat (incl. continuation/crash-resume) so the flavour persists. Omitted on
  // corrective retries (see provider) so odd flavour can't cause repeated fails.
  customPrompt?: string;
  // Optional comforting companions, frozen on the story → passed into EVERY beat
  // (opening / continuation / crash-resume) so they are present throughout.
  // Empty array = no doudou.
  doudous: DoudouContext[];
  // The chosen surprise elements (≥1).
  elements: ElementContext[];
  // The chosen heroes (≥1; heroes[0] is the primary, named-hard hero).
  heroes: HeroContext[];
  // Ordered prior beats (empty for the opening beat).
  history: BeatHistoryEntry[];
  lang: Lang;
  // When true, the model MUST end the story now (final beat, no choices).
  mustEnd: boolean;
  place: Place;
  // How many choices the child still has to make, COUNTING the one this beat
  // itself offers (MAX_CHOICES minus the choices already made). 1 = this beat
  // carries the story's last choice. Lets the prompt announce "la fin approche"
  // on the last 2 beats so the ending lands softly instead of hitting the
  // mustEnd wall. Undefined on the opening beat / for callers that don't track it.
  remainingChoices?: number;
  // The hidden "fil rouge" generated at story creation (goal → milestones →
  // ending image). Injected into every beat prompt so the story advances along
  // ONE thread and the surprise element pays off. Undefined (old stories / arc
  // generation soft-failed) → beats generate without it, as before.
  storyArc?: string;
}

/**
 * One generated beat. The model emits choice LABELS ONLY (no ids) — the server
 * assigns stable ids. `choices` is null on the final beat. A non-final beat has
 * exactly two choices.
 */
export interface DynamicBeat {
  choices: [string, string] | null;
  isFinal: boolean;
  paragraphs: string[];
  // Short visual description of THIS beat's scene (for the illustrator prompt):
  // where the action happens right now, so the image can follow the story out
  // of the frozen starting place. Optional so coercion/fallback paths that lack
  // it still yield a valid beat (image falls back to the place hint).
  sceneHint?: string;
  title?: string; // present on the opening beat; sets the story title
}

/**
 * Input for the one-shot hidden story-arc ("fil rouge") generation at story
 * creation: the same frozen context as a beat, minus history/choices.
 */
export interface GenerateArcInput {
  customPrompt?: string;
  doudous: DoudouContext[];
  elements: ElementContext[];
  heroes: HeroContext[];
  lang: Lang;
  place: { label: string; promptHint: string };
}

/**
 * The one-shot creation-time author notes: the hidden narrative arc plus the
 * story's "visual world" (time of day, season, weather, light — one concrete
 * sentence for the illustrator) plus the characters' outfit (the fixed wardrobe
 * every illustration must reuse). All three come from the SAME LLM call (zero
 * extra cost) and are frozen on the story row. The arc steers every BEAT
 * prompt; the visual world + outfit steer every IMAGE prompt so illustrations
 * of one story stop drifting from day to night — or changing the heroes'
 * clothes — between pages.
 */
export interface StoryArcResult {
  arc: string;
  // The heroes' wardrobe for the whole story. Scanned INDEPENDENTLY of arc/
  // visualWorld: a forbidden word here nulls only the outfit (the least-critical
  // note), never the whole arc. Null → no outfit line (image built as before).
  outfit: string | null;
  visualWorld: string;
}

// NOTE (adapter census): text generation (`text/dynamic.ts`) and image
// generation (`image/nanobanana.ts`) each have exactly ONE implementation,
// imported by concrete name — they are plain modules, not injected adapters,
// so no interface exists for them here (re-introduce one only when a second
// adapter actually arrives). TTS below IS a real seam: two live adapters,
// env-switched via `getTtsProvider()`.

/**
 * The outcome of an image-generation attempt, surfaced from the server fns to
 * the client so the UI can tell apart three settled states (no DB column — this
 * is per-request, not persisted):
 *  - "ready"   → an illustration exists (path set);
 *  - "failed"  → generation was attempted and errored (logged server-side); the
 *               UI shows a calm "no drawing this time" state, NOT infinite loading;
 *  - "skipped" → images are off (IMAGE_ENABLED=false) or there was nothing to
 *               draw (no story/segment) — the intended calm placeholder, not a
 *               failure.
 */
export type ImageStatus = "ready" | "failed" | "skipped";

/** The discriminated result every image server fn returns. `imagePath` is set
 * only when `imageStatus === "ready"`. */
export interface ImageResult {
  imagePath: string | null;
  imageStatus: ImageStatus;
}

/**
 * TERMINAL FAILURE SENTINEL persisted into the `image_path` column.
 *
 * Image generation/upload is best-effort and can fail transiently (Gemini
 * quota, a Blob upload error, a network stall). Before this sentinel, a failure
 * was surfaced PER-REQUEST only (the `ImageStatus` return) and never written to
 * the row — so every remount / HMR reload / reopen re-attempted generation and
 * re-showed the "L'histoire se dessine…" waiting screen (effectively an infinite
 * spinner in the field). Writing this marker makes the failure TERMINAL: the
 * row now records "we tried, no picture", so the server short-circuits future
 * attempts (no repeated Gemini spend) and the UI reveals the text at once with
 * the calm "no drawing today" placeholder.
 *
 * It is a deliberately non-URL, non-path string so it can never be mistaken for
 * a renderable src. ALWAYS read a persisted image path through
 * `resolveStoredImagePath` so the sentinel is translated to `(null, "failed")`
 * and never leaks into an `<img src>`.
 */
export const IMAGE_FAILED_SENTINEL = "__failed__";

/**
 * Translate a value READ from `image_path` (story or segment) into the UI pair.
 * The sentinel → a settled `failed` state with no path; a real path → `ready`;
 * null/empty → `skipped` (nothing yet / images off — the calm placeholder).
 */
export function resolveStoredImagePath(stored: string | null | undefined): {
  imagePath: string | null;
  imageStatus: ImageStatus;
} {
  if (stored === IMAGE_FAILED_SENTINEL) {
    return { imagePath: null, imageStatus: "failed" };
  }
  if (stored) {
    return { imagePath: stored, imageStatus: "ready" };
  }
  return { imagePath: null, imageStatus: "skipped" };
}

/** True when a stored image path is a real, renderable src (not null, not the
 * terminal failure sentinel). Use at every raw `<img src>` render site. */
export function isRenderableImagePath(
  stored: string | null | undefined
): stored is string {
  return !!stored && stored !== IMAGE_FAILED_SENTINEL;
}

/**
 * TTS provider — turns story text into an audio file path under DATA_DIR.
 * Default implementation targets msedge-tts (free French voices).
 */
export interface TtsProvider {
  synthesize: (text: string, lang: Lang) => Promise<string>;
}
