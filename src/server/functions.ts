import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { resolveImageModel } from "~/config/image-models";
import { getAppConfig, publicFlagsFromConfig } from "~/server/app-config";
import { db } from "~/server/db";
import { stories } from "~/server/db/schema";
import { generateImage } from "~/server/providers/image/nanobanana";
import { getTtsProvider } from "~/server/providers/tts";
import type { ImageStatus } from "~/server/providers/types";

/** Flags the client may read (no secrets) — dérivés de l'instantané de
 * config : un toggle posé en base s'applique au prochain chargement, sans
 * rebuild. */
export const getFlagsFn = createServerFn({ method: "GET" }).handler(
  async () => {
    const config = await getAppConfig();
    return publicFlagsFromConfig(config.provider);
  }
);

/**
 * Outcome of the /parents test-playground generation. Unlike the story-bound
 * `ImageResult` it also carries the RESOLVED `model` + elapsed `ms` so the
 * parent can compare models side by side (2.5 vs 3.1 vs pro) on one screen.
 */
export interface TestImageResult {
  imagePath: string | null;
  imageStatus: ImageStatus;
  model: string;
  ms: number;
}

/**
 * Parent-only test playground (from /parents/image-model): generate ONE image
 * from a free-text prompt with a chosen model so the parent can compare quality
 * / price / speed live. Intentionally billed — user-driven by a button click.
 * No story row, no DB write: the provider's `saveMedia` already persists the
 * file under data/media and returns its web path. Still behind IMAGE_ENABLED so
 * images can never generate when globally off (single cost gate).
 *
 * Calm-tool note: this is a PARENT control — the child flow is untouched.
 */
export const generateTestImageFn = createServerFn({ method: "POST" })
  .validator(
    z.object({
      imageModel: z.string().optional(),
      prompt: z.string().min(1).max(2000),
    })
  )
  .handler(async ({ data }): Promise<TestImageResult> => {
    // UN instantané de config pour toute l'opération (gate + clé + modèle +
    // résolution du même monde — jamais deux générations mélangées).
    const { provider } = await getAppConfig();
    // Resolve the picked model against the allowlist (loud fallback log on an
    // unknown id) so a stale/tampered value can never reach the provider.
    const model = resolveImageModel(data.imageModel, provider.imageModel);
    if (!provider.imageEnabled) {
      console.warn(
        "[stories] test image gen SKIPPED — images désactivées (réglage image:enabled / IMAGE_ENABLED)"
      );
      return { imagePath: null, imageStatus: "skipped", model, ms: 0 };
    }
    if (!provider.geminiApiKey) {
      // Point d'usage : clé absente → aucun appel réseau, état calme. Le
      // statut « clé non configurée » vient de app-config (features.image).
      console.warn(
        "[stories] test image gen SKIPPED — clé Gemini non configurée (réglage image:gemini-api-key / GEMINI_API_KEY)"
      );
      return { imagePath: null, imageStatus: "skipped", model, ms: 0 };
    }

    const startedAt = Date.now();
    console.log("[stories] test image gen START", {
      model,
      promptLen: data.prompt.length,
      resolution: provider.imageResolution,
    });

    try {
      // Send the prompt AS-IS — the parent has full control (no style suffix
      // auto-append; the playground prefill already carries it).
      const imagePath = await generateImage(data.prompt, provider, model);
      const ms = Date.now() - startedAt;
      console.log("[stories] test image gen DONE", { imagePath, model, ms });
      return { imagePath, imageStatus: "ready", model, ms };
    } catch (error) {
      const ms = Date.now() - startedAt;
      // Non-silent: log the real reason (model + cause) so the operator sees a
      // Gemini billing/quota denial; the parent gets a calm inline message.
      console.error(
        `[stories] test image generation FAILED (model=${model}, ms=${ms}): ` +
          (error instanceof Error ? error.message : String(error))
      );
      return { imagePath: null, imageStatus: "failed", model, ms };
    }
  });

/**
 * Synthesize the story audio (only when TTS_ENABLED). Cached on the row so a
 * re-listen doesn't regenerate.
 */
export const synthesizeFn = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }): Promise<{ audioPath: string | null }> => {
    // UN instantané pour l'opération : gate + provider + clé du même monde.
    const { provider } = await getAppConfig();
    if (!provider.ttsEnabled) {
      return { audioPath: null };
    }

    const [story] = await db
      .select()
      .from(stories)
      .where(eq(stories.id, data.id));
    if (!story) {
      return { audioPath: null };
    }
    if (story.audioPath) {
      return { audioPath: story.audioPath };
    }

    const tts = getTtsProvider(provider);

    const fullText = [story.title, ...story.paragraphs].join(". ");

    try {
      const audioPath = await tts.synthesize(
        fullText,
        story.lang === "ru" || story.lang === "en" ? story.lang : "fr"
      );
      await db
        .update(stories)
        .set({ audioPath })
        .where(eq(stories.id, data.id));
      return { audioPath };
    } catch {
      return { audioPath: null };
    }
  });

/**
 * Kept stories, newest first — for the library. Only DYNAMIC stories appear:
 * the classic viewer is gone, so old classic rows are simply never listed
 * (no dead tiles, no broken taps).
 */
export const getLibraryFn = createServerFn({ method: "GET" }).handler(() =>
  db
    .select()
    .from(stories)
    .where(and(eq(stories.kept, "1"), eq(stories.mode, "dynamic")))
    .orderBy(desc(stories.createdAt))
);
