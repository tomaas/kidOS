/**
 * Branding par locale — le cœur PUR (golden-testé, aucun accès env) :
 * `src/config/app.ts` compose ces dérivations avec les overrides
 * VITE_APP_NAME / VITE_APP_DESCRIPTION / VITE_STORY_LABEL.
 *
 * Le nom d'affichage (onglet, en-tête) est « <prénom>OS » dans les deux
 * locales — décision 2026-08-10. FR : l'élision « de » → « d' » devant un
 * son voyelle reste pour le storyLabel (« Une histoire d'Arsène » mais
 * « de Léa »). Voyelles accentuées et h muet élident ; les prénoms où
 * c'est faux (h aspiré, Y semi-consonne « de Yann ») passent par les
 * overrides plein-texte. EN : « A story by Léa ».
 */

import type { Locale } from "./locale";

const ELIDING_INITIAL = /^[aàâäæeéèêëiîïoôöœuùûüh]/i;

function withDe(name: string): string {
  return ELIDING_INITIAL.test(name) ? `d'${name}` : `de ${name}`;
}

export interface Branding {
  /** One-line description (meta description tag). */
  description: string;
  /** Display name: browser tab, home header. */
  name: string;
  /**
   * Discreet footer printed on the A5 booklet, and the fallback story title
   * when the model returns none.
   */
  storyLabel: string;
}

export function buildBranding(locale: Locale, childName: string): Branding {
  if (locale === "en") {
    return {
      description: "A calm place to read, imagine and count.",
      name: childName ? `${childName}OS` : "The little workshop",
      storyLabel: childName ? `A story by ${childName}` : "A little story",
    };
  }
  return {
    description: "Un endroit calme pour lire, inventer et calculer.",
    name: childName ? `${childName}OS` : "Le petit atelier",
    storyLabel: childName
      ? `Une histoire ${withDe(childName)}`
      : "Une petite histoire",
  };
}
