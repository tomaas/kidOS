import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { BrandingSource } from "~/config/app";
import { composeBranding } from "~/config/app";
import type { Branding } from "~/lib/i18n";
import {
  DEFAULT_LOCALE,
  type Locale,
  normalizeLocale,
} from "~/lib/i18n/locale";
import {
  type AppSettingsStatus,
  applySettingsPatch,
  configFromRows,
  envFallbackConfig,
  getSettingRows,
  isSecretSettingKey,
  SETTING_KEYS,
  type SettingKey,
  type SettingPatchOp,
  setSetting,
  settingsStatusFromRows,
  UI_LANGUAGE_KEY,
} from "~/server/app-config";

/**
 * Réglages globaux (table `app_settings`) : la locale de l'INTERFACE et la
 * MARQUE (choisies par le parent), lues par le loader racine à CHAQUE rendu
 * SSR — la lecture ne jette JAMAIS (DB injoignable → défauts du déploiement,
 * log serveur) : le shell doit toujours rendre, l'enfant ne voit jamais une
 * erreur de configuration. Les écritures renvoient un booléen ou un CODE
 * calme ; le libellé d'échec appartient au CLIENT (catalogue i18n) — le
 * serveur ne choisit pas la langue d'un message destiné au parent.
 */

/** Ce que le loader RACINE fournit au shell : la locale UI, la marque
 * composée pour cette locale (titre d'onglet, portrait) et la source de
 * marque brute — pour que les consommateurs à LANGUE D'HISTOIRE (colophon
 * imprimé) recomposent via composeBranding(story.lang). Aucun secret. */
export interface ShellContext {
  branding: Branding;
  brandingSource: BrandingSource;
  locale: Locale;
}

export const getShellContextFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<ShellContext> => {
    try {
      const rows = await getSettingRows();
      const locale = normalizeLocale(rows.get(UI_LANGUAGE_KEY));
      const { branding } = configFromRows(rows, envFallbackConfig());
      return {
        branding: composeBranding(locale, branding),
        brandingSource: branding,
        locale,
      };
    } catch (error) {
      // Même contrat que l'ancien getUiLocaleFn : ne jette JAMAIS — le shell
      // rend toujours, au pire en français avec la marque du déploiement.
      console.error("getShellContextFn:", error);
      const fallback = envFallbackConfig().branding;
      return {
        branding: composeBranding(DEFAULT_LOCALE, fallback),
        brandingSource: fallback,
        locale: DEFAULT_LOCALE,
      };
    }
  }
);

export const saveUiLocaleFn = createServerFn({ method: "POST" })
  .validator(z.object({ locale: z.enum(["fr", "en"]) }))
  .handler(async ({ data }): Promise<{ success: boolean }> => {
    try {
      // Écrivain CENTRAL (app-config.ts) : tout writer de `app_settings`
      // passe par setSetting/applySettingsPatch — validation de clé et
      // transaction ne peuvent pas être contournées.
      await setSetting(UI_LANGUAGE_KEY, data.locale);
      return { success: true };
    } catch (error) {
      // Le détail technique (chemin du fichier SQLite, SQL) reste côté serveur — le
      // parent reçoit un état calme, libellé par le catalogue client.
      console.error("saveUiLocaleFn:", error);
      return { success: false };
    }
  });

/* ── Réglages de l'atelier (/parents/reglages) ─────────────────────────────
 * Lecture : la forme statut SANS SECRET (valeurs non-secrètes + {configured,
 * hint} pour les clés — jamais la clé elle-même ; épinglé par le scan de
 * frontière de test:settings). Écriture : un PATCH au niveau champ, validé
 * par zod, exécuté en UNE transaction via l'écrivain central — deux onglets
 * qui sauvent des sections disjointes ne s'écrasent jamais. Les secrets
 * suivent les QUATRE opérations : conserver (absent du patch) / définir /
 * masque explicite (set "") / revenir au déploiement (delete). */

export const getAppSettingsStatusFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<AppSettingsStatus> =>
    // Never-throw des deux côtés (getSettingRows → Map vide sur échec DB) :
    // la page parent rend toujours, au pire l'état « déploiement seul ».
    settingsStatusFromRows(await getSettingRows(), envFallbackConfig())
);

const settingKeyValues = SETTING_KEYS as readonly [SettingKey, ...SettingKey[]];

/** Valeurs acceptées à l'ÉCRITURE pour les clés à domaine fermé (la lecture
 * reste tolérante — invalid means fallback — mais on refuse d'écrire
 * proprement une valeur qui serait ignorée, précédent saveMathSettingsFn). */
function valeurEcrivable(key: SettingKey, value: string): boolean {
  switch (key) {
    case "image:enabled":
    case "tts:enabled":
      return value === "true" || value === "false";
    case "image:resolution":
      return ["512", "1K", "2K", "4K"].includes(value);
    case "tts:provider":
      return value === "edge" || value === "elevenlabs";
    case "story:default-lang":
      return ["fr", "ru", "en"].includes(value);
    default:
      return true;
  }
}

const operationSchema = z
  .discriminatedUnion("op", [
    z.object({
      key: z.enum(settingKeyValues),
      op: z.literal("set"),
      value: z.string().max(500),
    }),
    z.object({ key: z.enum(settingKeyValues), op: z.literal("delete") }),
  ])
  .refine(
    (operation) =>
      operation.op !== "set" || valeurEcrivable(operation.key, operation.value),
    "Valeur hors domaine pour cette clé."
  );

const savePatchSchema = z.object({
  operations: z
    .array(operationSchema)
    .min(1)
    .max(SETTING_KEYS.length)
    .refine(
      (ops) => new Set(ops.map((o) => o.key)).size === ops.length,
      "Clé en double dans le patch."
    ),
});

export type AppSettingsMutationResult =
  // Code stable, jamais une phrase (précédent saveMathSettingsFn) : le
  // libellé appartient au catalogue client. Le statut frais évite un
  // aller-retour supplémentaire après enregistrement.
  | { success: true; status: AppSettingsStatus }
  | { success: false; code: "save-failed" };

export const saveAppSettingsFn = createServerFn({ method: "POST" })
  .validator(savePatchSchema)
  .handler(async ({ data }): Promise<AppSettingsMutationResult> => {
    // Normalisation d'écriture : un champ TEXTE non-secret vidé = « revenir
    // au réglage du déploiement » (delete) — jamais une ligne "" qui serait
    // ignorée à la lecture (le badge doit dire vrai). Les SECRETS gardent
    // leur "" : c'est le masque explicite (l'Effacer honnête).
    const operations: SettingPatchOp[] = data.operations.map((operation) =>
      operation.op === "set" &&
      !isSecretSettingKey(operation.key) &&
      operation.value.trim() === ""
        ? { key: operation.key, op: "delete" }
        : operation
    );
    try {
      await applySettingsPatch(operations);
      return {
        status: settingsStatusFromRows(
          await getSettingRows(),
          envFallbackConfig()
        ),
        success: true,
      };
    } catch (error) {
      // Détail technique côté serveur uniquement ; le parent reçoit un code
      // calme, libellé par le catalogue client.
      console.error("saveAppSettingsFn:", error);
      return { code: "save-failed", success: false };
    }
  });
