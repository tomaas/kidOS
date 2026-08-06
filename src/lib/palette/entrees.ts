/**
 * Le registre PUR des destinations de la palette ⌘K — même idée que
 * `components/bureau/apps.tsx` : une seule liste, dont l'`id` est AUSSI la clé
 * du libellé dans le catalogue i18n. Aucune dépendance (ni React, ni lucide) :
 * le golden `test:routes` l'importe pour vérifier que chaque destination est
 * une URL réellement servie.
 *
 * La palette est une porte PARENT (comme /parents : atteignable par URL, jamais
 * dessinée dans la grammaire enfant). Elle ne contient donc que l'espace parent
 * et le retour au bureau — jamais un raccourci vers une mini-app, que l'enfant
 * ouvre lui-même par son icône.
 */

/** Les groupes affichés, dans cet ordre. */
export type GroupePalette = "parent" | "atelier";

/**
 * L'id d'une entrée = la clé de son libellé. `accueil` lit `commun.accueil`,
 * `espaceParent` lit `parents.espaceParent`, les autres lisent
 * `parents.index.sections[id].titre` — la MÊME clé que les cartes de
 * /parents : renommer une section ne peut pas désynchroniser la palette.
 */
export type EntreePaletteId =
  | "accueil"
  | "espaceParent"
  | "heroes"
  | "lieux"
  | "elements"
  | "doudous"
  | "calcul"
  | "sudoku"
  | "imageModel"
  | "reglages";

/** Les chemins atteignables — le type est vérifié contre l'arbre du router. */
export type CheminPalette =
  | "/"
  | "/parents"
  | "/parents/heroes"
  | "/parents/lieux"
  | "/parents/elements"
  | "/parents/doudous"
  | "/parents/calcul"
  | "/parents/sudoku"
  | "/parents/image-model"
  | "/parents/reglages";

export interface EntreePalette {
  readonly groupe: GroupePalette;
  readonly id: EntreePaletteId;
  /**
   * Mots-clés de recherche EN PLUS du libellé traduit : les segments d'URL,
   * identiques dans les deux langues. Taper « reglages » trouve la page même
   * quand l'atelier est en anglais, et inversement.
   */
  readonly motsCles: readonly string[];
  readonly to: CheminPalette;
}

export const ENTREES_PALETTE: readonly EntreePalette[] = [
  {
    groupe: "parent",
    id: "espaceParent",
    motsCles: ["parents", "parent"],
    to: "/parents",
  },
  {
    groupe: "parent",
    id: "reglages",
    motsCles: ["reglages", "settings", "config"],
    to: "/parents/reglages",
  },
  {
    groupe: "parent",
    id: "heroes",
    motsCles: ["heroes", "heros"],
    to: "/parents/heroes",
  },
  {
    groupe: "parent",
    id: "lieux",
    motsCles: ["lieux", "places"],
    to: "/parents/lieux",
  },
  {
    groupe: "parent",
    id: "elements",
    motsCles: ["elements"],
    to: "/parents/elements",
  },
  {
    groupe: "parent",
    id: "doudous",
    motsCles: ["doudous"],
    to: "/parents/doudous",
  },
  {
    groupe: "parent",
    id: "calcul",
    motsCles: ["calcul", "operations", "sums"],
    to: "/parents/calcul",
  },
  {
    groupe: "parent",
    id: "sudoku",
    motsCles: ["sudoku", "grille", "grilles"],
    to: "/parents/sudoku",
  },
  {
    groupe: "parent",
    id: "imageModel",
    motsCles: ["image-model", "image", "modele", "model"],
    to: "/parents/image-model",
  },
  { groupe: "atelier", id: "accueil", motsCles: ["accueil", "home"], to: "/" },
];

/** Les entrées d'un groupe, dans l'ordre du registre. */
export function entreesDuGroupe(
  groupe: GroupePalette
): readonly EntreePalette[] {
  return ENTREES_PALETTE.filter((entree) => entree.groupe === groupe);
}
