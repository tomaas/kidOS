/**
 * Solveurs du sudoku — deux machines distinctes (KTD2) :
 *
 *  - `solveWithTier` : le solveur HUMAIN borné. Il n'applique que des
 *    techniques simples (palier 1 : singletons nus ; palier 2 : + singletons
 *    cachés ; palier 3 : + candidats bloqués) et ne devine JAMAIS. C'est lui
 *    qui prouve, pendant le creusement, que l'enfant pourra terminer la
 *    grille de bout en bout sans hypothèse — la difficulté est garantie par
 *    construction, pas mesurée.
 *
 *  - `countSolutions` : machinerie interne d'unicité — un backtracker
 *    compteur borné (il s'arrête à 2 solutions), utilisé par le générateur
 *    pour prouver qu'une grille creusée reste à solution unique.
 */

import {
  type Grille,
  regionIndex,
  type Taille,
  type TechniqueTier,
} from "~/lib/sudoku/types";

/* ------------------------------ Géométrie ------------------------------ */

interface Geometrie {
  boxes: number[][];
  boxOfCell: number[];
  cols: number[][];
  peers: number[][];
  rows: number[][];
  units: number[][];
}

const GEO_CACHE = new Map<Taille, Geometrie>();

function geometrie(taille: Taille): Geometrie {
  const cached = GEO_CACHE.get(taille);
  if (cached) {
    return cached;
  }
  const n = taille;
  const rows: number[][] = [];
  const cols: number[][] = [];
  const boxes: number[][] = Array.from({ length: n }, () => []);
  const boxOfCell: number[] = new Array(n * n).fill(0);
  for (let r = 0; r < n; r += 1) {
    const row: number[] = [];
    for (let c = 0; c < n; c += 1) {
      const cell = r * n + c;
      row.push(cell);
      const b = regionIndex(taille, r, c);
      boxOfCell[cell] = b;
      boxes[b].push(cell);
    }
    rows.push(row);
  }
  for (let c = 0; c < n; c += 1) {
    const col: number[] = [];
    for (let r = 0; r < n; r += 1) {
      col.push(r * n + c);
    }
    cols.push(col);
  }
  const units = [...rows, ...cols, ...boxes];
  const peerSets: Set<number>[] = Array.from(
    { length: n * n },
    () => new Set()
  );
  for (const unit of units) {
    for (const cell of unit) {
      for (const other of unit) {
        if (other !== cell) {
          peerSets[cell].add(other);
        }
      }
    }
  }
  const geo: Geometrie = {
    boxes,
    boxOfCell,
    cols,
    peers: peerSets.map((s) => [...s]),
    rows,
    units,
  };
  GEO_CACHE.set(taille, geo);
  return geo;
}

/* --------------------- Candidats (sets, pas de bitwise) --------------------- */

function initialCandidates(
  taille: Taille,
  geo: Geometrie,
  grid: Grille
): Set<number>[] {
  const cands: Set<number>[] = [];
  for (const value of grid) {
    if (value !== 0) {
      cands.push(new Set());
      continue;
    }
    const set = new Set<number>();
    for (let v = 1; v <= taille; v += 1) {
      set.add(v);
    }
    cands.push(set);
  }
  for (const [i, value] of grid.entries()) {
    if (value === 0) {
      continue;
    }
    for (const p of geo.peers[i]) {
      cands[p].delete(value);
    }
  }
  return cands;
}

function place(
  geo: Geometrie,
  work: Grille,
  cands: Set<number>[],
  cell: number,
  value: number
): void {
  work[cell] = value;
  cands[cell].clear();
  for (const p of geo.peers[cell]) {
    cands[p].delete(value);
  }
}

/* ------------------------- Techniques humaines ------------------------- */

/** Palier 1 : chaque case n'ayant qu'un candidat se remplit. */
function placeNakedSingles(
  geo: Geometrie,
  work: Grille,
  cands: Set<number>[]
): boolean {
  let progressed = false;
  for (let i = 0; i < work.length; i += 1) {
    if (work[i] === 0 && cands[i].size === 1) {
      const [value] = cands[i];
      place(geo, work, cands, i, value);
      progressed = true;
    }
  }
  return progressed;
}

/** Palier 2 : dans une unité, un chiffre n'ayant qu'une case possible. */
function placeHiddenSingle(
  taille: Taille,
  geo: Geometrie,
  work: Grille,
  cands: Set<number>[]
): boolean {
  for (const unit of geo.units) {
    for (let v = 1; v <= taille; v += 1) {
      let spot = -1;
      let count = 0;
      for (const cell of unit) {
        if (work[cell] === 0 && cands[cell].has(v)) {
          count += 1;
          spot = cell;
        }
      }
      if (count === 1 && cands[spot].size > 1) {
        place(geo, work, cands, spot, v);
        return true;
      }
    }
  }
  return false;
}

function candidateCells(
  unit: number[],
  work: Grille,
  cands: Set<number>[],
  value: number
): number[] {
  return unit.filter((cell) => work[cell] === 0 && cands[cell].has(value));
}

/**
 * Palier 3, candidats bloqués — pointing : dans une boîte, si toutes les
 * cases candidates d'un chiffre partagent une même ligne (ou colonne), le
 * chiffre disparaît du reste de cette ligne (colonne).
 */
function eliminatePointing(
  taille: Taille,
  geo: Geometrie,
  work: Grille,
  cands: Set<number>[]
): boolean {
  let changed = false;
  for (let b = 0; b < geo.boxes.length; b += 1) {
    for (let v = 1; v <= taille; v += 1) {
      const cells = candidateCells(geo.boxes[b], work, cands, v);
      if (cells.length < 2) {
        continue;
      }
      const rowSet = new Set(cells.map((c) => Math.floor(c / taille)));
      if (rowSet.size === 1) {
        const [r] = rowSet;
        for (const cell of geo.rows[r]) {
          if (geo.boxOfCell[cell] !== b && cands[cell].delete(v)) {
            changed = true;
          }
        }
      }
      const colSet = new Set(cells.map((c) => c % taille));
      if (colSet.size === 1) {
        const [c] = colSet;
        for (const cell of geo.cols[c]) {
          if (geo.boxOfCell[cell] !== b && cands[cell].delete(v)) {
            changed = true;
          }
        }
      }
    }
  }
  return changed;
}

/**
 * Palier 3, candidats bloqués — claiming : dans une ligne/colonne, si toutes
 * les cases candidates d'un chiffre tombent dans une même boîte, le chiffre
 * disparaît du reste de la boîte.
 */
function eliminateClaiming(
  taille: Taille,
  geo: Geometrie,
  work: Grille,
  cands: Set<number>[]
): boolean {
  let changed = false;
  for (const line of [...geo.rows, ...geo.cols]) {
    const inLine = new Set(line);
    for (let v = 1; v <= taille; v += 1) {
      const cells = candidateCells(line, work, cands, v);
      if (cells.length < 2) {
        continue;
      }
      const boxSet = new Set(cells.map((c) => geo.boxOfCell[c]));
      if (boxSet.size === 1) {
        const [b] = boxSet;
        for (const cell of geo.boxes[b]) {
          if (!inLine.has(cell) && cands[cell].delete(v)) {
            changed = true;
          }
        }
      }
    }
  }
  return changed;
}

/* --------------------------- Solveur borné --------------------------- */

function isComplete(work: Grille): boolean {
  return work.every((v) => v !== 0);
}

/**
 * Résout la grille avec les seules techniques du palier — jamais
 * d'hypothèse. Retourne la grille complète, ou null si le palier ne suffit
 * pas (le générateur refuse alors le creusement correspondant).
 */
export function solveWithTier(
  taille: Taille,
  grid: Grille,
  tier: TechniqueTier
): Grille | null {
  const geo = geometrie(taille);
  const work = grid.slice();
  const cands = initialCandidates(taille, geo, work);
  for (;;) {
    if (isComplete(work)) {
      return work;
    }
    if (placeNakedSingles(geo, work, cands)) {
      continue;
    }
    if (tier >= 2 && placeHiddenSingle(taille, geo, work, cands)) {
      continue;
    }
    if (
      tier >= 3 &&
      (eliminatePointing(taille, geo, work, cands) ||
        eliminateClaiming(taille, geo, work, cands))
    ) {
      continue;
    }
    return null;
  }
}

/* ---------------------- Unicité (machinerie interne) ---------------------- */

function candidatesOf(
  taille: Taille,
  geo: Geometrie,
  work: Grille,
  cell: number
): number[] {
  const used = new Set<number>();
  for (const p of geo.peers[cell]) {
    if (work[p] !== 0) {
      used.add(work[p]);
    }
  }
  const out: number[] = [];
  for (let v = 1; v <= taille; v += 1) {
    if (!used.has(v)) {
      out.push(v);
    }
  }
  return out;
}

/**
 * Compte les solutions par backtracking borné (arrêt à `limit`, 2 par
 * défaut) : unicité prouvée sans énumérer tout l'espace. Machinerie interne
 * du générateur — l'enfant, lui, n'a jamais besoin de deviner.
 */
export function countSolutions(
  taille: Taille,
  grid: Grille,
  limit = 2
): number {
  const geo = geometrie(taille);
  const work = grid.slice();
  const compte = (): number => {
    let best = -1;
    let bestCands: number[] | null = null;
    for (let i = 0; i < work.length; i += 1) {
      if (work[i] !== 0) {
        continue;
      }
      const cs = candidatesOf(taille, geo, work, i);
      if (cs.length === 0) {
        return 0;
      }
      if (!bestCands || cs.length < bestCands.length) {
        best = i;
        bestCands = cs;
        if (cs.length === 1) {
          break;
        }
      }
    }
    if (best === -1 || !bestCands) {
      return 1; // grille complète
    }
    let total = 0;
    for (const v of bestCands) {
      work[best] = v;
      total += compte();
      work[best] = 0;
      if (total >= limit) {
        return total;
      }
    }
    return total;
  };
  return compte();
}
