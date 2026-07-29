/**
 * La locale de l'INTERFACE (bureau + espace parent) — distincte de deux
 * autres notions de langue qui existaient avant elle et ne bougent pas ici :
 *  - `stories.lang` : la langue d'UNE histoire, figée à sa création ;
 *  - `DEFAULT_LANG` (env serveur) : le défaut des histoires (`Lang` du
 *    pipeline texte, src/server/providers/types.ts).
 * La locale UI est un réglage PARENT (table `app_settings`, clé
 * `ui-language`), lu par le loader racine — jamais un choix montré à
 * l'enfant. Module PUR, golden-testé (test:i18n).
 */

export type Locale = "fr" | "en";

export const DEFAULT_LOCALE: Locale = "fr";

export const LOCALES: readonly Locale[] = ["fr", "en"];

/**
 * Autonymes (le nom de chaque langue dans sa propre langue) — identiques
 * dans les deux catalogues par nature, donc hors catalogue.
 */
export const LOCALE_LABELS: Record<Locale, string> = {
  en: "English",
  fr: "Français",
};

/**
 * N'importe quelle valeur (ligne DB éditée à la main, loader pas encore
 * chargé) → une locale valide, jamais d'exception. Strict : seule la chaîne
 * exacte "en" bascule ; tout le reste — "ru", "EN", null — retombe sur "fr".
 */
export function normalizeLocale(value: unknown): Locale {
  return value === "en" ? "en" : DEFAULT_LOCALE;
}
