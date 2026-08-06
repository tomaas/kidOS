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
      sudoku: "Sudoku",
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
  palette: {
    aucuneEntree: "Nothing on this side.",
    description: "Go to a page of the parent space.",
    groupeAtelier: "The workshop",
    groupeParent: "Parent space",
    indice: "Tip: ⌘K (or Ctrl+K) opens the navigation menu.",
    placeholder: "Search for a page…",
    titre: "Navigation menu",
  },
  parents: {
    barreLaterale: {
      basculer: "Open or close the panel",
      description: "The parent space navigation.",
    },
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
        reglages: {
          description:
            "Keys, models, pictures and voice — the workshop's configuration.",
          titre: "Settings",
        },
        sudoku: {
          description:
            "The grid sizes on offer, how open each one is and the grids to print.",
          titre: "Sudoku",
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
    reglages: {
      ariaEffacer: "Clear the key ({champ})",
      ariaRevenirDefaut: "Return to the deployment setting ({champ})",
      badgeDefaut: "deployment setting",
      champVide: "A field left empty takes the deployment setting again.",
      cleEnPlace: "A key is in place ({indice}).",
      cleEnPlaceSansIndice: "A key is in place.",
      cleNonConfiguree: "No key is configured yet.",
      effacer: "Clear the key",
      enregistre: "Saved.",
      enregistrer: "Save",
      fonctionEnPause:
        "Without a configured key, this feature stays paused for now.",
      garderCle: "Leave empty to keep the current key.",
      intro:
        "The workshop's keys, models and options. Anything set here applies to the next stories, with no redeploy; when nothing is set, the deployment value applies.",
      revenirDefaut: "Return to the deployment setting",
      sections: {
        atelier: {
          apercu: "Preview",
          description:
            "The child's first name and the workshop's wording — the tab title, the portrait and the printed booklet follow.",
          descriptionApp: "Description (browser tab)",
          nomApp: "Workshop name",
          prenom: "Child's first name",
          titre: "First name & workshop",
          titreLivret: "Booklet signature",
        },
        histoires: {
          cle: "Anthropic key",
          description: "The key and the model that write the stories.",
          modele: "Writing model",
          titre: "Stories",
        },
        images: {
          activees: "On",
          cle: "Gemini key",
          desactivees: "Off",
          description:
            "Story illustrations: on/off, key, model and resolution.",
          etat: "Illustrations",
          modele: "Default model",
          resolution: "Resolution",
          titre: "Pictures",
        },
        voix: {
          activee: "On",
          cle: "ElevenLabs key",
          desactivee: "Off",
          description: "Reading aloud: on/off and provider.",
          etat: "Read-aloud voice",
          fournisseur: "Provider",
          titre: "The voice",
        },
      },
      titre: "Settings",
    },
    sudoku: {
      changerGenerosite:
        "The grid in progress continues unchanged — the new openness applies from the next grid.",
      derniereTaille: "At least one size stays on the shelf.",
      enregistrement: "Saving…",
      enregistrer: "Save",
      generosite: "Grid openness",
      generosites: {
        1: "Very open grid — many digits already placed",
        2: "Open grid — a good share of digits already placed",
        3: "Denser grid — few digits already placed",
      },
      intro:
        "Prepare the shelf — just like the sums, you choose which grid sizes are available and how open each one is. The child picks a tray; none of this is ever shown to them.",
      nApparaitPas:
        "Not on the shelf. Turning it off forgets the chosen openness.",
      rechargementEchoue:
        "Saved — reloading failed, refresh the page to double-check.",
      reglagesIndisponibles:
        "Settings unavailable right now — reload the page in a moment.",
      tailles: {
        4: "Small grid (4 by 4)",
        6: "Medium grid (6 by 6)",
        9: "Large grid (9 by 9)",
      },
      titre: "Sudoku",
    },
  },
  sudoku: {
    ariaCellule: {
      donnee: "Row {ligne}, column {colonne} — digit already placed",
      remplie: "Row {ligne}, column {colonne}, {chiffre}",
      vide: "Row {ligne}, column {colonne} — cell to fill in",
    },
    ariaEffacer: "Clear",
    ariaReposerPlateau: "Put the tray back",
    comparer: "I compare with the finished grid",
    grilleEnCours: " — grid in progress",
    imprimer: "Print the grid",
    prendrePlateau: "Take the {taille} tray",
    rangeMoment: "The grid is put away.",
    ranger: "I put the grid away",
    retourGrille: "Back to my grid",
    tailles: {
      4: "small grid (4 by 4)",
      6: "medium grid (6 by 6)",
      9: "large grid (9 by 9)",
    },
    titreFiche: "A grid to fill in",
  },
};
