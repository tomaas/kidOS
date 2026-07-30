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
  aventure: {
    auHasard: "surprise me",
    cestParti: "Here we go",
    continuer: "Continue",
    etapeAriaFacultatif: " (optional)",
    etapeAriaTermine: " — done",
    etapes: {
      doudou: "Cuddly",
      element: "Element",
      extra: "Your touch",
      hero: "Hero",
      place: "Place",
    },
    etapesAria: "Story steps",
    facultatif: "optional",
    facultatifParenthese: "(optional)",
    histoireReprend: "The story picks up again in a moment.",
    histoireSecrit: "The story is writing itself…",
    histoireSeDessine: "The story is drawing itself…",
    image: {
      dodo: "The picture is napping today.",
      onReessaie: "Trying again…",
      pasMarche: "That didn't work, try again later.",
      reessayer: "Try again",
    },
    imprimer: "Print",
    lecture: {
      lettresAttachees: "Joined-up letters",
      lettresMuettes: "Silent letters",
      lettresNormales: "Plain letters",
      liaisons: "Liaisons",
    },
    onReessaie: "Shall we try again?",
    oui: "Yes",
    passer: "skip",
    placeholderSaveur: "for example: with a soft little cat…",
    questionSaveur: "Would you like to add anything?",
    recommencer: "Start over",
    recommencerAria: "Start over from the beginning",
    recommencerConfirm: "Start again from the beginning?",
    retour: "Back",
    sansDoudou: "no cuddly toy",
    suite: "next",
    titreDoudous: "Which cuddly toys come along?",
    titreElement: "And with what?",
    titreHero: "Who is the hero?",
    titreLieu: "Where does the story happen?",
    uneAutreHistoire: "Another story",
  },
  bibliotheque: {
    histoireOuTuChoisis: "A story where you choose",
    titre: "My library",
    vide: "There are no stories here yet.",
  },
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
  commun: {
    accueil: "Home",
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
    entites: {
      ariaModifier: "Edit {label}",
      ariaRetirer: "Remove {label}",
      ariaSupprimer: "Delete {label}",
      doudous: {
        ajouter: "Add a cuddly toy",
        confirmRetrait:
          "Remove this cuddly toy? Stories already created will not change.",
        intro:
          "Add, edit or remove the cuddly toys offered to the child. The cuddly toy is optional: the child can always choose to go without one. Stories already created keep their original cuddly toy.",
        titre: "Cuddly toys",
      },
      elements: {
        ajouter: "Add an element",
        confirmRetrait:
          "Remove this element? Stories already created will not change.",
        intro:
          "Add, edit or remove the surprise elements offered to the child. The child can pick one or two for the same story. Stories already created keep their original element.",
        titre: "Elements",
      },
      heroes: {
        ajouter: "Add a hero",
        confirmRetrait:
          "Remove this hero? Stories already created will not change.",
        intro:
          "Add, edit or remove the heroes offered to the child. The child can pick one or two for the same story. Stories already created keep their original hero.",
        titre: "Heroes",
      },
      lieux: {
        ajouter: "Add a place",
        confirmRetrait:
          "Delete this place? Stories already created will not change.",
        intro:
          "Add, edit or remove the places offered to the child. Stories already created keep their original place.",
        titre: "Places",
      },
    },
    espaceParent: "Parent space",
    formulaires: {
      ajouter: "Add",
      annuler: "Cancel",
      cheminImage: "Image path (optional, advanced)",
      descriptionHistoire:
        "Description for the story (the child never sees it)",
      descriptionIllustration:
        "Description for the illustration (the child never sees it)",
      emoji: "Emoji (optional)",
      enregistrer: "Save",
      nom: "Name (shown to the child)",
      placeholders: {
        doudou: {
          descriptionHistoire:
            "a soft little rabbit, a calm companion who comforts the hero and stays close by",
          descriptionIllustration:
            "a soft plush rabbit with long ears, cream-coloured",
          nom: "a small plush rabbit",
        },
        element: {
          descriptionHistoire:
            "a magic key that opens surprising, gentle doors",
          nom: "a magic key",
        },
        hero: {
          descriptionHistoire: "Mona, Jules's big sister, kind and brave",
          descriptionIllustration:
            "a little boy with brown hair and a gentle smile",
          prenom: "Mona",
        },
        lieu: {
          descriptionHistoire:
            "in grandpa's garden, with its flowers, its vegetables and an old apple tree",
          nom: "grandpa's garden",
        },
        vide: "(empty)",
      },
      prenom: "First name (shown to the child)",
    },
    imageModel: {
      intro:
        "Choose the Google model that draws the illustrations. The choice applies to the next images, on this device. Stories already drawn do not change.",
      parDefaut: "default",
      titre: "The image model",
    },
    index: {
      intro:
        "Manage what the child can choose: heroes, places, elements and cuddly toys. Stories already created never change.",
      sections: {
        calcul: {
          description:
            "The level of the column operations, the series size and the sheets to print.",
          titre: "Sums",
        },
        doudous: {
          description: "The comforting companions, always optional.",
          titre: "Cuddly toys",
        },
        elements: {
          description: "The surprise elements that spice up the story.",
          titre: "Elements",
        },
        heroes: {
          description:
            "The characters offered to the child. Add, edit or remove a hero.",
          titre: "Heroes",
        },
        imageModel: {
          description:
            "Choose the Google model that draws the illustrations (quality / price / speed).",
          titre: "The image model",
        },
        lieux: {
          description: "The places where the story can happen.",
          titre: "Places",
        },
      },
    },
    langue: {
      enregistre: "Saved.",
      hint: "The language of the workshop — the desk and the parent space. Stories already created never change.",
      titre: "Language",
    },
    playground: {
      altApercu: "Generated preview",
      generer: "Generate",
      imagesDesactivees:
        "Images are turned off (IMAGE_ENABLED). Turn them on to try this out.",
      intro:
        "Generate a trial image to compare the models. Each try joins the list — you can look at them side by side.",
      jeDessine: "Drawing…",
      modele: "Model",
      pasPuGenerer: "The drawing couldn't be generated.",
      prompt: "Prompt",
      titre: "Try a prompt",
    },
  },
};
