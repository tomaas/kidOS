/**
 * Façade du module i18n — la locale UI (réglage parent), les deux catalogues
 * et le branding par locale. Voir locale.ts pour la frontière avec
 * `stories.lang` (langue d'une histoire) et DEFAULT_LANG (défaut serveur).
 */

export { type Branding, buildBranding } from "./branding";
export { LocaleProvider, MESSAGES, useLocale, useMessages } from "./context";
export {
  DEFAULT_LOCALE,
  LOCALE_LABELS,
  LOCALES,
  type Locale,
  normalizeLocale,
} from "./locale";
export type { Messages } from "./messages/fr";
