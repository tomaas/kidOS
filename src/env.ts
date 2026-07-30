/**
 * Server-only environment access.
 *
 * Vite only exposes variables prefixed with `VITE_` to the client bundle, so
 * every key read here (API keys, the DB URL, provider flags) stays on the
 * server. These getters are only ever called inside server functions /
 * providers — never from a component.
 */

function bool(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) {
    return fallback;
  }
  return value === "true" || value === "1";
}

const imageEnabled = bool(process.env.IMAGE_ENABLED, false);
const ttsEnabled = bool(process.env.TTS_ENABLED, false);

// Image output resolution tier for Gemini image models (cost is per output
// token, and the model is resolution-tiered). The illustration shows in a modest
// 4/3 container, so 1K is plenty and far cheaper than the model's higher tiers —
// this is the default. Tunable via IMAGE_RESOLUTION without a code change.
// Accepted values are exactly the @ai-sdk/google `imageConfig.imageSize` enum
// ("512" = the 0.5K tier, "1K"/"2K"/"4K"); anything else falls back to "1K" so a
// typo can never send an invalid param. A model that ignores imageConfig (e.g.
// gemini-2.5-flash-image) still works — the param is simply not applied.
const IMAGE_SIZES = ["512", "1K", "2K", "4K"] as const;
type ImageSize = (typeof IMAGE_SIZES)[number];
const rawImageResolution = process.env.IMAGE_RESOLUTION;
const imageResolution: ImageSize = IMAGE_SIZES.includes(
  rawImageResolution as ImageSize
)
  ? (rawImageResolution as ImageSize)
  : "1K";
const ttsProvider = (process.env.TTS_PROVIDER ?? "edge") as
  | "edge"
  | "elevenlabs";

// biome-ignore assist/source/useSortedKeys: groupement SÉMANTIQUE (requis vs optionnel, par fonctionnalité) — les commentaires de section documentent chaque groupe.
export const serverEnv = {
  // Text generation (required).
  anthropicApiKey: process.env.ANTHROPIC_API_KEY ?? "",
  storyModel: process.env.STORY_MODEL ?? "claude-opus-4-8",

  // Image generation (optional, off by default).
  imageEnabled,
  geminiApiKey: process.env.GEMINI_API_KEY ?? "",
  imageModel: process.env.IMAGE_MODEL ?? "gemini-2.5-flash-image",
  // Output resolution tier (see above) — pinned low to cut generation cost.
  imageResolution,

  // Text-to-speech (optional, off by default).
  ttsEnabled,
  ttsProvider,
  elevenLabsApiKey: process.env.ELEVENLABS_API_KEY ?? "",

  // Media storage. When set (e.g. on Vercel), generated images are persisted to
  // Vercel Blob and stored as public https:// URLs. When unset, media falls
  // back to local disk under dataDir (offline dev). Optional, server-only.
  blobReadWriteToken: process.env.BLOB_READ_WRITE_TOKEN ?? "",

  // Misc.
  defaultLang: (process.env.DEFAULT_LANG ?? "fr") as "fr" | "ru" | "en",
  dataDir: process.env.DATA_DIR ?? "./data",

  // Database — remote Turso cloud (required, no local/offline mode).
  databaseUrl: process.env.DATABASE_URL ?? "",
  tursoAuthToken: process.env.TURSO_AUTH_TOKEN ?? "",
} as const;

/**
 * Validate required env at startup so a misconfiguration fails loudly with a
 * clear message instead of a cryptic libSQL / provider error mid-request.
 * Conditional: image/TTS keys are only required when their flag is on.
 * Skipped when SKIP_ENV_VALIDATION is set (used by the build).
 */
function validateServerEnv(): void {
  if (process.env.SKIP_ENV_VALIDATION) {
    return;
  }

  const errors: string[] = [];

  if (!serverEnv.anthropicApiKey) {
    errors.push("ANTHROPIC_API_KEY est requis.");
  }

  if (!serverEnv.databaseUrl) {
    errors.push("DATABASE_URL est requis (Turso cloud).");
  } else if (
    !(
      serverEnv.databaseUrl.startsWith("libsql://") ||
      serverEnv.databaseUrl.startsWith("https://")
    )
  ) {
    errors.push(
      "DATABASE_URL doit être une URL Turso (libsql://<db>.turso.io). Le mode fichier local n'est plus supporté."
    );
  }

  if (!serverEnv.tursoAuthToken) {
    errors.push("TURSO_AUTH_TOKEN est requis (Turso cloud).");
  }

  if (serverEnv.imageEnabled && !serverEnv.geminiApiKey) {
    errors.push("GEMINI_API_KEY est requis quand IMAGE_ENABLED=true.");
  }

  if (
    serverEnv.ttsEnabled &&
    serverEnv.ttsProvider === "elevenlabs" &&
    !serverEnv.elevenLabsApiKey
  ) {
    errors.push(
      "ELEVENLABS_API_KEY est requis quand TTS_ENABLED=true et TTS_PROVIDER=elevenlabs."
    );
  }

  if (errors.length > 0) {
    throw new Error(
      `Configuration .env.local incomplète :\n- ${errors.join("\n- ")}`
    );
  }
}

validateServerEnv();

/**
 * Flags that are safe to send to the client so the UI can hide/show the
 * "Écouter" button and the illustration slot. No secrets here.
 */
export interface PublicFlags {
  defaultLang: "fr" | "ru" | "en";
  imageEnabled: boolean;
  // The env default image model, mirrored so the /parents picker's "par défaut"
  // badge + the localStorage hook's default track the deployed env (not a
  // hard-coded mirror). The id itself is not a secret.
  imageModel: string;
  ttsEnabled: boolean;
}

export function getPublicFlags(): PublicFlags {
  return {
    defaultLang: serverEnv.defaultLang,
    imageEnabled: serverEnv.imageEnabled,
    imageModel: serverEnv.imageModel,
    ttsEnabled: serverEnv.ttsEnabled,
  };
}
