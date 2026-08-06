/**
 * Le registre UNIQUE des apps du bureau — icône, teinte, chemin, et l'ID qui
 * est AUSSI la clé du libellé dans le catalogue i18n (m.bureau.apps[id]).
 * Consommé par le bureau (les icônes) ET par la layout _bureau (le titre de
 * fenêtre = libellé + pictogramme de l'icône) : les deux lisent la MÊME clé
 * de catalogue — renommer une app ou changer son glyphe ne peut plus
 * désynchroniser l'icône de sa barre de titre (finding maintainability
 * pré-landing), dans aucune langue.
 *
 * /parents n'y figure JAMAIS : hors de l'OS, hors de la grammaire enfant.
 */

import {
  BookHeart,
  Grid2x2,
  Grid3x3,
  Leaf,
  type LucideIcon,
} from "lucide-react";
import type { TeinteIcone } from "~/components/bureau/icone";

/** Les ids du registre = les clés de `bureau.apps` du catalogue (Messages). */
export type AppBureauId = "histoires" | "calculs" | "bibliotheque" | "sudoku";

export interface AppBureau {
  icone: LucideIcon;
  id: AppBureauId;
  teinte: TeinteIcone;
  to: "/aventure" | "/calcul" | "/bibliotheque" | "/sudoku";
}

// Chaque app a sa teinte de la palette calme (tuile d'application, comme les
// icônes d'un vrai OS) — sauge pour les histoires, sable pour les calculs,
// ocre pâle pour la bibliothèque, bleu-gris brumeux pour le sudoku. Jamais
// de couleur hors palette.
export const APPS_BUREAU: readonly AppBureau[] = [
  {
    icone: Leaf,
    id: "histoires",
    teinte: {
      glyphe: "text-accent-foreground",
      tuile:
        "border-accent-foreground/15 bg-gradient-to-b from-accent/55 to-accent",
    },
    to: "/aventure",
  },
  {
    icone: Grid3x3,
    id: "calculs",
    teinte: {
      glyphe: "text-secondary-foreground",
      tuile:
        "border-secondary-foreground/15 bg-gradient-to-b from-secondary/55 to-secondary",
    },
    to: "/calcul",
  },
  {
    icone: BookHeart,
    id: "bibliotheque",
    teinte: {
      glyphe: "text-primary",
      tuile: "border-primary/20 bg-gradient-to-b from-primary/10 to-primary/25",
    },
    to: "/bibliotheque",
  },
  {
    icone: Grid2x2,
    id: "sudoku",
    teinte: {
      glyphe: "text-tertiary-foreground",
      tuile:
        "border-tertiary-foreground/15 bg-gradient-to-b from-tertiary/55 to-tertiary",
    },
    to: "/sudoku",
  },
];

/**
 * L'app dont la fenêtre est ouverte pour ce chemin — le titre de la fenêtre
 * est le libellé de l'icône du bureau (même clé de catalogue, par id). Repli
 * sur la première app (Histoires) pour les chemins profonds de sa famille
 * (/aventure/$id).
 */
export function appPourChemin(pathname: string): AppBureau {
  return (
    APPS_BUREAU.find((app) => pathname.startsWith(app.to)) ?? APPS_BUREAU[0]
  );
}
