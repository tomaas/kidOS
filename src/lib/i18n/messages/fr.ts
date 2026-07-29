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
 */

export const fr = {
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
  ecrans: {
    pageIntrouvableTitre: "Cette page n'existe pas",
    revenirAccueil: "Revenir à l'accueil",
    soucisTexte: "On range tout et on recommence dans un instant.",
    soucisTitre: "Oups, un petit souci",
  },
  parents: {
    langue: {
      enregistre: "Enregistré.",
      enregistrementImpossible:
        "Enregistrement impossible pour le moment — réessaie.",
      hint: "La langue de l'atelier — le bureau et l'espace parent. Les histoires déjà créées ne changent jamais.",
      titre: "La langue",
    },
  },
};

export type Messages = typeof fr;
