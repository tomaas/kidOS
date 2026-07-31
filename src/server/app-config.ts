/**
 * Réglages applicatifs — le POINT DE PASSAGE UNIQUE (même philosophie que
 * media-store.ts) entre la table `app_settings`, l'environnement et les
 * défauts du code.
 *
 * Précédence de lecture : ligne DB présente → elle gagne ; absente → valeur
 * d'environnement → défaut du code. Les valeurs DB invalides (booléen ou enum
 * corrompu à la main) retombent sur le fallback (« invalid means FALLBACK »,
 * jamais « invalid means disabled ») — une ligne bricolée ne désactive
 * jamais une fonctionnalité en silence.
 *
 * SECRETS : une ligne présente gagne MÊME vide — la chaîne vide est le
 * « masque explicite » (l'Effacer honnête : la clé d'env est neutralisée).
 * Supprimer la ligne = revenir au réglage du déploiement (l'env reprend).
 * Quatre opérations donc : conserver (pas d'écriture) / définir / masquer
 * (ligne "") / réinitialiser (suppression de ligne).
 *
 * PAS de cache : ~14 lignes dans un fichier SQLite local — chaque opération
 * logique prend UN instantané frais à la frontière de la server function et
 * le fait descendre (jamais deux générations de config dans une même
 * opération).
 *
 * RÈGLE D'IMPORT (critique pour les goldens) : ce module n'importe JAMAIS
 * `~/server/db` au niveau module — import dynamique dans les fonctions de
 * lecture/écriture uniquement. Importer app-config.ts (ou un provider qui
 * l'importe) ne doit ni ouvrir ni créer la base. Épinglé par test:settings.
 */

import { eq } from "drizzle-orm";
import { serverEnv } from "~/env";
// schema.ts est sans effet de bord (définitions Drizzle pures) — seul
// ~/server/db (index) ouvre le client et migre ; lui reste en import lazy.
import { appSettings } from "~/server/db/schema";

// ── Clés canoniques ───────────────────────────────────────────────────────────

/** Liste canonique gelée — la seule vérité des clés `app_settings` posables
 * depuis /parents/reglages. Kebab-case, préfixe de section. */
export const SETTING_KEYS = [
  "text:anthropic-api-key",
  "text:story-model",
  "image:enabled",
  "image:gemini-api-key",
  "image:model",
  "image:resolution",
  "tts:enabled",
  "tts:provider",
  "tts:elevenlabs-api-key",
  "story:default-lang",
  "branding:child-name",
  "branding:app-name",
  "branding:app-description",
  "branding:story-label",
] as const;

export type SettingKey = (typeof SETTING_KEYS)[number];

/** Clés dont la valeur est un secret : jamais renvoyée au client. */
export const SECRET_SETTING_KEYS = [
  "text:anthropic-api-key",
  "image:gemini-api-key",
  "tts:elevenlabs-api-key",
] as const satisfies readonly SettingKey[];

export function isSecretSettingKey(key: string): boolean {
  return (SECRET_SETTING_KEYS as readonly string[]).includes(key);
}

/** La clé historique de la locale d'interface (settings-functions.ts) —
 * écrite via les mêmes helpers centraux, mais hors de AppConfig (elle est
 * lue par le loader racine, pas par les providers). */
export const UI_LANGUAGE_KEY = "ui-language";

const WRITABLE_KEYS: readonly string[] = [...SETTING_KEYS, UI_LANGUAGE_KEY];

// ── Forme typée (gelée depuis le chunk 1 — les chunks suivants ajoutent des
//    consommateurs, jamais une nouvelle forme) ────────────────────────────────

export type ImageResolution = "512" | "1K" | "2K" | "4K";
export type TtsProviderName = "edge" | "elevenlabs";
export type StoryLang = "fr" | "ru" | "en";

export interface ProviderConfig {
  anthropicApiKey: string;
  defaultLang: StoryLang;
  elevenLabsApiKey: string;
  geminiApiKey: string;
  imageEnabled: boolean;
  imageModel: string;
  imageResolution: ImageResolution;
  storyModel: string;
  ttsEnabled: boolean;
  ttsProvider: TtsProviderName;
}

/** Valeurs de marque BRUTES ("" = non défini) — la dérivation (élision
 * française, possessif anglais) reste dans la pure buildBranding. */
export interface BrandingConfig {
  appDescription: string;
  appName: string;
  childName: string;
  storyLabel: string;
}

export interface AppConfig {
  branding: BrandingConfig;
  provider: ProviderConfig;
}

// ── Fallback env (serverEnv + VITE_* runtime) ────────────────────────────────

const IMAGE_RESOLUTIONS: readonly ImageResolution[] = ["512", "1K", "2K", "4K"];
const TTS_PROVIDERS: readonly TtsProviderName[] = ["edge", "elevenlabs"];
const STORY_LANGS: readonly StoryLang[] = ["fr", "ru", "en"];

/**
 * La config « env seulement » : ce que l'app ferait sans aucune ligne DB.
 * Les VITE_* sont lues côté serveur via process.env à l'appel (le Dockerfile
 * les passe aussi en env runtime tant que le fallback legacy vit).
 */
export function envFallbackConfig(): AppConfig {
  return Object.freeze({
    branding: Object.freeze({
      appDescription: process.env.VITE_APP_DESCRIPTION ?? "",
      appName: process.env.VITE_APP_NAME ?? "",
      childName: process.env.VITE_CHILD_NAME ?? "",
      storyLabel: process.env.VITE_STORY_LABEL ?? "",
    }),
    provider: Object.freeze({
      anthropicApiKey: serverEnv.anthropicApiKey,
      defaultLang: serverEnv.defaultLang,
      elevenLabsApiKey: serverEnv.elevenLabsApiKey,
      geminiApiKey: serverEnv.geminiApiKey,
      imageEnabled: serverEnv.imageEnabled,
      imageModel: serverEnv.imageModel,
      imageResolution: serverEnv.imageResolution,
      storyModel: serverEnv.storyModel,
      ttsEnabled: serverEnv.ttsEnabled,
      ttsProvider: serverEnv.ttsProvider,
    }),
  });
}

// ── Lecture pure lignes → config (golden-testée sans DB) ─────────────────────

type Rows = ReadonlyMap<string, string>;

/** Booléen DB : "true"/"false" seulement ; tout le reste → fallback
 * (« invalid means fallback » — un rien ne force jamais false). */
function boolRow(rows: Rows, key: SettingKey, fallback: boolean): boolean {
  const raw = rows.get(key);
  if (raw === "true") {
    return true;
  }
  if (raw === "false") {
    return false;
  }
  return fallback;
}

function enumRow<T extends string>(
  rows: Rows,
  key: SettingKey,
  allowed: readonly T[],
  fallback: T
): T {
  const raw = rows.get(key);
  return allowed.includes(raw as T) ? (raw as T) : fallback;
}

/** Chaîne non-secrète : une ligne vide ou absente → fallback. */
function textRow(rows: Rows, key: SettingKey, fallback: string): string {
  const raw = rows.get(key);
  return raw ? raw : fallback;
}

/** Secret : la présence de la ligne gagne, MÊME vide (masque explicite). */
function secretRow(rows: Rows, key: SettingKey, fallback: string): string {
  const raw = rows.get(key);
  return raw === undefined ? fallback : raw;
}

/** Fusion pure lignes DB + fallback — exportée pour les goldens. */
export function configFromRows(rows: Rows, fallback: AppConfig): AppConfig {
  return Object.freeze({
    branding: Object.freeze({
      appDescription: textRow(
        rows,
        "branding:app-description",
        fallback.branding.appDescription
      ),
      appName: textRow(rows, "branding:app-name", fallback.branding.appName),
      childName: textRow(
        rows,
        "branding:child-name",
        fallback.branding.childName
      ),
      storyLabel: textRow(
        rows,
        "branding:story-label",
        fallback.branding.storyLabel
      ),
    }),
    provider: Object.freeze({
      anthropicApiKey: secretRow(
        rows,
        "text:anthropic-api-key",
        fallback.provider.anthropicApiKey
      ),
      defaultLang: enumRow(
        rows,
        "story:default-lang",
        STORY_LANGS,
        fallback.provider.defaultLang
      ),
      elevenLabsApiKey: secretRow(
        rows,
        "tts:elevenlabs-api-key",
        fallback.provider.elevenLabsApiKey
      ),
      geminiApiKey: secretRow(
        rows,
        "image:gemini-api-key",
        fallback.provider.geminiApiKey
      ),
      imageEnabled: boolRow(
        rows,
        "image:enabled",
        fallback.provider.imageEnabled
      ),
      imageModel: textRow(rows, "image:model", fallback.provider.imageModel),
      imageResolution: enumRow(
        rows,
        "image:resolution",
        IMAGE_RESOLUTIONS,
        fallback.provider.imageResolution
      ),
      storyModel: textRow(
        rows,
        "text:story-model",
        fallback.provider.storyModel
      ),
      ttsEnabled: boolRow(rows, "tts:enabled", fallback.provider.ttsEnabled),
      ttsProvider: enumRow(
        rows,
        "tts:provider",
        TTS_PROVIDERS,
        fallback.provider.ttsProvider
      ),
    }),
  });
}

// ── L'instantané par opération logique ───────────────────────────────────────

/**
 * UN instantané immuable de la configuration effective. À prendre à la
 * FRONTIÈRE de chaque server function et à faire descendre — jamais rappelé
 * au milieu d'une opération. Ne jette JAMAIS (précédent getUiLocaleFn) : DB
 * injoignable → config env seulement + log serveur ; l'enfant ne voit jamais
 * une erreur de configuration.
 */
export async function getAppConfig(): Promise<AppConfig> {
  const fallback = envFallbackConfig();
  try {
    const { db } = await import("~/server/db");
    const all = await db.select().from(appSettings);
    const rows = new Map(all.map((row) => [row.key, row.value]));
    return configFromRows(rows, fallback);
  } catch (error) {
    console.error("getAppConfig (fallback env seul):", error);
    return fallback;
  }
}

/** Les lignes brutes posées par le parent — pour l'écran de réglages (badge
 * « par défaut ») ; mêmes garanties never-throw que getAppConfig. */
export async function getSettingRows(): Promise<ReadonlyMap<string, string>> {
  try {
    const { db } = await import("~/server/db");
    const all = await db.select().from(appSettings);
    return new Map(all.map((row) => [row.key, row.value]));
  } catch (error) {
    console.error("getSettingRows (aucune ligne):", error);
    return new Map();
  }
}

// ── Masquage des secrets ─────────────────────────────────────────────────────

/**
 * Indice non-réversible d'un secret pour l'UI parent : jamais plus que les
 * 3 derniers caractères ("…7Yq"). Un secret vide ou trop court → "".
 */
export function hintFor(secret: string): string {
  if (secret.length < 8) {
    return "";
  }
  return `…${secret.slice(-3)}`;
}

// ── Statut pour l'écran parent (formes SANS secret) ──────────────────────────

/** D'où vient la valeur effective : une ligne posée par le parent ("db") ou
 * le déploiement ("default" = env ou défaut du code). Une ligne invalide
 * retombe côté "default" — le badge dit la vérité effective. */
export type SettingSource = "db" | "default";

export interface SecretStatus {
  configured: boolean;
  hint: string;
  source: SettingSource;
}

export interface ValueStatus<T> {
  source: SettingSource;
  value: T;
}

/**
 * Code de statut de CONFIGURATION par fonctionnalité — délibérément distinct
 * des codes d'échec provider ("save-failed", soft-failures) : « pas de clé »
 * n'est pas « le provider a échoué ». Libellés côté client (catalogue i18n).
 */
export type FeatureConfigStatus = "ready" | "off" | "missing-key";

export interface AppSettingsStatus {
  branding: {
    appDescription: ValueStatus<string>;
    appName: ValueStatus<string>;
    childName: ValueStatus<string>;
    storyLabel: ValueStatus<string>;
  };
  features: {
    image: FeatureConfigStatus;
    text: FeatureConfigStatus;
    tts: FeatureConfigStatus;
  };
  provider: {
    anthropicApiKey: SecretStatus;
    defaultLang: ValueStatus<StoryLang>;
    elevenLabsApiKey: SecretStatus;
    geminiApiKey: SecretStatus;
    imageEnabled: ValueStatus<boolean>;
    imageModel: ValueStatus<string>;
    imageResolution: ValueStatus<ImageResolution>;
    storyModel: ValueStatus<string>;
    ttsEnabled: ValueStatus<boolean>;
    ttsProvider: ValueStatus<TtsProviderName>;
  };
}

function secretStatus(rows: Rows, key: SettingKey, effective: string) {
  return {
    configured: effective.length > 0,
    hint: hintFor(effective),
    source: (rows.has(key) ? "db" : "default") as SettingSource,
  };
}

function valueStatus<T>(rows: Rows, key: SettingKey, effective: T) {
  // Source EFFECTIVE : une ligne invalide (retombée fallback) est déclarée
  // "default" — le badge ne prétend jamais qu'une valeur bricolée s'applique.
  const raw = rows.get(key);
  const applied =
    raw !== undefined && String(effective) === raw ? "db" : "default";
  return { source: applied as SettingSource, value: effective };
}

export function featureStatuses(
  provider: ProviderConfig
): AppSettingsStatus["features"] {
  const image = provider.imageEnabled
    ? provider.geminiApiKey
      ? "ready"
      : "missing-key"
    : "off";
  const tts = provider.ttsEnabled
    ? provider.ttsProvider === "elevenlabs" && !provider.elevenLabsApiKey
      ? "missing-key"
      : "ready"
    : "off";
  return {
    image,
    text: provider.anthropicApiKey ? "ready" : "missing-key",
    tts,
  };
}

/**
 * Forme envoyée au parent — construite PURE depuis (lignes, fallback) pour le
 * golden « boundary secret-scan » : aucun champ ne porte jamais un secret,
 * seulement {configured, hint}.
 */
export function settingsStatusFromRows(
  rows: Rows,
  fallback: AppConfig
): AppSettingsStatus {
  const config = configFromRows(rows, fallback);
  return {
    branding: {
      appDescription: valueStatus(
        rows,
        "branding:app-description",
        config.branding.appDescription
      ),
      appName: valueStatus(rows, "branding:app-name", config.branding.appName),
      childName: valueStatus(
        rows,
        "branding:child-name",
        config.branding.childName
      ),
      storyLabel: valueStatus(
        rows,
        "branding:story-label",
        config.branding.storyLabel
      ),
    },
    features: featureStatuses(config.provider),
    provider: {
      anthropicApiKey: secretStatus(
        rows,
        "text:anthropic-api-key",
        config.provider.anthropicApiKey
      ),
      defaultLang: valueStatus(
        rows,
        "story:default-lang",
        config.provider.defaultLang
      ),
      elevenLabsApiKey: secretStatus(
        rows,
        "tts:elevenlabs-api-key",
        config.provider.elevenLabsApiKey
      ),
      geminiApiKey: secretStatus(
        rows,
        "image:gemini-api-key",
        config.provider.geminiApiKey
      ),
      imageEnabled: valueStatus(
        rows,
        "image:enabled",
        config.provider.imageEnabled
      ),
      imageModel: valueStatus(rows, "image:model", config.provider.imageModel),
      imageResolution: valueStatus(
        rows,
        "image:resolution",
        config.provider.imageResolution
      ),
      storyModel: valueStatus(
        rows,
        "text:story-model",
        config.provider.storyModel
      ),
      ttsEnabled: valueStatus(rows, "tts:enabled", config.provider.ttsEnabled),
      ttsProvider: valueStatus(
        rows,
        "tts:provider",
        config.provider.ttsProvider
      ),
    },
  };
}

// ── Écritures centrales (validation + normalisation UNIQUEMENT ici) ─────────

export type SettingPatchOp =
  | { key: string; op: "set"; value: string }
  | { key: string; op: "delete" };

/** Même idiome maison que les *-functions.ts (espace, 23 caractères). */
function nowSqlTimestamp(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 23);
}

function assertWritableKey(key: string): void {
  if (!WRITABLE_KEYS.includes(key)) {
    throw new Error(`Clé de réglage inconnue: ${key}`);
  }
}

/**
 * Applique un PATCH au niveau champ dans UNE transaction (db.batch libSQL,
 * atomique) : deux onglets qui sauvent des sections disjointes ne s'écrasent
 * jamais ; un batch qui échoue ne change rien. TOUT écrivain passe ici (y
 * compris saveUiLocaleFn) — la validation de clé ne peut pas être contournée.
 */
export async function applySettingsPatch(
  operations: readonly SettingPatchOp[]
): Promise<void> {
  for (const operation of operations) {
    assertWritableKey(operation.key);
  }
  if (operations.length === 0) {
    return;
  }
  const { db } = await import("~/server/db");
  const statements = operations.map((operation) =>
    operation.op === "set"
      ? db
          .insert(appSettings)
          .values({ key: operation.key, value: operation.value })
          .onConflictDoUpdate({
            set: { updatedAt: nowSqlTimestamp(), value: operation.value },
            target: appSettings.key,
          })
      : db.delete(appSettings).where(eq(appSettings.key, operation.key))
  );
  const [first, ...rest] = statements;
  if (!first) {
    return;
  }
  await db.batch([first, ...rest]);
}

/** Pose une valeur (upsert). Passe par applySettingsPatch — une transaction. */
export function setSetting(key: string, value: string): Promise<void> {
  return applySettingsPatch([{ key, op: "set", value }]);
}

/** Supprime la ligne — « revenir au réglage du déploiement » (l'env reprend). */
export function deleteSetting(key: string): Promise<void> {
  return applySettingsPatch([{ key, op: "delete" }]);
}
