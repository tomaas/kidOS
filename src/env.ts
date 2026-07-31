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

// The SQLite file lives under DATA_DIR by default (in Docker: the app-data
// volume, next to the generated media). DATABASE_URL can still override the
// location, but it must stay a `file:` URL.
const dataDir = process.env.DATA_DIR ?? "./data";

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
  dataDir,

  // Database — local SQLite file (libSQL `file:` URL).
  databaseUrl: process.env.DATABASE_URL ?? `file:${dataDir}/app.db`,
} as const;

/**
 * Validate INFRA env at startup so a misconfiguration fails loudly with a
 * clear message instead of a cryptic libSQL error mid-request. INFRA ONLY :
 * les clés provider (Anthropic/Gemini/ElevenLabs) et les gates image/TTS ne
 * sont PLUS bloquantes au boot — elles peuvent vivre uniquement en base
 * (app_settings, voir server/app-config.ts) et se vérifient au point
 * d'usage (statut de configuration calme côté /parents, soft-failure côté
 * enfant). Skipped when SKIP_ENV_VALIDATION is set (used by the build).
 */
function validateServerEnv(): void {
  if (process.env.SKIP_ENV_VALIDATION) {
    return;
  }

  const errors: string[] = [];

  if (!serverEnv.databaseUrl.startsWith("file:")) {
    errors.push(
      "DATABASE_URL doit être une URL fichier locale (file:./data/app.db). Le mode Turso distant n'est plus supporté."
    );
  } else if (
    serverEnv.databaseUrl.startsWith("file://") &&
    !serverEnv.databaseUrl.startsWith("file:///")
  ) {
    // `file://data/app.db` fait de "data" une AUTORITÉ d'URL : libsql et le
    // mkdir du bootstrap divergeraient sur le chemin réel. Refuser tôt.
    errors.push(
      "DATABASE_URL en forme file://<hôte>/… n'est pas supporté — utilisez file:./chemin ou file:///chemin/absolu."
    );
  } else if (serverEnv.databaseUrl.includes("?")) {
    errors.push(
      "DATABASE_URL ne doit pas porter de query string (?mode=…) — le chemin du fichier doit être nu."
    );
  }

  if (process.env.TURSO_AUTH_TOKEN) {
    // Tripwire config pré-migration : le token n'est plus lu. Si la base n'a
    // pas encore été rapatriée (dump → fichier local), voir le README.
    console.warn(
      "TURSO_AUTH_TOKEN est défini mais n'est plus utilisé (base SQLite locale). Vérifiez que les données Turso ont été importées — voir README « Migrating from a previous Turso deployment »."
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
