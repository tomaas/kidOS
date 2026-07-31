/**
 * App-wide branding — depuis le passage env→DB, la personnalisation vit dans
 * `app_settings` (branding:* — posée à /parents/reglages, section « Le
 * prénom & l'atelier ») avec les VITE_* du déploiement en SECOURS
 * (`envFallbackConfig` dans src/server/app-config.ts) : renommer l'enfant ne
 * demande plus de rebuild Docker.
 *
 * Ce module ne garde que la COMPOSITION PURE : les dérivations par langue
 * (élision française incluse) vivent dans `buildBranding`
 * (src/lib/i18n/branding.ts, golden-testée) ; `composeBranding` y applique
 * les overrides plein-texte (appName/appDescription/storyLabel) quand la
 * phrase dérivée ne convient pas. Les valeurs entrent par le loader racine
 * (shell : titre d'onglet, portrait) ou par l'instantané AppConfig côté
 * serveur (titre d'histoire de repli) — TOUJOURS avec la bonne langue :
 * la locale UI pour le shell, la langue FIGÉE de l'histoire (stories.lang)
 * pour le colophon imprimé et le titre de repli.
 */

import { type Branding, buildBranding } from "~/lib/i18n";

/** La source de marque BRUTE ("" = non défini) — miroir structurel de
 * `BrandingConfig` (server/app-config.ts), défini localement pour qu'un
 * module de config importable côté client ne touche jamais au serveur. */
export interface BrandingSource {
  appDescription: string;
  appName: string;
  childName: string;
  storyLabel: string;
}

/** Les langues d'HISTOIRE ("fr" | "ru" | "en") — le russe n'a pas de marque
 * dédiée et retombe sur la dérivation française, comme historiquement. */
export type BrandingLang = "fr" | "ru" | "en";

export function composeBranding(
  lang: BrandingLang,
  source: BrandingSource
): Branding {
  const derived = buildBranding(
    lang === "en" ? "en" : "fr",
    source.childName.trim()
  );
  return {
    description: source.appDescription || derived.description,
    name: source.appName || derived.name,
    storyLabel: source.storyLabel || derived.storyLabel,
  };
}
