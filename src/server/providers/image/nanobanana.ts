import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateText } from "ai";
import { generateId } from "~/lib/id-generator";
import type { ProviderConfig } from "~/server/app-config";
import { saveMedia } from "~/server/providers/media-store";

// Gemini image models bill per OUTPUT token at $30 / 1M tokens; a standard
// (<=1024px) image is ~1290 output tokens ≈ $0.039/image. We estimate cost from
// the usage tokens the SDK returns, falling back to a flat per-image price.
// Source: https://ai.google.dev/gemini-api/docs/pricing (2026-06).
const IMAGE_USD_PER_OUTPUT_TOKEN = 30 / 1_000_000;
const IMAGE_USD_PER_IMAGE = 0.039;

/**
 * Nano Banana = Google's gemini image family, accessed through the Gemini API
 * via the Vercel AI SDK's Google provider. The model returns image files
 * inline; we persist the first one under DATA_DIR and return its web path. The
 * `model` arg (already allowlist-resolved by the caller) overrides the env
 * default per request so a parent can compare models; all offered models share
 * this exact call shape, so only the model-id arg changes.
 *
 * Behind IMAGE_ENABLED — the caller decides whether to invoke this at all.
 *
 * COST: Gemini image models bill per OUTPUT token and are resolution-tiered, so
 * we pin a LOW output resolution via `providerOptions.google.imageConfig`
 * (`imageSize` from `IMAGE_RESOLUTION`, default "1K") + `aspectRatio: "4:3"` to
 * match the modest 4/3 display container (no wasted pixels, no crop). These are
 * the @ai-sdk/google `imageConfig` schema fields. A model that doesn't support
 * imageConfig (e.g. gemini-2.5-flash-image) just ignores it — no crash.
 *
 * CONSISTENCY: `referenceImage` (a prior illustration of the SAME story — blob
 * URL or local bytes) is sent as an IMAGE INPUT alongside the text prompt, the
 * standard Gemini-image technique for keeping characters/style stable across
 * independently-generated scenes. Without it every beat reinvented the
 * characters (hair color, clothes, age drifted page to page). Input images
 * bill as INPUT tokens (cheap) — the expensive part stays the output image.
 *
 * This is the app's SOLE image generation entry point (a plain module
 * function, imported by concrete name; there is deliberately no provider
 * interface — see the adapter-census note in `types.ts`). `model` overrides
 * the env default for THIS request (parent-pickable model; already
 * allowlist-resolved by the caller). `referenceImage` (URL for blob-hosted,
 * bytes for local-disk media) is a prior illustration of the SAME story, sent
 * alongside the prompt so the model keeps the characters/style consistent
 * across beats. Omitted → pure text-to-image (opening beat, or no prior image
 * available).
 */
export async function generateImage(
  prompt: string,
  // L'INSTANTANÉ de config de l'opération (clé + résolution + modèle par
  // défaut) — pris à la frontière de la server function, jamais relu ici.
  config: ProviderConfig,
  model?: string,
  referenceImage?: Uint8Array | URL
): Promise<string> {
  if (!config.geminiApiKey) {
    // Clé absente (ni ligne DB ni env) : AUCUN appel réseau — le beat garde
    // son état calme « pas de dessin », le statut vit côté /parents.
    throw new Error("Clé Gemini non configurée.");
  }

  const google = createGoogleGenerativeAI({ apiKey: config.geminiApiKey });

  const providerOptions = {
    google: {
      // Pin a low, display-matched output to cut cost (see header).
      imageConfig: {
        aspectRatio: "4:3",
        imageSize: config.imageResolution,
      },
      responseModalities: ["IMAGE"],
    },
  };

  const result = await generateText({
    // A stalled Gemini call must fail (→ calm "no drawing" state) rather
    // than hold the request open past any client reveal timeout.
    abortSignal: AbortSignal.timeout(90_000),
    model: google(model ?? config.imageModel),
    ...(referenceImage
      ? {
          messages: [
            {
              content: [
                { image: referenceImage, type: "image" as const },
                { text: prompt, type: "text" as const },
              ],
              role: "user" as const,
            },
          ],
        }
      : { prompt }),
    providerOptions,
  });

  const imageFile = result.files.find((f) => f.mediaType?.startsWith("image/"));
  if (!imageFile) {
    throw new Error("Aucune image renvoyée par le générateur d'image.");
  }

  const usedModel = model ?? config.imageModel;
  console.log(
    `[image-gen] model=${usedModel} ref=${referenceImage ? "yes" : "no"} prompt=${prompt}`
  );
  try {
    const outTokens = result.usage?.outputTokens;
    const cost =
      outTokens === undefined
        ? IMAGE_USD_PER_IMAGE
        : outTokens * IMAGE_USD_PER_OUTPUT_TOKEN;
    const basis =
      outTokens === undefined
        ? "flat per-image estimate"
        : `${outTokens} output tokens @ $30/1M`;
    console.log(`[image-gen] cost≈$${cost.toFixed(4)} (${basis})`);
  } catch {
    // Never let cost logging break image generation.
  }

  const ext = imageFile.mediaType === "image/jpeg" ? "jpg" : "png";
  const filename = `${generateId("img")}.${ext}`;
  return saveMedia(filename, imageFile.uint8Array);
}
