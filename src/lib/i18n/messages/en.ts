/**
 * ENGLISH catalog — same shape as the French reference (`Messages`), enforced
 * by the compiler and re-checked at runtime by test:i18n (key parity + the
 * calm-wording scan: never well done/won/lost/hurry/wrong/score — the calm
 * constraint applies in full in both languages).
 */

import type { Messages } from "./fr";

export const en: Messages = {
  bureau: {
    apps: {
      bibliotheque: "Library",
      calculs: "Sums",
      histoires: "Stories",
    },
    entrer: "Come in",
    fermerFenetre: "Close the window",
    ranger: "Tidy up the desk",
  },
  ecrans: {
    pageIntrouvableTitre: "This page doesn't exist",
    revenirAccueil: "Back home",
    soucisTexte: "Let's tidy everything up and start again in a moment.",
    soucisTitre: "Oops, a little hiccup",
  },
  parents: {
    langue: {
      enregistre: "Saved.",
      enregistrementImpossible: "Saving didn't work just now — try again.",
      hint: "The language of the workshop — the desk and the parent space. Stories already created never change.",
      titre: "Language",
    },
  },
};
