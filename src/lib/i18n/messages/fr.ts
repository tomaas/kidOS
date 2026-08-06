/**
 * Catalogue FRANÇAIS — la référence : `Messages` est inféré de cet objet, le
 * catalogue EN doit avoir exactement la même forme (vérifié par le compilateur
 * ET par test:i18n). Les octets français ici sont des DÉPLACEMENTS de
 * littéraux existants, jamais des réécritures — plusieurs sont épinglés
 * byte-exact par le golden.
 *
 * Règle d'écriture (contrainte calme, les deux langues) : jamais de
 * bravo/gagné/perdu/vite/erreur, jamais d'enjeu ni d'évaluation — le golden
 * scanne chaque feuille des deux catalogues.
 *
 * Les gabarits à trous ({familles}) se composent via formatMessage — la
 * composition FR est épinglée byte-exact contre l'aria historique.
 */

export const fr = {
  aventure: {
    auHasard: "au hasard",
    cestParti: "C'est parti",
    continuer: "Continuer",
    // Suffixes d'aria du stepper — concaténés à libellé constant (l'aria est
    // stable à langue constante, même contrat que le plateau de calcul).
    etapeAriaFacultatif: " (facultatif)",
    etapeAriaTermine: " — terminé",
    // Libellés des étapes du wizard, par id (lib/wizard-steps.ts).
    etapes: {
      doudou: "Doudou",
      element: "Élément",
      extra: "Touche perso",
      hero: "Héros",
      place: "Lieu",
    },
    etapesAria: "Étapes de l'histoire",
    facultatif: "facultatif",
    facultatifParenthese: "(facultatif)",
    histoireReprend: "L'histoire reprend doucement.",
    histoireSecrit: "L'histoire s'écrit…",
    histoireSeDessine: "L'histoire se dessine…",
    image: {
      dodo: "L'image fait dodo aujourd'hui.",
      onReessaie: "On réessaie…",
      pasMarche: "Ça n'a pas marché, réessaie plus tard.",
      reessayer: "Réessayer",
    },
    imprimer: "Imprimer",
    lecture: {
      lettresAttachees: "Lettres attachées",
      lettresMuettes: "Lettres muettes",
      lettresNormales: "Lettres normales",
      liaisons: "Liaisons",
    },
    onReessaie: "On réessaie ?",
    oui: "Oui",
    passer: "passer",
    placeholderSaveur: "par exemple : avec un petit chat tout doux…",
    questionSaveur: "Tu veux ajouter quelque chose ?",
    recommencer: "Recommencer",
    recommencerAria: "Recommencer depuis le début",
    recommencerConfirm: "On recommence depuis le début ?",
    retour: "Retour",
    sansDoudou: "sans doudou",
    suite: "suite",
    titreDoudous: "Avec quels doudous ?",
    titreElement: "Et avec quoi ?",
    titreHero: "Qui est le héros ?",
    titreLieu: "Où se passe l'histoire ?",
    uneAutreHistoire: "Une autre histoire",
  },
  bibliotheque: {
    histoireOuTuChoisis: "Histoire où tu choisis",
    titre: "Ma bibliothèque",
    vide: "Il n'y a pas encore d'histoire ici.",
  },
  bureau: {
    // Libellés des apps, par id du registre (components/bureau/apps.tsx) —
    // consommés par l'icône ET la barre de titre, toujours via la même clé.
    apps: {
      bibliotheque: "Bibliothèque",
      calculs: "Calculs",
      histoires: "Histoires",
      sudoku: "Sudoku",
    },
    entrer: "Entrer",
    fermerFenetre: "Fermer la fenêtre",
    ranger: "Ranger le bureau",
  },
  calcul: {
    ariaEffacer: "Effacer",
    ariaReposerPlateau: "Reposer le plateau",
    atelierRange: "L'atelier est rangé.",
    // Noms d'affichage des familles — byte-identiques à FAMILLE_NOMS
    // (settings.ts), épinglé par test:i18n : l'aria du plateau et la carte
    // parent gardent leurs octets historiques.
    familles: {
      addition: "additions",
      multiplication: "multiplications",
      soustraction: "soustractions",
    },
    jaiFiniJeCompare: "J'ai fini, je compare",
    plateauSuivant: "Plateau suivant",
    prendrePlateau: "Prendre le plateau des {familles}",
    rangerAtelier: "Ranger l'atelier",
    serieEnCours: " — série en cours",
  },
  commun: {
    accueil: "Accueil",
  },
  ecrans: {
    pageIntrouvableTitre: "Cette page n'existe pas",
    revenirAccueil: "Revenir à l'accueil",
    soucisTexte: "On range tout et on recommence dans un instant.",
    soucisTitre: "Oups, un petit souci",
  },
  // La palette ⌘K (components/palette-parent.tsx) — de la NAVIGATION parent,
  // pas des actions. Les libellés des destinations viennent des mêmes clés que
  // les cartes de /parents ; il n'y a ici que le cadre de la palette.
  palette: {
    aucuneEntree: "Rien de ce côté.",
    description: "Rejoins une page de l'espace parent.",
    groupeAtelier: "L'atelier",
    groupeParent: "Espace parent",
    // Le rappel du raccourci, dans le pied du panneau latéral de l'espace
    // parent seulement — jamais côté enfant.
    indice: "Astuce : ⌘K (ou Ctrl+K) ouvre le menu de navigation.",
    placeholder: "Chercher une page…",
    titre: "Menu de navigation",
  },
  parents: {
    // La barre latérale de l'espace parent (app/parents/route.tsx) — seul le
    // déclencheur (icône seule) a besoin d'un libellé ; les entrées de
    // navigation portent leur libellé visible (parents.index.sections).
    barreLaterale: {
      basculer: "Ouvrir ou fermer le panneau",
      description: "La navigation de l'espace parent.",
    },
    calcul: {
      changerPalier: "Changer le palier range la série en cours.",
      changerTaille:
        "Changer la taille range les séries en cours de toutes les familles.",
      derniereFamille: "Au moins une famille reste sur l'étagère.",
      enregistrement: "Enregistrement…",
      enregistrer: "Enregistrer",
      imprimerFiche: "Imprimer une fiche",
      intro:
        "Prépare l'étagère — comme l'éducatrice décide des présentations, c'est toi qui choisis les familles d'opérations disponibles et leur palier. L'enfant choisit son plateau ; rien de tout cela ne lui est montré.",
      nApparaitPas:
        "N'apparaît pas sur l'étagère. Désactiver oublie le palier choisi.",
      operationsParSerie: "Opérations par série",
      // Libellés des paliers par id (progression.ts) — byte-identiques aux
      // `label` FRANÇAIS du module pur (épinglé par test:i18n).
      paliers: {
        "add-grands-nombres": "Additions posées jusqu'aux milliers",
        "add-retenue": "Additions posées avec retenue",
        "add-sans-retenue": "Additions posées sans retenue",
        "mult-1-chiffre": "Multiplications posées à 1 chiffre",
        "mult-abstraite": "Multiplications posées, sans le matériel",
        "sous-emprunt": "Soustractions posées avec emprunt",
        "sous-sans-emprunt": "Soustractions posées sans emprunt",
      },
      rechargementEchoue:
        "Enregistré — le rechargement a échoué, recharge la page pour vérifier.",
      reglagesIndisponibles:
        "Réglages indisponibles pour le moment — recharge la page dans un instant.",
      titre: "Les calculs",
      titreFiche: "Des calculs à poser",
    },
    enregistrementImpossible:
      "Enregistrement impossible pour le moment — réessaie.",
    // Pages CRUD des entités (héros, lieux, doudous, éléments) — titres,
    // intros et confirmations déplacés verbatim depuis les routes.
    entites: {
      // Gabarits d'aria partagés ({label} = le nom de l'entrée) ; lieux dit
      // « Supprimer », les trois autres « Retirer » — distinction historique.
      ariaModifier: "Modifier {label}",
      ariaRetirer: "Retirer {label}",
      ariaSupprimer: "Supprimer {label}",
      doudous: {
        ajouter: "Ajouter un doudou",
        confirmRetrait:
          "Retirer ce doudou ? Les histoires déjà créées ne changeront pas.",
        intro:
          "Ajoute, modifie ou retire les doudous proposés à l'enfant. Le doudou est facultatif : l'enfant peut toujours choisir de ne pas en prendre. Les histoires déjà créées gardent leur doudou d'origine.",
        titre: "Les doudous",
      },
      elements: {
        ajouter: "Ajouter un élément",
        confirmRetrait:
          "Retirer cet élément ? Les histoires déjà créées ne changeront pas.",
        intro:
          "Ajoute, modifie ou retire les éléments surprise proposés à l'enfant. L'enfant peut en choisir un ou deux pour une même histoire. Les histoires déjà créées gardent leur élément d'origine.",
        titre: "Les éléments",
      },
      heroes: {
        ajouter: "Ajouter un héros",
        confirmRetrait:
          "Retirer ce héros ? Les histoires déjà créées ne changeront pas.",
        intro:
          "Ajoute, modifie ou retire les héros proposés à l'enfant. L'enfant peut en choisir un ou deux pour une même histoire. Les histoires déjà créées gardent leur héros d'origine.",
        titre: "Les héros",
      },
      lieux: {
        ajouter: "Ajouter un lieu",
        confirmRetrait:
          "Supprimer ce lieu ? Les histoires déjà créées ne changeront pas.",
        intro:
          "Ajoute, modifie ou retire les lieux proposés à l'enfant. Les histoires déjà créées gardent leur lieu d'origine.",
        titre: "Les lieux",
      },
    },
    espaceParent: "Espace parent",
    // Formulaires d'entité — libellés et actions PARTAGÉS entre les quatre
    // formulaires ; les placeholders (des exemples) restent par entité.
    formulaires: {
      ajouter: "Ajouter",
      annuler: "Annuler",
      cheminImage: "Chemin d'image (facultatif, avancé)",
      descriptionHistoire:
        "Description pour l'histoire (l'enfant ne la voit pas)",
      descriptionIllustration:
        "Description pour l'illustration (l'enfant ne la voit pas)",
      emoji: "Emoji (facultatif)",
      enregistrer: "Enregistrer",
      nom: "Nom (montré à l'enfant)",
      placeholders: {
        doudou: {
          descriptionHistoire:
            "un petit lapin tout doux, compagnon calme qui rassure le héros et reste près de lui",
          descriptionIllustration:
            "une peluche lapin toute douce aux longues oreilles, couleur crème",
          nom: "un petit lapin en peluche",
        },
        element: {
          descriptionHistoire:
            "une clé magique qui ouvre des portes surprenantes et douces",
          nom: "une clé magique",
        },
        hero: {
          descriptionHistoire:
            "Mona, la grande sœur de Jules, gentille et courageuse",
          descriptionIllustration:
            "un petit garçon aux cheveux bruns, au sourire doux",
          prenom: "Mona",
        },
        lieu: {
          descriptionHistoire:
            "dans le jardin de papy, avec ses fleurs, ses légumes et un vieux pommier",
          nom: "le jardin de papy",
        },
        vide: "(vide)",
      },
      prenom: "Prénom (montré à l'enfant)",
    },
    imageModel: {
      intro:
        "Choisis le modèle Google qui dessine les illustrations. Le choix s'applique aux prochaines images, sur cet appareil. Les histoires déjà dessinées ne changent pas.",
      parDefaut: "par défaut",
      titre: "Le modèle d'image",
    },
    // Les sections de l'espace parent — libellés du panneau latéral et de la
    // palette ⌘K (l'ancien hub à cartes est retiré ; /parents redirige).
    index: {
      sections: {
        calcul: {
          description:
            "Le palier des opérations posées, la taille des séries et les fiches à imprimer.",
          titre: "Les calculs",
        },
        doudous: {
          description: "Les compagnons rassurants, toujours facultatifs.",
          titre: "Les doudous",
        },
        elements: {
          description: "Les éléments surprise qui pimentent l'histoire.",
          titre: "Les éléments",
        },
        heroes: {
          description:
            "Les personnages proposés à l'enfant. Ajoute, modifie ou retire un héros.",
          titre: "Les héros",
        },
        imageModel: {
          description:
            "Choisis le modèle Google qui dessine les illustrations (qualité / prix / vitesse).",
          titre: "Le modèle d'image",
        },
        lieux: {
          description: "Les endroits où l'histoire peut se passer.",
          titre: "Les lieux",
        },
        reglages: {
          description:
            "Clés, modèles, images et voix — la configuration de l'atelier.",
          titre: "Les réglages",
        },
        sudoku: {
          description:
            "Les tailles de grille proposées, l'ouverture de chacune et les grilles à imprimer.",
          titre: "Le sudoku",
        },
      },
    },
    langue: {
      enregistre: "Enregistré.",
      hint: "La langue de l'atelier — le bureau et l'espace parent. Les histoires déjà créées ne changent jamais.",
      titre: "La langue",
    },
    // Le bac à essai d'images (sous le choix du modèle) — le prompt par
    // défaut reste dans le composant : c'est une entrée de test, pas de l'UI.
    playground: {
      altApercu: "Aperçu généré",
      generer: "Générer",
      imagesDesactivees:
        "Les images sont désactivées (IMAGE_ENABLED). Active-les pour tester.",
      intro:
        "Génère une image d'essai pour comparer les modèles. Chaque essai s'ajoute à la liste — tu peux les regarder côte à côte.",
      jeDessine: "Je dessine…",
      modele: "Modèle",
      pasPuGenerer: "Le dessin n'a pas pu être généré.",
      prompt: "Prompt",
      titre: "Tester un prompt",
    },
    // La page /parents/reglages — clés, modèles et options, posés en base
    // (app_settings) avec l'env du déploiement en secours. Ton CALME : un
    // état « non configurée » est neutre, jamais une urgence.
    reglages: {
      // Gabarit d'aria ({champ} = le libellé du champ) — composé via
      // formatMessage, comme parents.entites.
      ariaEffacer: "Effacer la clé ({champ})",
      ariaRevenirDefaut: "Revenir au réglage du déploiement ({champ})",
      badgeDefaut: "réglage du déploiement",
      champVide: "Un champ laissé vide reprend le réglage du déploiement.",
      cleEnPlace: "Une clé est en place ({indice}).",
      cleEnPlaceSansIndice: "Une clé est en place.",
      cleNonConfiguree: "Aucune clé n'est configurée pour le moment.",
      effacer: "Effacer la clé",
      enregistre: "Enregistré.",
      enregistrer: "Enregistrer",
      // Statut « missing-key » (code serveur, features.*) — neutre et calme :
      // jamais une urgence, jamais du rouge.
      fonctionEnPause:
        "Sans clé configurée, cette fonction reste en pause pour le moment.",
      garderCle: "Laisse vide pour garder la clé actuelle.",
      intro:
        "Les clés, modèles et options de l'atelier. Un réglage posé ici s'applique aux prochaines histoires, sans redéploiement ; sans réglage, la valeur du déploiement s'applique.",
      revenirDefaut: "Revenir au réglage du déploiement",
      sections: {
        atelier: {
          apercu: "Aperçu",
          description:
            "Le prénom de l'enfant et les textes de l'atelier — le titre de l'onglet, le portrait et le livret imprimé suivent.",
          descriptionApp: "Description (onglet du navigateur)",
          nomApp: "Nom de l'atelier",
          prenom: "Prénom de l'enfant",
          titre: "Le prénom & l'atelier",
          titreLivret: "Signature du livret",
        },
        histoires: {
          cle: "Clé Anthropic",
          description: "La clé et le modèle qui écrivent les histoires.",
          modele: "Modèle d'écriture",
          titre: "Les histoires",
        },
        images: {
          activees: "Activées",
          cle: "Clé Gemini",
          desactivees: "Désactivées",
          description:
            "Les illustrations des histoires : activation, clé, modèle et résolution.",
          etat: "Illustrations",
          modele: "Modèle par défaut",
          resolution: "Résolution",
          titre: "Les images",
        },
        voix: {
          activee: "Activée",
          cle: "Clé ElevenLabs",
          desactivee: "Désactivée",
          description: "La lecture à voix haute : activation et fournisseur.",
          etat: "Lecture à voix haute",
          fournisseur: "Fournisseur",
          titre: "La voix",
        },
      },
      titre: "Les réglages",
    },
    // La page /parents/sudoku — même grammaire que parents.calcul : le parent
    // prépare l'étagère (tailles activées + ouverture de chacune), l'enfant
    // choisit son plateau. L'« ouverture » décrit la GRILLE (combien de
    // chiffres sont déjà posés), jamais l'enfant — aucune échelle de niveau.
    sudoku: {
      changerGenerosite: "Changer l'ouverture range la grille en cours.",
      derniereTaille: "Au moins une taille reste sur l'étagère.",
      enregistrement: "Enregistrement…",
      enregistrer: "Enregistrer",
      generosite: "Ouverture de la grille",
      // Libellés des trois ouvertures (Generosite 1 → 3) — descriptifs de la
      // grille, jamais évaluatifs.
      generosites: {
        1: "Grille très ouverte — beaucoup de chiffres déjà posés",
        2: "Grille ouverte — une bonne part des chiffres déjà posés",
        3: "Grille plus dense — peu de chiffres déjà posés",
      },
      imprimerFiche: "Imprimer une grille",
      intro:
        "Prépare l'étagère — comme pour les calculs, c'est toi qui choisis les tailles de grille disponibles et l'ouverture de chacune. L'enfant choisit son plateau ; rien de tout cela ne lui est montré.",
      nApparaitPas:
        "N'apparaît pas sur l'étagère. Désactiver oublie l'ouverture choisie.",
      rechargementEchoue:
        "Enregistré — le rechargement a échoué, recharge la page pour vérifier.",
      reglagesIndisponibles:
        "Réglages indisponibles pour le moment — recharge la page dans un instant.",
      // Titres des cartes par taille — les mêmes noms de taille que côté
      // enfant (sudoku.tailles), capitalisés pour la carte.
      tailles: {
        4: "Petite grille (4 par 4)",
        6: "Moyenne grille (6 par 6)",
        9: "Grande grille (9 par 9)",
      },
      titre: "Le sudoku",
    },
  },
  // La mini-app sudoku côté enfant — même grammaire que `calcul` : l'étagère
  // de plateaux, la grille qui se range, jamais de niveau visible.
  sudoku: {
    ariaCellule: {
      donnee: "Ligne {ligne}, colonne {colonne} — chiffre déjà posé",
      vide: "Ligne {ligne}, colonne {colonne} — case à compléter",
    },
    ariaEffacer: "Effacer",
    ariaReposerPlateau: "Reposer le plateau",
    comparer: "Je compare avec la grille terminée",
    grilleEnCours: " — grille en cours",
    imprimer: "Imprimer la grille",
    prendrePlateau: "Prendre le plateau {taille}",
    rangeMoment: "La grille est rangée.",
    ranger: "Je range la grille",
    retourGrille: "Je reviens à ma grille",
    // Noms des tailles — des mots de TAILLE, jamais de niveau ni d'aptitude.
    tailles: {
      4: "petite grille (4 par 4)",
      6: "moyenne grille (6 par 6)",
      9: "grande grille (9 par 9)",
    },
    titreFiche: "Une grille à compléter",
  },
};

export type Messages = typeof fr;
