/**
 * Réglages par taille de grille — le cœur PUR de l'étagère de sudokus.
 *
 * La table (`sudoku:<taille>` dans math_skills-like rows) porte une ligne par
 * taille ACTIVÉE : présence de ligne = activée, absence = la taille n'existe
 * pas à l'écran (jamais de plateau grisé, même prémisse que le calcul posé).
 * Ce module transforme ces lignes en réglages sûrs, quelle que soit la saleté
 * de la source — jamais d'erreur sur donnée sale.
 *
 * DÉVIATION DÉLIBÉRÉE du modèle calcul (KTD8, mandatée par le plan) : le
 * drapeau `authoritative` (« au moins une ligne reconnue ») est calculé ICI,
 * dans la normalisation pure — settingsFromRows le porte sur l'objet de
 * réglages — là où côté calcul c'est la server function qui l'ajoute après
 * coup. La purge des grilles des tailles désactivées n'obéit qu'à ce drapeau :
 * des défauts (install neuve, hors-ligne) ne sont pas une vérité sur les
 * tailles et ne coûtent jamais une grille locale.
 *
 * Pur : aucune lecture d'env, de DB ou de DOM (condition des golden tests).
 */

import { fingerprintGivens, generateSudoku } from "~/lib/sudoku/generator";
import {
  clampGenerosite,
  GENEROSITES,
  TAILLES,
} from "~/lib/sudoku/progression";
import type { Generosite, Taille } from "~/lib/sudoku/types";

/* --------------------------------- Clés --------------------------------- */

/** Préfixe des clés de lignes DB (une ligne par taille activée) — pour U3. */
export const SUDOKU_SKILL_KEY_PREFIX = "sudoku:";

export function sudokuSkillKeyOf(taille: Taille): string {
  return `${SUDOKU_SKILL_KEY_PREFIX}${taille}`;
}

/** Clé du cache appareil des réglages (miroir de `calcul:settings`). */
export const SUDOKU_SETTINGS_CACHE_KEY = "sudoku:settings";

/** Clé localStorage de la grille en cours d'une taille (une par plateau). */
export function grilleStorageKeyOf(taille: Taille): string {
  return `sudoku:grille:${taille}`;
}

/* -------------------------------- Réglages -------------------------------- */

export interface TailleSetting {
  active: boolean;
  /** Toujours une générosité valide (clampée sinon). */
  generosite: Generosite;
  taille: Taille;
}

/**
 * Réglages effectifs de la mini-app : une entrée par taille, dans l'ordre
 * canonique (TAILLES), TOUJOURS les trois présentes — `active` dit si le
 * plateau existe à l'écran. `authoritative` = la source portait au moins une
 * ligne reconnue (voir la déviation KTD8 en tête de fichier).
 */
export interface SudokuSettings {
  authoritative: boolean;
  tailles: TailleSetting[];
}

/** La forme minimale d'une ligne DB dont ce module a besoin. */
export interface SudokuSkillRowLike {
  generosite: number;
  skill: string;
}

/**
 * Générosité d'une taille sans ligne : celle des défauts d'install neuve
 * (« étape 2 ») — activer une taille sans ligne se comporte comme le défaut.
 */
export const DEFAULT_SETTING_GENEROSITE: Generosite = 2;

/**
 * Install neuve (aucune ligne reconnue) : 4×4 et 6×6 activées à l'étape 2,
 * 9×9 rangée — et JAMAIS authoritative (des défauts ne purgent rien).
 */
export function defaultSudokuSettings(): SudokuSettings {
  return {
    authoritative: false,
    tailles: TAILLES.map((taille) => ({
      active: taille !== 9,
      generosite: DEFAULT_SETTING_GENEROSITE,
      taille,
    })),
  };
}

/**
 * Lignes DB → réglages. Présence = activée ; générosité clampée ; clé de
 * skill inconnue ignorée ; lignes dupliquées → la PREMIÈRE reconnue gagne
 * (même idiome `rows.find` que le calcul posé, épinglé au golden). Aucune
 * ligne reconnue → défauts, authoritative:false.
 */
export function settingsFromRows(
  rows: readonly SudokuSkillRowLike[]
): SudokuSettings {
  const tailles: TailleSetting[] = [];
  let recognized = false;
  for (const taille of TAILLES) {
    const row = rows.find((r) => r.skill === sudokuSkillKeyOf(taille));
    if (row) {
      recognized = true;
    }
    tailles.push({
      active: row !== undefined,
      generosite: row
        ? clampGenerosite(row.generosite)
        : DEFAULT_SETTING_GENEROSITE,
      taille,
    });
  }
  if (!recognized) {
    return defaultSudokuSettings();
  }
  return { authoritative: true, tailles };
}

function isTaille(value: unknown): value is Taille {
  return (TAILLES as readonly unknown[]).includes(value);
}

function isGenerosite(value: unknown): value is Generosite {
  return (GENEROSITES as readonly unknown[]).includes(value);
}

/**
 * Shape-guard du cache appareil (`sudoku:settings`) : un cache d'un ancien
 * format, tronqué ou édité produit des réglages sûrs, jamais un crash. Le
 * résultat n'est JAMAIS authoritative — un cache n'est pas la DB (KTD8), il
 * ne peut pas autoriser une purge.
 */
export function normalizeSudokuSettings(value: unknown): SudokuSettings {
  const raw = value as { tailles?: unknown } | null | undefined;
  const rawTailles = Array.isArray(raw?.tailles) ? raw.tailles : [];
  const tailles: TailleSetting[] = [];
  let recognized = false;
  for (const taille of TAILLES) {
    const entry = rawTailles.find(
      (t: unknown) =>
        typeof t === "object" &&
        t !== null &&
        (t as { taille?: unknown }).taille === taille
    ) as { active?: unknown; generosite?: unknown } | undefined;
    if (entry) {
      recognized = true;
    }
    tailles.push({
      active: entry ? entry.active === true : taille !== 9,
      generosite: entry
        ? clampGenerosite(entry.generosite)
        : DEFAULT_SETTING_GENEROSITE,
      taille,
    });
  }
  if (!recognized) {
    return defaultSudokuSettings();
  }
  return { authoritative: false, tailles };
}

/* ------------------------- Grille : état & reprise ------------------------- */

/**
 * L'état persisté d'une grille (clé grilleStorageKeyOf) — KTD3. `entries` :
 * les chiffres de l'enfant, plein-format (taille² cases, null = vide ; les
 * cases données restent null, la grille regénérée porte leurs chiffres).
 * `fingerprint` : les givens joints rangée par rangée à la création — à la
 * reprise, régénérer depuis (taille, generosite, seed) — la générosité
 * SAUVEGARDÉE, jamais le réglage courant (AE5) — doit reproduire la MÊME
 * empreinte, sinon les chiffres écrits appartiendraient à une autre grille.
 */
export interface GrilleStateLike {
  entries: (number | null)[];
  fingerprint: string;
  generosite: Generosite;
  seed: number;
  taille: Taille;
}

/** Une case donnée (pré-remplie) se lit dans l'empreinte — "0" = à compléter. */
export function isGivenCell(state: GrilleStateLike, index: number): boolean {
  return (
    index < state.fingerprint.length && state.fingerprint.charAt(index) !== "0"
  );
}

/**
 * Shape guard de la grille reprise : un cache corrompu, édité à la main ou
 * d'un autre format retombe sur « pas reprenable », jamais un crash. L'état
 * « sorti » d'un plateau utilise CE prédicat complet — jamais « la clé
 * existe ». Une grille COMPLÈTE reste reprenable (KTD4 : pas d'état figé —
 * le rangement est un geste de l'enfant, jamais une purge automatique).
 */
export function isResumableGrille(value: unknown): value is GrilleStateLike {
  const saved = value as GrilleStateLike | null;
  return (
    typeof saved === "object" &&
    saved !== null &&
    isTaille(saved.taille) &&
    isGenerosite(saved.generosite) &&
    typeof saved.seed === "number" &&
    typeof saved.fingerprint === "string" &&
    Array.isArray(saved.entries) &&
    saved.entries.length === saved.taille * saved.taille &&
    saved.entries.every(
      (v) =>
        v === null ||
        (typeof v === "number" &&
          Number.isInteger(v) &&
          v >= 1 &&
          v <= saved.taille)
    ) &&
    // La régénération — à la générosité SAUVEGARDÉE (AE5) — doit reproduire
    // exactement les givens d'origine, sinon les chiffres écrits
    // appartiennent à une autre grille (corruption silencieuse).
    fingerprintGivens(
      generateSudoku(saved.taille, saved.generosite, saved.seed).givens
    ) === saved.fingerprint
  );
}
