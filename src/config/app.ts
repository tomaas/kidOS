/**
 * App-wide branding — the ONE place to personalize the app for your family.
 *
 * Set `VITE_CHILD_NAME=Léa` (in `.env.local` or your host's env vars) and the
 * browser tab, home screen and printed booklet all become "L'atelier de
 * Léa" / "Une histoire de Léa" (or "Léa's workshop" / "A story by Léa" when
 * the parent switches the UI language) — no code change, so a public fork
 * stays generic. `VITE_APP_NAME` / `VITE_APP_DESCRIPTION` /
 * `VITE_STORY_LABEL` override the full strings in BOTH languages when the
 * derived phrasing doesn't fit. The per-locale derivations (French elision
 * incluse) live in the pure `buildBranding` (src/lib/i18n/branding.ts,
 * golden-tested); this file only composes them with the env overrides. Hero
 * names live in `src/config/characters.ts` (and can also be managed in-app
 * at /parents).
 */

import { type Branding, buildBranding, type Locale } from "~/lib/i18n";

/**
 * Le prénom configuré, exporté pour l'identité du bureau (T4-A) : le portrait
 * de l'écran de session est le héros dont le nom correspond à CE prénom —
 * jamais « le premier héros de la table ». Vide si non configuré.
 */
export const childName: string = (import.meta.env.VITE_CHILD_NAME || "").trim();

/** Branding pour la locale UI — dérivation par langue + overrides env. */
export function brandingFor(locale: Locale): Branding {
  const derived = buildBranding(locale, childName);
  return {
    description: import.meta.env.VITE_APP_DESCRIPTION || derived.description,
    name: import.meta.env.VITE_APP_NAME || derived.name,
    storyLabel: import.meta.env.VITE_STORY_LABEL || derived.storyLabel,
  };
}

/**
 * Branding FRANÇAIS figé — pour les consommateurs pas encore par-locale :
 * le colophon imprimé et le titre d'histoire de repli côté serveur suivront
 * la langue de l'HISTOIRE (stories.lang), pas la locale UI — branchés aux
 * phases 3–4 du plan multilangue. Le shell (titre d'onglet, portrait,
 * meta description) passe déjà par brandingFor(locale).
 */
export const appConfig = brandingFor("fr");
