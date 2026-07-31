import { createServerFn } from "@tanstack/react-start";
import { and, asc, eq, isNotNull, isNull, lt, ne } from "drizzle-orm";
import { z } from "zod";
import { composeBranding } from "~/config/app";
import { resolveImageModel } from "~/config/image-models";
import { getAppConfig, type ProviderConfig } from "~/server/app-config";
import { db } from "~/server/db";
import {
  type SegmentChoice,
  type Story,
  type StorySegment,
  stories,
  storySegments,
} from "~/server/db/schema";
import { resolveDoudousForCreation } from "~/server/doudous-store";
import { resolveElementsForCreation } from "~/server/elements-store";
import { resolveHeroesForCreation } from "~/server/heroes-store";
import { resolvePlaceForCreation } from "~/server/places-store";
import { generateImage } from "~/server/providers/image/nanobanana";
import { buildSegmentImagePrompt } from "~/server/providers/image/segment-prompt";
import { resolveStoredMediaForModel } from "~/server/providers/media-store";
import { sanitizeCustomPrompt } from "~/server/providers/text/custom-prompt";
import {
  generateBeat,
  generateStoryArc,
} from "~/server/providers/text/dynamic";
import {
  type BeatHistoryEntry,
  type DynamicBeat,
  IMAGE_FAILED_SENTINEL,
  type ImageResult,
  resolveStoredImagePath,
} from "~/server/providers/types";
import { getFrozenStoryPromptContext } from "~/server/story-context";

// Max choice points per story. After the 4th chosen choice, the next beat is
// forced to be final. Was 5 — the TOTAL reading volume of a full story still
// tired a beginning reader even with the landing decrescendo.
const MAX_CHOICES = 4;

// Calm-tool guardrails (codex #2/#6), mirrored from functions.ts.
const HERO_CAP = 2;
const ELEMENT_CAP = 2;

const langSchema = z.enum(["fr", "ru", "en"]).default("fr");

const startSchema = z.object({
  customPrompt: z.string().max(500).optional(),
  // Optional comforting companions (multi-select) — empty/absent = no doudou.
  doudouIds: z.array(z.string()).optional(),
  // Elements REQUIRED + multi-select (≥1, ≤ cap).
  elementIds: z.array(z.string()).min(1).max(ELEMENT_CAP),
  // Heroes REQUIRED + multi-select (≥1, ≤ cap). heroIds[0] is the primary.
  heroIds: z.array(z.string()).min(1).max(HERO_CAP),
  lang: langSchema.optional(),
  placeId: z.string(),
});

export type DynamicStartResult =
  | { success: true; storyId: string; segment: StorySegment }
  | { success: false; error: string };

export type DynamicContinueResult =
  | { success: true; segment: StorySegment }
  | { success: false; error: string };

// Server assigns stable choice ids; the model only ever emits labels.
function toChoices(labels: [string, string]): SegmentChoice[] {
  return [
    { id: "a", label: labels[0] },
    { id: "b", label: labels[1] },
  ];
}

/** Build the compact, complete ordered history for conditioning the next beat. */
function toHistory(segments: StorySegment[]): BeatHistoryEntry[] {
  const history: BeatHistoryEntry[] = [];
  for (const seg of segments) {
    if (!(seg.choices && seg.chosenChoiceId)) {
      continue; // unchosen / final beats don't contribute a decision
    }
    const chosen = seg.choices.find((c) => c.id === seg.chosenChoiceId);
    history.push({
      chosenLabel: chosen?.label ?? seg.choices[0].label,
      offered: [seg.choices[0].label, seg.choices[1].label],
      paragraphs: seg.paragraphs,
      // The prior beats' scenes condition the next sceneHint (time-of-day/
      // light continuity). Null on older segments → omitted from the prompt.
      sceneHint: seg.sceneHint ?? undefined,
    });
  }
  return history;
}

function beatToSegmentValues(beat: DynamicBeat) {
  return {
    choices: beat.choices ? toChoices(beat.choices) : null,
    paragraphs: beat.paragraphs,
    sceneHint: beat.sceneHint ?? null,
    status: "complete" as const,
  };
}

/**
 * Start a dynamic story: generate the opening beat, persist the story
 * (mode="dynamic") + segment 0, return both. Soft-fails to "On réessaie ?".
 */
export const startDynamicStoryFn = createServerFn({ method: "POST" })
  .validator(startSchema)
  .handler(async ({ data }): Promise<DynamicStartResult> => {
    // UN instantané de config pour TOUTE l'opération (arc + beat + défauts +
    // marque) — jamais deux générations de réglages dans une même histoire
    // qui démarre.
    const config = await getAppConfig();
    const { provider } = config;
    if (!provider.anthropicApiKey) {
      // Point d'usage : clé absente (ni ligne DB ni env) → AUCUN appel
      // provider ; l'enfant garde le soft-fail calme existant, le statut
      // « clé non configurée » vit côté /parents (app-config features.text).
      console.warn(
        "[stories] story start SKIPPED — clé Anthropic non configurée (réglage text:anthropic-api-key / ANTHROPIC_API_KEY)"
      );
      return { error: "On réessaie ?", success: false };
    }
    const lang = data.lang ?? provider.defaultLang;
    // Heroes + elements DB-backed + editable + multi-select: resolve all chosen.
    const [heroes, elements, place, doudous] = await Promise.all([
      resolveHeroesForCreation(data.heroIds),
      resolveElementsForCreation(data.elementIds),
      resolvePlaceForCreation(data.placeId),
      resolveDoudousForCreation(data.doudouIds ?? []),
    ]);
    // HARD-FAIL on an empty resolve (codex #2).
    if (heroes.length === 0 || elements.length === 0 || !place) {
      return { error: "Choix invalide.", success: false };
    }

    const customPrompt = sanitizeCustomPrompt(data.customPrompt);

    // Hidden fil rouge, generated ONCE here and frozen on the story row so
    // every beat (incl. continuation/crash-resume) advances along one thread.
    // Best-effort: null on failure → the story generates arc-less, as before.
    const arcStartedAt = Date.now();
    console.log("[stories] arc gen START", {
      doudous: doudous.length,
      elements: elements.length,
      heroes: heroes.length,
      lang,
    });
    const arcResult = await generateStoryArc(
      {
        customPrompt: customPrompt ?? undefined,
        doudous,
        elements,
        heroes,
        lang,
        place: { label: place.label, promptHint: place.promptHint },
      },
      provider
    );
    const storyArc = arcResult?.arc ?? null;
    console.log("[stories] arc gen DONE", {
      hasArc: storyArc !== null,
      ms: Date.now() - arcStartedAt,
      outfit: arcResult?.outfit ?? null,
      visualWorld: arcResult?.visualWorld ?? null,
    });

    const beatStartedAt = Date.now();
    console.log("[stories] beat gen START", {
      idx: 0,
      lang,
      mustEnd: false,
      storyId: null,
    });
    let beat: DynamicBeat;
    try {
      beat = await generateBeat(
        {
          customPrompt: customPrompt ?? undefined,
          doudous,
          elements,
          heroes,
          history: [],
          lang,
          mustEnd: false,
          place: {
            emoji: "",
            id: data.placeId,
            label: place.label,
            promptHint: place.promptHint,
          },
          storyArc: storyArc ?? undefined,
        },
        provider
      );
    } catch {
      // The provider already logged the per-attempt problems.
      console.error("[stories] beat gen FAILED", {
        idx: 0,
        ms: Date.now() - beatStartedAt,
        storyId: null,
      });
      return { error: "On réessaie ?", success: false };
    }
    console.log("[stories] beat gen DONE", {
      idx: 0,
      ms: Date.now() - beatStartedAt,
      storyId: null,
    });

    const [story] = await db
      .insert(stories)
      .values({
        customPrompt,
        doudouImageHint: doudous[0]?.imageHint ?? null,
        doudouLabel: doudous[0]?.label ?? null,
        doudouPromptHint: doudous[0]?.promptHint ?? null,
        // Freeze the doudou snapshot ARRAY (empty when none chosen) so EVERY
        // later beat (continuation / crash-resume) re-prompts from it. Mirror
        // the FIRST doudou into the singular columns for back-compat readers.
        doudouSnapshots: doudous,
        elementId: elements[0].id,
        elementSnapshots: elements.map((e) => ({
          label: e.label,
          promptHint: e.promptHint,
        })),
        // Mirror the FIRST hero/element id into the NOT NULL legacy columns
        // (codex #2).
        heroId: heroes[0].id,
        // Freeze the hero + element snapshot ARRAYS so EVERY later beat
        // re-prompts from them (immune to hero/element edits/deletes).
        heroSnapshots: heroes.map((h) => ({
          imageHint: h.imageHint,
          label: h.label,
          promptHint: h.promptHint,
        })),
        lang,
        mode: "dynamic",
        // Frozen with the arc (same call): the heroes' fixed wardrobe for every
        // illustration. Null when arc soft-failed / the outfit tripped its own
        // safety scan → image prompts keep prior clothing behavior.
        outfit: arcResult?.outfit ?? null,
        paragraphs: [],
        placeId: data.placeId,
        // Freeze the place snapshot + custom prompt so EVERY later beat
        // (continuation / crash-resume) re-prompts from the same frozen state.
        placeLabel: place.label,
        placePromptHint: place.promptHint,
        storyArc,
        // Titre de repli dans la langue de l'HISTOIRE (jamais la locale UI —
        // codex #5), depuis la marque du MÊME instantané.
        title:
          beat.title?.trim() ||
          composeBranding(lang, config.branding).storyLabel,
        // Frozen with the arc (same call): the story's default illustration
        // ambiance. Null when arc gen soft-failed → image prompts as before.
        visualWorld: arcResult?.visualWorld ?? null,
      })
      .returning();

    const [segment] = await db
      .insert(storySegments)
      .values({ idx: 0, storyId: story.id, ...beatToSegmentValues(beat) })
      .returning();

    // The id only exists post-insert; ties the START/DONE lines above (which
    // logged storyId=null) to the created story for grep-ability.
    console.log("[stories] story created", {
      hasArc: storyArc !== null,
      storyId: story.id,
      title: story.title,
    });
    return { segment, storyId: story.id, success: true };
  });

/**
 * Continue from a chosen option. Idempotent against double-tap:
 *  - claim the current beat's choice with a CONDITIONAL update (only when
 *    chosen_choice_id IS NULL);
 *  - if the claim affects 0 rows (already chosen), return the already-generated
 *    next segment instead of generating again;
 *  - otherwise generate + persist the next beat, forcing the final beat once
 *    the 5th choice has been made.
 */
export const continueDynamicStoryFn = createServerFn({ method: "POST" })
  .validator(z.object({ choiceId: z.string(), storyId: z.string() }))
  .handler(async ({ data }): Promise<DynamicContinueResult> => {
    // UN instantané de config pour toute la continuation.
    const { provider } = await getAppConfig();
    const segments = await db
      .select()
      .from(storySegments)
      .where(eq(storySegments.storyId, data.storyId))
      .orderBy(asc(storySegments.idx));

    if (segments.length === 0) {
      return { error: "Histoire introuvable.", success: false };
    }

    // The "current" beat is the last COMPLETE segment that offers choices — the
    // one the child is choosing from. (A trailing `generating`/`error`
    // placeholder beyond it is the next beat being (re)generated — crash-resume.)
    const current = [...segments]
      .reverse()
      .find((s) => s.status === "complete" && s.choices);
    if (!current) {
      return { error: "Cette histoire est déjà terminée.", success: false };
    }
    if (!current.choices?.some((c) => c.id === data.choiceId)) {
      return { error: "Choix invalide.", success: false };
    }

    const nextIdx = current.idx + 1;

    // If the next beat already exists and is COMPLETE, this is a double-tap /
    // already-advanced call — return it, never regenerate. A `generating` or
    // `error` placeholder is NOT complete: fall through to (re)generate it
    // (crash-resume), reusing the choice already recorded — never re-ask.
    const findNext = async () => {
      const [next] = await db
        .select()
        .from(storySegments)
        .where(
          and(
            eq(storySegments.storyId, data.storyId),
            eq(storySegments.idx, nextIdx)
          )
        );
      return next;
    };

    const preExisting = await findNext();
    if (preExisting && preExisting.status === "complete") {
      return { segment: preExisting, success: true };
    }

    // Conditional claim — only sets chosenChoiceId when it's still NULL, so a
    // double-tap that races past the check above can't claim twice.
    await db
      .update(storySegments)
      .set({ chosenChoiceId: data.choiceId })
      .where(
        and(
          eq(storySegments.id, current.id),
          isNull(storySegments.chosenChoiceId)
        )
      )
      .run();

    const story = await db
      .select()
      .from(stories)
      .where(eq(stories.id, data.storyId))
      .then((r) => r[0]);
    if (!story) {
      return { error: "Histoire introuvable.", success: false };
    }
    // History path: hero/place/element FROZEN from the story's own snapshot (or
    // immutable config fallback) — never the live, editable DB rows. This
    // freezes them across ALL beats incl. crash-resume (codex #1, #4).
    const { heroes, place, elements, doudous } =
      getFrozenStoryPromptContext(story);
    if (heroes.length === 0 || elements.length === 0) {
      return { error: "Histoire introuvable.", success: false };
    }

    // Count persisted chosen choices (the claim above is now persisted). The
    // 5th choice ends the story: at 5 chosen choices the next beat must be final.
    const chosenCount = segments.filter(
      (s) => s.id === current.id || s.chosenChoiceId
    ).length;
    const mustEnd = chosenCount >= MAX_CHOICES;

    // Reserve the next beat as `generating` with the pending choice, so a crash
    // mid-generation leaves a recoverable marker (status + pendingChoiceId).
    // Idempotent: UNIQUE(story_id, idx) means a racing caller can't double-insert
    // — on conflict we reuse the existing placeholder row.
    let placeholder = preExisting;
    if (placeholder) {
      await db
        .update(storySegments)
        .set({
          error: null,
          pendingChoiceId: data.choiceId,
          status: "generating",
        })
        .where(eq(storySegments.id, placeholder.id))
        .run();
    } else {
      const [created] = await db
        .insert(storySegments)
        .values({
          choices: null,
          idx: nextIdx,
          paragraphs: [],
          pendingChoiceId: data.choiceId,
          status: "generating",
          storyId: data.storyId,
        })
        .onConflictDoNothing()
        .returning();
      placeholder = created ?? (await findNext());
    }
    if (!placeholder) {
      return { error: "On réessaie ?", success: false };
    }
    // Another caller already completed it between our checks.
    if (placeholder.status === "complete") {
      return { segment: placeholder, success: true };
    }

    // History reflects the just-made choice on `current`.
    const claimedSegments = segments.map((s) =>
      s.id === current.id ? { ...s, chosenChoiceId: data.choiceId } : s
    );

    const beatStartedAt = Date.now();
    console.log("[stories] beat gen START", {
      idx: nextIdx,
      mustEnd,
      remainingChoices: Math.max(0, MAX_CHOICES - chosenCount),
      storyId: data.storyId,
    });
    let beat: DynamicBeat;
    try {
      beat = await generateBeat(
        {
          // Frozen saveur, re-applied on every beat (continuation can't see
          // the original parcours state — it must come from the persisted
          // column).
          customPrompt: sanitizeCustomPrompt(story.customPrompt) ?? undefined,
          // Frozen doudous, re-applied on every beat (continuation can't see
          // the original parcours choice — they come from the story's
          // snapshot).
          doudous,
          elements,
          heroes,
          history: toHistory(claimedSegments),
          lang: langSchema.catch("fr").parse(story.lang),
          mustEnd,
          place: {
            emoji: "",
            id: story.placeId,
            label: place.label,
            promptHint: place.promptHint,
          },
          // Choices the child still has to make, COUNTING the one this new
          // beat offers (1 = this beat carries the last choice) — lets the
          // prompt prepare the landing instead of hitting the mustEnd wall.
          remainingChoices: Math.max(0, MAX_CHOICES - chosenCount),
          // Frozen fil rouge (null on older stories → arc-less, as before).
          storyArc: story.storyArc ?? undefined,
        },
        provider
      );
    } catch (err) {
      // The provider already logged the per-attempt problems.
      console.error("[stories] beat gen FAILED", {
        idx: nextIdx,
        ms: Date.now() - beatStartedAt,
        storyId: data.storyId,
      });
      // Mark the beat errored (recoverable) and soft-fail WITHOUT losing prior
      // segments — the UI retries this beat with the same choice.
      await db
        .update(storySegments)
        .set({
          error: err instanceof Error ? err.message : "génération échouée",
          status: "error",
        })
        .where(eq(storySegments.id, placeholder.id))
        .run();
      return { error: "On réessaie ?", success: false };
    }

    const [segment] = await db
      .update(storySegments)
      .set({ ...beatToSegmentValues(beat), error: null, pendingChoiceId: null })
      .where(eq(storySegments.id, placeholder.id))
      .returning();
    console.log("[stories] beat gen DONE", {
      idx: nextIdx,
      isFinal: beat.choices === null,
      ms: Date.now() - beatStartedAt,
      storyId: data.storyId,
    });
    return { segment, success: true };
  });

/** A dynamic story plus its ordered segments (library replay, read-only). */
export const getDynamicStoryFn = createServerFn({ method: "GET" })
  .validator(z.string())
  .handler(
    async ({
      data: storyId,
    }): Promise<{ story: Story; segments: StorySegment[] } | null> => {
      const [story] = await db
        .select()
        .from(stories)
        .where(eq(stories.id, storyId));
      if (!story) {
        return null;
      }
      const segments = await db
        .select()
        .from(storySegments)
        .where(eq(storySegments.storyId, storyId))
        .orderBy(asc(storySegments.idx));
      return { segments, story };
    }
  );

/**
 * Server-side single-flight: concurrent calls for the SAME `${storyId}:${idx}`
 * share ONE in-flight generation promise instead of each launching a billed
 * Gemini call. The DB `imagePath` check below only dedupes SEQUENTIAL calls
 * (the first write must have landed); concurrent calls all read `null` and would
 * each generate. The module singleton persists across requests in the dev single
 * process, closing that race. Cleared once the shared promise settles.
 */
const inFlightSegmentImages = new Map<string, Promise<ImageResult>>();

/**
 * Generate the illustration for ONE segment (only when IMAGE_ENABLED).
 * Idempotent: if this segment already has an image, no-op (prevents repeated
 * Gemini spend on route remounts). Fails soft — image is always optional.
 */
export const generateSegmentImageFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      idx: z.number(),
      imageModel: z.string().optional(),
      storyId: z.string(),
    })
  )
  .handler(async ({ data }): Promise<ImageResult> => {
    const startedAt = Date.now();
    // UN instantané de config pour toute l'opération (gate + clé + modèle +
    // résolution du même monde).
    const { provider } = await getAppConfig();
    // Resolve the parent-picked model against the allowlist (loud fallback log
    // on an unknown id); the START log prints the RESOLVED model.
    const model = resolveImageModel(data.imageModel, provider.imageModel);
    console.log("[stories] image gen START", {
      idx: data.idx,
      model,
      resolution: provider.imageResolution,
      storyId: data.storyId,
    });
    if (!provider.imageEnabled) {
      console.warn(
        "[stories] image gen SKIPPED — images désactivées (réglage image:enabled / IMAGE_ENABLED)"
      );
      return { imagePath: null, imageStatus: "skipped" };
    }

    // Server-side single-flight: collapse concurrent calls for this segment onto
    // ONE generation promise so two requests racing past the DB `imagePath` check
    // (which only dedupes sequential calls) can't both bill Gemini.
    const key = `${data.storyId}:${data.idx}`;
    const existing = inFlightSegmentImages.get(key);
    if (existing) {
      console.warn("[stories] image gen deduped (already in-flight, server)", {
        key,
      });
      return existing;
    }
    const run = generateSegmentImage(
      data.storyId,
      data.idx,
      startedAt,
      model,
      provider
    );
    inFlightSegmentImages.set(key, run);
    return await run.finally(() => inFlightSegmentImages.delete(key));
  });

/**
 * Parent/child-triggered RETRY of a single beat's illustration after it landed
 * on the calm "no drawing today" (`__failed__`) state. Unlike the normal fetch
 * this is EXPLICIT and intentional: it clears ONLY the failure sentinel and
 * re-runs the exact same prompt-building + nanobanana gen + persist path, so the
 * one image can be re-attempted on demand. A real, already-stored image is never
 * overwritten (force is sentinel-only). Still gated behind IMAGE_ENABLED (the
 * single cost gate) and deduped through the same in-flight map as the normal
 * fetch, so a double-tap (or a racing background fetch) shares one billed call.
 */
export const retrySegmentImageFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      idx: z.number(),
      imageModel: z.string().optional(),
      storyId: z.string(),
    })
  )
  .handler(async ({ data }): Promise<ImageResult> => {
    const startedAt = Date.now();
    // UN instantané de config pour toute l'opération.
    const { provider } = await getAppConfig();
    const model = resolveImageModel(data.imageModel, provider.imageModel);
    console.log("[stories] image RETRY START", {
      idx: data.idx,
      model,
      resolution: provider.imageResolution,
      storyId: data.storyId,
    });
    if (!provider.imageEnabled) {
      console.warn(
        "[stories] image retry SKIPPED — images désactivées (réglage image:enabled / IMAGE_ENABLED)"
      );
      return { imagePath: null, imageStatus: "skipped" };
    }

    // Share the same single-flight slot as the normal fetch so a double-click —
    // or a retry racing a background fetch for this beat — collapses onto ONE
    // billed Gemini call rather than two.
    const key = `${data.storyId}:${data.idx}`;
    const existing = inFlightSegmentImages.get(key);
    if (existing) {
      console.warn(
        "[stories] image retry deduped (already in-flight, server)",
        {
          key,
        }
      );
      return existing;
    }
    const run = generateSegmentImage(
      data.storyId,
      data.idx,
      startedAt,
      model,
      provider,
      true
    );
    inFlightSegmentImages.set(key, run);
    return await run.finally(() => inFlightSegmentImages.delete(key));
  });

/**
 * Resolve a prior illustration of the SAME story to use as the consistency
 * reference for the next one. Picks the EARLIEST renderable image (usually beat
 * 0) as the canonical character/style anchor — chaining each image off the
 * previous one would compound drift instead of preventing it.
 *
 * Returns raw bytes, or undefined (beat 0 / nothing renderable yet / read
 * failure) — in which case the caller falls back to plain text-to-image.
 *
 * The `/`-prefix (local) vs `https://` (blob) storage rule — incl. the blob
 * host ALLOWLIST and the media-dir escape rejection — lives ENTIRELY in
 * `resolveStoredMediaForModel` (media-store, the single media choke-point);
 * this function only picks WHICH stored row anchors the story.
 *
 * The blob bytes are DOWNLOADED HERE, inside the best-effort try/catch, with a
 * bounded timeout — never handed to the AI SDK as a URL. A deleted/unreachable
 * anchor blob must degrade to plain text-to-image for that beat, NOT throw
 * inside generateImage and persist the TERMINAL failure sentinel (which, since
 * every beat anchors on the same earliest image, would kill every later
 * illustration of the story with no working retry).
 */
async function resolveReferenceImage(
  storyId: string,
  idx: number
): Promise<Uint8Array | undefined> {
  if (idx <= 0) {
    return;
  }
  try {
    // Earliest renderable prior image, filtered in SQL: one row, one column.
    const [anchor] = await db
      .select({ imagePath: storySegments.imagePath })
      .from(storySegments)
      .where(
        and(
          eq(storySegments.storyId, storyId),
          lt(storySegments.idx, idx),
          isNotNull(storySegments.imagePath),
          ne(storySegments.imagePath, IMAGE_FAILED_SENTINEL)
        )
      )
      .orderBy(asc(storySegments.idx))
      .limit(1);
    const path = anchor?.imagePath;
    if (!path) {
      return;
    }
    return await resolveStoredMediaForModel(path);
  } catch (error) {
    // Best-effort only: a missing local file / DB hiccup must never fail the
    // image itself — generate without a reference instead.
    console.warn(
      `[stories] reference image unavailable for story ${storyId} idx=${idx}:`,
      error instanceof Error ? error.message : String(error)
    );
  }
}

/**
 * The actual segment-image generation, deduped by `generateSegmentImageFn` /
 * `retrySegmentImageFn`. `force` (retry only) clears a prior `__failed__`
 * sentinel so a settled failure can be re-attempted; a real stored image is
 * still treated as a no-op (never overwritten / re-billed).
 */
async function generateSegmentImage(
  storyId: string,
  idx: number,
  startedAt: number,
  model: string,
  provider: ProviderConfig,
  force = false
): Promise<ImageResult> {
  const [segment] = await db
    .select()
    .from(storySegments)
    .where(and(eq(storySegments.storyId, storyId), eq(storySegments.idx, idx)));
  if (!segment) {
    return { imagePath: null, imageStatus: "skipped" };
  }
  // A forced retry re-attempts ONLY a prior failure sentinel — a real stored
  // path is always a no-op (don't overwrite / re-bill an existing illustration).
  if (segment.imagePath && segment.imagePath !== IMAGE_FAILED_SENTINEL) {
    return resolveStoredImagePath(segment.imagePath);
  }
  if (segment.imagePath === IMAGE_FAILED_SENTINEL && !force) {
    // Idempotent no-op: the terminal failure sentinel → "failed" (a prior
    // attempt already failed — do NOT re-bill Gemini, do NOT re-hang the child;
    // the calm "no drawing" state is final for this beat unless explicitly
    // retried via `retrySegmentImageFn`).
    return resolveStoredImagePath(segment.imagePath);
  }

  const [story] = await db
    .select()
    .from(stories)
    .where(eq(stories.id, storyId));
  if (!story) {
    return { imagePath: null, imageStatus: "skipped" };
  }
  // History path: frozen snapshot, never the live editable rows.
  const frozen = getFrozenStoryPromptContext(story);

  // A prior illustration of THIS story, sent as an image input so characters/
  // style stay consistent across beats (best-effort — null on beat 0 / no
  // prior image / fetch failure → plain text-to-image, as before).
  const referenceImage = await resolveReferenceImage(storyId, idx);

  // The illustration prompt (scene · ambiance · outfit · heroes · doudou ·
  // style) is assembled by the pure builder — pinned byte-identical by
  // test:golden. This function keeps only DB read / persist / sentinel.
  const prompt = buildSegmentImagePrompt(
    story,
    segment,
    referenceImage !== undefined,
    frozen,
    // La langue de l'histoire (colonne row, non typée) — une valeur inconnue
    // retombe sur le prompt français historique, jamais une erreur.
    langSchema.catch("fr").parse(story.lang)
  );

  try {
    const imagePath = await generateImage(
      prompt,
      provider,
      model,
      referenceImage
    );
    await db
      .update(storySegments)
      .set({ imagePath })
      .where(eq(storySegments.id, segment.id));
    console.log("[stories] image gen DONE", {
      idx,
      imagePath,
      ms: Date.now() - startedAt,
      storyId,
    });
    return { imagePath, imageStatus: "ready" };
  } catch (error) {
    // Non-silent: log the real reason (model + story/segment + cause) so the
    // operator sees a Gemini billing/quota denial; the child gets a calm
    // "no drawing this time" state, never a hang.
    console.error(
      `[stories] segment image generation FAILED for story ${storyId} ` +
        `segment idx=${idx} (model=${model}, ` +
        `ms=${Date.now() - startedAt}): ` +
        (error instanceof Error ? error.message : String(error))
    );
    // Persist the TERMINAL failure sentinel so this beat's image is settled:
    // future remounts / HMR reloads / reopens read it back as "failed" and never
    // re-attempt generation or re-hang on the waiting screen. Best-effort — a DB
    // write error here must not mask the original failure (still return failed).
    try {
      await db
        .update(storySegments)
        .set({ imagePath: IMAGE_FAILED_SENTINEL })
        .where(eq(storySegments.id, segment.id));
    } catch (markError) {
      console.error(
        `[stories] could not persist image-failed sentinel for story ${storyId} segment idx=${idx}:`,
        markError
      );
    }
    return { imagePath: null, imageStatus: "failed" };
  }
}
