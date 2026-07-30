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
  parents: {
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
    espaceParent: "Espace parent",
    langue: {
      enregistre: "Enregistré.",
      hint: "La langue de l'atelier — le bureau et l'espace parent. Les histoires déjà créées ne changent jamais.",
      titre: "La langue",
    },
  },
};

export type Messages = typeof fr;
