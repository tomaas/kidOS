/**
 * SUDOKU assertion script — générateur, solveur borné, échelle de générosité.
 *
 * Pins the pure sudoku engine. Same standalone-runnable pattern as
 * operations.golden.ts (no test runner in this app):
 *   bun run src/lib/sudoku/__tests__/sudoku.golden.ts
 * (wired as `bun run test:sudoku`). Exits non-zero on any failure.
 * Pure modules (no env import) — no SKIP_ENV_VALIDATION needed.
 *
 * Ce que ces assertions verrouillent (décisions du plan sudoku, R10/R11) :
 *  - déterminisme total à (taille, générosité, seed) égal — fixtures 4×4,
 *    6×6 et 9×9 épinglées octet pour octet ;
 *  - unicité de solution sur un balayage de seeds (50 par générosité pour
 *    4×4 et 6×6 ; 20 pour 9×9 — le comptage de solutions y est plus cher,
 *    on garde le golden sous quelques secondes) ;
 *  - mécanisme AE5 : régénérer avec la générosité sauvegardée reproduit
 *    l'empreinte ; une autre générosité ne la reproduit pas ;
 *  - borne de techniques (KTD2) : générosité 1 → singletons nus seulement ;
 *    générosité 3 → jamais au-delà des candidats bloqués (le solveur borné
 *    termine chaque grille — l'enfant ne devine jamais) ;
 *  - nombre de givens dans les bornes constantes par (taille, générosité),
 *    entrée sûre qui ne lève jamais, générosité invalide clampée à 1 ;
 *  - budget temps : cible produit 150 ms pour un 9×9 générosité 3 ; le
 *    golden borne à 1500 ms pour absorber la variance CI ;
 *  - géométrie des régions : lignes, colonnes et régions de chaque solution
 *    sont des permutations de 1..N pour les trois tailles.
 */

import {
  clampGenerosite,
  countSolutions,
  fingerprintGivens,
  GENEROSITES,
  type Generosite,
  GIVENS_RANGES,
  type Grille,
  generateSudoku,
  type Puzzle,
  REGIONS,
  regionIndex,
  solveWithTier,
  TAILLES,
  type Taille,
  TIER_BY_GENEROSITE,
} from "~/lib/sudoku";

let failures = 0;
function check(name: string, ok: boolean, detail?: string) {
  if (ok) {
    console.log(`✓ ${name}`);
  } else {
    failures += 1;
    console.error(`✗ ${name}${detail ? `\n  ${detail}` : ""}`);
  }
}

/* ------------------- Identité PRNG (fixtures épinglées) ------------------- */

// Valeurs EXACTES épinglées (même esprit que operations.golden.ts) : si
// mulberry32, le remplissage, le mélange ou le creusement change, ces pins
// cassent — c'est voulu, les goldens sont l'identité du générateur.
const FIXTURES: {
  generosite: Generosite;
  givens: string;
  seed: number;
  solution: string;
  taille: Taille;
}[] = [
  {
    generosite: 2,
    givens: "2403300400004001",
    seed: 424_242,
    solution: "2413312413424231",
    taille: 4,
  },
  {
    generosite: 2,
    givens: "300540020063000300003026604010500604",
    seed: 424_242,
    solution: "361542425163246351153426634215512634",
    taille: 6,
  },
  {
    generosite: 3,
    givens:
      "020001790050200006100307000400000009800005040097000600006000012008000000271048030",
    seed: 424_242,
    solution:
      "624581793753294186189367524415836279862975341397412658946753812538129467271648935",
    taille: 9,
  },
];

for (const f of FIXTURES) {
  const puzzle = generateSudoku(f.taille, f.generosite, f.seed);
  check(
    `fixture ${f.taille}×${f.taille} (générosité ${f.generosite}, seed ${f.seed}) : givens épinglés`,
    puzzle.fingerprint === f.givens,
    puzzle.fingerprint
  );
  check(
    `fixture ${f.taille}×${f.taille} : solution épinglée`,
    puzzle.solution.join("") === f.solution,
    puzzle.solution.join("")
  );
  const again = generateSudoku(f.taille, f.generosite, f.seed);
  check(
    `fixture ${f.taille}×${f.taille} : régénération identique octet pour octet`,
    again.fingerprint === puzzle.fingerprint &&
      again.solution.join("") === puzzle.solution.join("")
  );
  check(
    `fixture ${f.taille}×${f.taille} : fingerprint = givens joints row-major`,
    fingerprintGivens(puzzle.givens) === puzzle.fingerprint
  );
}

/* ----------------- Géométrie : permutations de 1..N partout ----------------- */

function isPermutation(taille: Taille, values: number[]): boolean {
  if (values.length !== taille) {
    return false;
  }
  const seen = new Set(values);
  for (let v = 1; v <= taille; v += 1) {
    if (!seen.has(v)) {
      return false;
    }
  }
  return true;
}

function solutionValide(taille: Taille, solution: Grille): boolean {
  for (let r = 0; r < taille; r += 1) {
    const row: number[] = [];
    for (let c = 0; c < taille; c += 1) {
      row.push(solution[r * taille + c]);
    }
    if (!isPermutation(taille, row)) {
      return false;
    }
  }
  for (let c = 0; c < taille; c += 1) {
    const col: number[] = [];
    for (let r = 0; r < taille; r += 1) {
      col.push(solution[r * taille + c]);
    }
    if (!isPermutation(taille, col)) {
      return false;
    }
  }
  const regions: number[][] = Array.from({ length: taille }, () => []);
  for (let r = 0; r < taille; r += 1) {
    for (let c = 0; c < taille; c += 1) {
      regions[regionIndex(taille, r, c)].push(solution[r * taille + c]);
    }
  }
  return regions.every((region) => isPermutation(taille, region));
}

check(
  "géométrie : REGIONS couvre les 3 tailles (2×2, 2 lignes × 3 colonnes, 3×3)",
  REGIONS[4].rows === 2 &&
    REGIONS[4].cols === 2 &&
    REGIONS[6].rows === 2 &&
    REGIONS[6].cols === 3 &&
    REGIONS[9].rows === 3 &&
    REGIONS[9].cols === 3
);

/* ------------- Balayage : unicité, techniques, bornes de givens ------------- */

// 50 seeds par générosité pour 4×4 et 6×6, 20 pour 9×9 (comptage plus cher).
const puzzles: Puzzle[] = [];
for (const taille of TAILLES) {
  const nSeeds = taille === 9 ? 20 : 50;
  for (const generosite of GENEROSITES) {
    let uniques = true;
    let solvable = true;
    let dansBornes = true;
    let jamaisLeve = true;
    for (let s = 1; s <= nSeeds; s += 1) {
      let puzzle: Puzzle | null = null;
      try {
        puzzle = generateSudoku(taille, generosite, s * 101);
      } catch {
        jamaisLeve = false;
        break;
      }
      puzzles.push(puzzle);
      if (countSolutions(taille, puzzle.givens, 2) !== 1) {
        uniques = false;
      }
      if (
        solveWithTier(taille, puzzle.givens, TIER_BY_GENEROSITE[generosite]) ===
        null
      ) {
        solvable = false;
      }
      const count = puzzle.givens.filter((v) => v !== 0).length;
      const { cible, max } = GIVENS_RANGES[taille][generosite];
      if (count < cible || count > max) {
        dansBornes = false;
      }
    }
    const label = `${taille}×${taille} générosité ${generosite} (${nSeeds} seeds)`;
    check(`${label} : entrée sûre, ne lève jamais`, jamaisLeve);
    check(`${label} : exactement une solution partout`, uniques);
    check(
      `${label} : le solveur borné au palier de techniques termine chaque grille`,
      solvable
    );
    check(`${label} : nombre de givens dans les bornes constantes`, dansBornes);
  }
}

check(
  "balayage : chaque solution est une permutation de 1..N sur lignes, colonnes et régions",
  puzzles.every((p) => solutionValide(p.taille, p.solution))
);
check(
  "balayage : chaque grille de givens est un sous-ensemble de sa solution",
  puzzles.every((p) => p.givens.every((v, i) => v === 0 || v === p.solution[i]))
);

/* --------------------- Mécanisme AE5 (empreinte de reprise) --------------------- */

{
  const sauvegarde = generateSudoku(9, 2, 31_337);
  const regeneree = generateSudoku(9, 2, 31_337);
  check(
    "AE5 : régénérer avec la générosité sauvegardée reproduit l'empreinte",
    regeneree.fingerprint === sauvegarde.fingerprint
  );
  const autre = generateSudoku(9, 3, 31_337);
  check(
    "AE5 : une autre générosité ne reproduit pas l'empreinte",
    autre.fingerprint !== sauvegarde.fingerprint
  );
  check(
    "AE5 : à seed égal la solution reste la même d'une générosité à l'autre",
    autre.solution.join("") === sauvegarde.solution.join("")
  );
}

/* -------------------- Générosité invalide : clamp silencieux -------------------- */

check(
  "clampGenerosite : 1..3 passent, tout le reste retombe sur 1 (le plus généreux)",
  clampGenerosite(1) === 1 &&
    clampGenerosite(2) === 2 &&
    clampGenerosite(3) === 3 &&
    clampGenerosite(0) === 1 &&
    clampGenerosite(42) === 1 &&
    clampGenerosite("2") === 1 &&
    clampGenerosite(null) === 1 &&
    clampGenerosite(Number.NaN) === 1
);
check(
  "generateSudoku : générosité hors échelle clampée à 1 dans le puzzle émis",
  generateSudoku(9, 42, 5).generosite === 1 &&
    generateSudoku(4, null, 5).generosite === 1
);

/* ----------------------- Budget temps (borne grossière) ----------------------- */

// Cible produit : ≤150 ms pour un 9×9 générosité 3 sur un poste de travail.
// Le golden borne à 1500 ms — marge ×10 pour absorber la variance CI.
{
  const t0 = performance.now();
  generateSudoku(9, 3, 987_654);
  const elapsed = performance.now() - t0;
  check(
    "budget : un 9×9 générosité 3 se génère sous 1500 ms (cible produit 150 ms)",
    elapsed < 1500,
    `${elapsed.toFixed(0)} ms`
  );
}

/* ------------------------------- Verdict ------------------------------- */

if (failures > 0) {
  console.error(`\n${failures} assertion(s) en échec.`);
  process.exit(1);
}
console.log("\nToutes les assertions sudoku passent.");
