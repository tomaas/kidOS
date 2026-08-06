export {
  buildSolvedGrid,
  fingerprintGivens,
  generateSudoku,
  newSudokuSeed,
} from "~/lib/sudoku/generator";
export {
  clampGenerosite,
  DEFAULT_GENEROSITE,
  GENEROSITES,
  GIVENS_RANGES,
  TAILLES,
  TIER_BY_GENEROSITE,
} from "~/lib/sudoku/progression";
export {
  eraseCell,
  isGrilleComplete,
  loadSession,
  putAway,
  readResumableGrille,
  saveGrille,
  shelfTrays,
  takeTray,
  writeCell,
} from "~/lib/sudoku/session";
export {
  DEFAULT_SETTING_GENEROSITE,
  defaultSudokuSettings,
  type GrilleStateLike,
  grilleStorageKeyOf,
  isGivenCell,
  isResumableGrille,
  normalizeSudokuSettings,
  SUDOKU_SETTINGS_CACHE_KEY,
  SUDOKU_SKILL_KEY_PREFIX,
  type SudokuSettings,
  type SudokuSkillRowLike,
  settingsFromRows,
  sudokuSkillKeyOf,
  type TailleSetting,
} from "~/lib/sudoku/settings";
export { countSolutions, solveWithTier } from "~/lib/sudoku/solver";
export type {
  Generosite,
  Grille,
  Puzzle,
  Taille,
  TechniqueTier,
} from "~/lib/sudoku/types";
export { REGIONS, regionIndex } from "~/lib/sudoku/types";
