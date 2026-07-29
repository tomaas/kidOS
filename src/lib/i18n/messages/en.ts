/**
 * ENGLISH catalog — same shape as the French reference (`Messages`), enforced
 * by the compiler and re-checked at runtime by test:i18n (key parity + the
 * calm-wording scan: never well done/won/lost/hurry/wrong/score — the calm
 * constraint applies in full in both languages).
 *
 * Vocabulary notes: "tray" is reserved for the shelf's plateau (the énoncé
 * containers say "tubs", never "trays"); palier is "level"; the Montessori
 * "matériel" is "materials".
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
  calcul: {
    ariaEffacer: "Clear",
    ariaReposerPlateau: "Put the tray back",
    atelierRange: "The workshop is tidy.",
    familles: {
      addition: "addition",
      multiplication: "multiplication",
      soustraction: "subtraction",
    },
    jaiFiniJeCompare: "I'm done, let's compare",
    plateauSuivant: "Next tray",
    prendrePlateau: "Take the {familles} tray",
    rangerAtelier: "Tidy up the workshop",
    serieEnCours: " — series in progress",
  },
  ecrans: {
    pageIntrouvableTitre: "This page doesn't exist",
    revenirAccueil: "Back home",
    soucisTexte: "Let's tidy everything up and start again in a moment.",
    soucisTitre: "Oops, a little hiccup",
  },
  parents: {
    calcul: {
      changerPalier: "Changing the level puts the current series away.",
      changerTaille:
        "Changing the size puts every family's current series away.",
      derniereFamille: "At least one family stays on the shelf.",
      enregistrement: "Saving…",
      enregistrer: "Save",
      imprimerFiche: "Print a sheet",
      intro:
        "Prepare the shelf — just as the educator decides the presentations, you choose which operation families are available and their level. The child picks a tray; none of this is ever shown to them.",
      nApparaitPas:
        "Not on the shelf. Turning it off forgets the chosen level.",
      operationsParSerie: "Sums per series",
      paliers: {
        "add-grands-nombres": "Column addition up to the thousands",
        "add-retenue": "Column addition with carrying",
        "add-sans-retenue": "Column addition without carrying",
        "mult-1-chiffre": "Column multiplication by 1 digit",
        "mult-abstraite": "Column multiplication, without the materials",
        "sous-emprunt": "Column subtraction with borrowing",
        "sous-sans-emprunt": "Column subtraction without borrowing",
      },
      rechargementEchoue:
        "Saved — reloading failed, refresh the page to double-check.",
      reglagesIndisponibles:
        "Settings unavailable right now — reload the page in a moment.",
      titre: "Sums",
      titreFiche: "Sums to set out",
    },
    enregistrementImpossible: "Saving didn't work just now — try again.",
    espaceParent: "Parent space",
    langue: {
      enregistre: "Saved.",
      hint: "The language of the workshop — the desk and the parent space. Stories already created never change.",
      titre: "Language",
    },
  },
};
