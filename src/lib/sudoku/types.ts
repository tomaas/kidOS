/**
 * Types partagés de la mini-app sudoku (grilles calmes à compléter).
 * Tout ce dossier est PUR : aucune lecture d'env, de DB ou de DOM — c'est la
 * condition des golden tests, et la garantie que la difficulté est prouvée
 * PAR CONSTRUCTION (solveur borné aux techniques humaines simples), jamais
 * mesurée sur l'enfant.
 */

/** Tailles de grille proposées. La géométrie des régions vit dans REGIONS. */
export type Taille = 4 | 6 | 9;

/**
 * Générosité choisie par le parent (échelle DESCRIPTIVE, comme les paliers
 * du calcul posé) : 1 = le plus de cases déjà remplies + techniques les plus
 * simples, 3 = le moins de cases + techniques jusqu'aux candidats bloqués.
 * Jamais de progression automatique — le parent prépare l'étagère.
 */
export type Generosite = 1 | 2 | 3;

/**
 * Palier de techniques humaines que le solveur borné s'autorise :
 * 1 = singletons nus seulement, 2 = + singletons cachés,
 * 3 = + candidats bloqués (pointing/claiming). Aucune hypothèse, jamais :
 * chaque grille se termine sans deviner.
 */
export type TechniqueTier = 1 | 2 | 3;

/**
 * Géométrie des régions par taille : dimensions d'une boîte (lignes ×
 * colonnes). 4×4 → boîtes 2×2, 6×6 → boîtes de 2 lignes × 3 colonnes,
 * 9×9 → boîtes 3×3.
 */
export const REGIONS: Record<Taille, { cols: number; rows: number }> = {
  4: { cols: 2, rows: 2 },
  6: { cols: 3, rows: 2 },
  9: { cols: 3, rows: 3 },
};

/** Grille à plat, rangée par rangée (row-major) ; 0 = case vide. */
export type Grille = number[];

/** Index de la région (boîte) d'une case. */
export function regionIndex(taille: Taille, row: number, col: number): number {
  const { rows, cols } = REGIONS[taille];
  return Math.floor(row / rows) * (taille / cols) + Math.floor(col / cols);
}

/**
 * Une grille générée : givens (0 = à compléter), solution complète, et
 * l'empreinte des givens (même rôle que opsFingerprint côté calcul — à la
 * reprise, régénérer depuis (taille, generosite, seed) doit reproduire la
 * MÊME empreinte, sinon la série sauvegardée appartient à une autre grille).
 */
export interface Puzzle {
  fingerprint: string;
  generosite: Generosite;
  givens: Grille;
  seed: number;
  solution: Grille;
  taille: Taille;
}
