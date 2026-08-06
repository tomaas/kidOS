/**
 * Générateur déterministe de grilles de sudoku. Aucun LLM, aucun réseau :
 * un PRNG seedé (mulberry32, partagé avec le calcul posé) + un remplissage
 * complet par backtracking mélangé + un creusement borné (dig-holes).
 *
 * Garanties (golden-testées) :
 *  - même (taille, générosité, seed) → même grille, octet pour octet ;
 *  - chaque grille émise a EXACTEMENT une solution (countSolutions) ;
 *  - chaque grille se termine de bout en bout avec les seules techniques du
 *    palier de générosité (solveWithTier) — l'enfant ne devine jamais ;
 *  - budget de creusement épuisé → on garde silencieusement la grille plus
 *    généreuse déjà atteinte (plus de givens que la cible est toujours
 *    acceptable) ; `generateSudoku` ne lève JAMAIS.
 */

// mulberry32 vit dans ~/lib/operations (module pur lui aussi) — même PRNG,
// mêmes garanties de reproductibilité que les séries de calcul posé.
import { mulberry32, newSerieSeed } from "~/lib/operations";
import {
  clampGenerosite,
  GIVENS_RANGES,
  TIER_BY_GENEROSITE,
} from "~/lib/sudoku/progression";
import { countSolutions, solveWithTier } from "~/lib/sudoku/solver";
import {
  type Generosite,
  type Grille,
  type Puzzle,
  REGIONS,
  regionIndex,
  type Taille,
} from "~/lib/sudoku/types";

/** Seed de grille fraîche — même horloge que les séries de calcul. */
export function newSudokuSeed(): number {
  return newSerieSeed();
}

/**
 * Empreinte = les givens joints rangée par rangée (0 = case vide) — miroir
 * de fingerprintOps côté calcul : une jointure simple, comparée à la reprise.
 */
export function fingerprintGivens(givens: Grille): string {
  return givens.join("");
}

/* ------------------------------ PRNG utils ------------------------------ */

function shuffled<T>(rand: () => number, items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/* --------------------------- Grille complète --------------------------- */

function allowedValues(taille: Taille, grid: Grille, cell: number): number[] {
  const n = taille;
  const row = Math.floor(cell / n);
  const col = cell % n;
  const box = regionIndex(taille, row, col);
  const used = new Set<number>();
  for (let i = 0; i < grid.length; i += 1) {
    if (grid[i] === 0) {
      continue;
    }
    const r = Math.floor(i / n);
    const c = i % n;
    if (r === row || c === col || regionIndex(taille, r, c) === box) {
      used.add(grid[i]);
    }
  }
  const out: number[] = [];
  for (let v = 1; v <= n; v += 1) {
    if (!used.has(v)) {
      out.push(v);
    }
  }
  return out;
}

/** Remplissage complet par backtracking à candidats mélangés (seedé). */
export function buildSolvedGrid(taille: Taille, seed: number): Grille {
  const rand = mulberry32(seed);
  const grid: Grille = new Array(taille * taille).fill(0);
  const fill = (cell: number): boolean => {
    if (cell === grid.length) {
      return true;
    }
    for (const v of shuffled(rand, allowedValues(taille, grid, cell))) {
      grid[cell] = v;
      if (fill(cell + 1)) {
        return true;
      }
    }
    grid[cell] = 0;
    return false;
  };
  if (fill(0)) {
    return grid;
  }
  // Inatteignable (le backtracking complet trouve toujours une grille) —
  // filet : la grille canonique décalée, valide pour toute géométrie.
  return canonicalGrid(taille);
}

/** Grille valide « par formule » — filet de sécurité, jamais le chemin normal. */
function canonicalGrid(taille: Taille): Grille {
  const { rows: boxRows, cols: boxCols } = REGIONS[taille];
  const grid: Grille = [];
  for (let r = 0; r < taille; r += 1) {
    for (let c = 0; c < taille; c += 1) {
      grid.push(((r * boxCols + Math.floor(r / boxRows) + c) % taille) + 1);
    }
  }
  return grid;
}

/* ------------------------------ Creusement ------------------------------ */

/**
 * Budget de creusement (KTD5) : deux passes mélangées sur les cases — borné
 * par construction, et large (chaque case retentée une fois après que
 * d'autres retraits ont pu débloquer la sienne).
 */
const DIG_PASSES = 2;

function digHoles(
  taille: Taille,
  generosite: Generosite,
  solution: Grille,
  rand: () => number
): Grille {
  const tier = TIER_BY_GENEROSITE[generosite];
  const { cible } = GIVENS_RANGES[taille][generosite];
  const givens = solution.slice();
  let count = givens.length;
  const indices = Array.from({ length: givens.length }, (_, i) => i);
  for (let pass = 0; pass < DIG_PASSES; pass += 1) {
    for (const cell of shuffled(rand, indices)) {
      if (count <= cible) {
        return givens;
      }
      if (givens[cell] === 0) {
        continue;
      }
      const saved = givens[cell];
      givens[cell] = 0;
      if (
        countSolutions(taille, givens, 2) === 1 &&
        solveWithTier(taille, givens, tier) !== null
      ) {
        count -= 1;
      } else {
        givens[cell] = saved;
      }
    }
  }
  // Budget épuisé : on garde la grille plus généreuse déjà atteinte.
  return givens;
}

/* ---------------------------- Entrée sûre ---------------------------- */

/**
 * L'entrée sûre du générateur : générosité invalide clampée, et JAMAIS
 * d'exception (un échec inattendu retombe sur la grille pleine — l'enfant
 * verrait une grille déjà rangée plutôt qu'un écran d'erreur).
 */
export function generateSudoku(
  taille: Taille,
  generosite: unknown,
  seed: number
): Puzzle {
  const g = clampGenerosite(generosite);
  try {
    const solution = buildSolvedGrid(taille, seed);
    // Flux PRNG distinct pour le creusement : la solution reste identique
    // d'une générosité à l'autre à seed égal (seule la dentelle change).
    const digRand = mulberry32(seed + 1);
    const givens = digHoles(taille, g, solution, digRand);
    return {
      fingerprint: fingerprintGivens(givens),
      generosite: g,
      givens,
      seed,
      solution,
      taille,
    };
  } catch {
    const solution = canonicalGrid(taille);
    return {
      fingerprint: fingerprintGivens(solution),
      generosite: g,
      givens: solution.slice(),
      seed,
      solution,
      taille,
    };
  }
}
