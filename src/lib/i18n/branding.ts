/**
 * Branding par locale — le cœur PUR (golden-testé, aucun accès env) :
 * `src/config/app.ts` compose ces dérivations avec les overrides
 * VITE_APP_NAME / VITE_APP_DESCRIPTION / VITE_STORY_LABEL.
 *
 * FR : élision « de » → « d' » devant un son voyelle (« l'atelier d'Arsène »
 * mais « de Léa »). Voyelles accentuées et h muet élident ; les prénoms où
 * c'est faux (h aspiré, Y semi-consonne « de Yann ») passent par les
 * overrides plein-texte. EN : possessif simple (« Léa's workshop »).
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
      name: childName ? `${childName}'s workshop` : "The little workshop",
      storyLabel: childName ? `A story by ${childName}` : "A little story",
    };
  }
  return {
    description: "Un endroit calme pour lire, inventer et calculer.",
    name: childName ? `L'atelier ${withDe(childName)}` : "Le petit atelier",
    storyLabel: childName
      ? `Une histoire ${withDe(childName)}`
      : "Une petite histoire",
  };
}
