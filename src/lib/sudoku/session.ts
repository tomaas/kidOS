/**
 * Session de grille — le module PROFOND derrière la route /sudoku (miroir
 * fonction-pour-fonction de ~/lib/operations/serie-session.ts).
 *
 * Toute la vie d'une grille hors rendu vit ici : le cache de réglages
 * appareil (`sudoku:settings`), la reprise-ou-fraîche avec purge sur
 * désaccord d'empreinte, et les gestes d'écriture (chiffre, gomme). La route
 * ne gardera que le rendu et le câblage.
 *
 * Le stockage passe par le MÊME port que le calcul posé (SerieStorage,
 * réutilisé de ~/lib/operations — jamais redéfini) : window.localStorage en
 * prod (browserSerieStorage), une Map dans les goldens — et CHAQUE accès est
 * enveloppé ici : un stockage qui lève (mode privé, quota, SSR) dégrade en
 * silence, l'enfant ne voit jamais une erreur.
 *
 * OMISSION DÉLIBÉRÉE : pas de pont de clé legacy — aucune clé sudoku
 * n'existe avant cette mini-app (contrairement au `calcul:serie` d'avant
 * l'étagère), il n'y a rien à migrer.
 *
 * Pur au sens des goldens : aucune lecture d'env, de DB ni de DOM au
 * chargement du module.
 */

import type { SerieStorage } from "~/lib/operations";
import { generateSudoku, newSudokuSeed } from "~/lib/sudoku/generator";
import {
  DEFAULT_SETTING_GENEROSITE,
  type GrilleStateLike,
  grilleStorageKeyOf,
  isGivenCell,
  isResumableGrille,
  normalizeSudokuSettings,
  SUDOKU_SETTINGS_CACHE_KEY,
  type SudokuSettings,
} from "~/lib/sudoku/settings";
import type { Generosite, Taille } from "~/lib/sudoku/types";

/* ---------------------- Enveloppes de stockage calmes ---------------------- */

function readRaw(storage: SerieStorage, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    // Stockage indisponible — comme une clé absente.
    return null;
  }
}

function readJson<T>(storage: SerieStorage, key: string): T | null {
  try {
    const raw = storage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    // Illisible ou indisponible — comme une clé absente.
    return null;
  }
}

function writeJson(storage: SerieStorage, key: string, value: unknown) {
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    // Stockage indisponible (mode privé, quota…) — la grille ne
    // reprendra simplement pas, jamais une erreur devant l'enfant.
  }
}

function removeKey(storage: SerieStorage, key: string) {
  try {
    storage.removeItem(key);
  } catch {
    // Stockage indisponible — la clé fantôme est illisible de toute façon.
  }
}

/* ------------------------- Ouverture de la session ------------------------- */

/**
 * Ouvre la session de l'atelier : réglages — DB quand elle répond (et mise
 * en cache), sinon cache appareil, sinon défauts — NORMALISÉS quelle que
 * soit la source. Le cache appareil ne mémorise que des réglages
 * AUTHORITATIFS, et la purge des grilles orphelines des tailles désactivées
 * (AE2) obéit à la même garde (KTD8) : des défauts ne sont pas une vérité
 * sur les tailles et ne coûtent JAMAIS une grille locale. Le drapeau
 * `authoritative` vient de settingsFromRows (déviation KTD8 — calculé dans
 * la normalisation pure, pas dans la server function).
 */
export function loadSession(
  storage: SerieStorage,
  dbSettings: SudokuSettings | null
): SudokuSettings {
  const normalized = normalizeSudokuSettings(
    dbSettings ?? readJson<unknown>(storage, SUDOKU_SETTINGS_CACHE_KEY)
  );
  const settings: SudokuSettings = {
    ...normalized,
    // Seule la DB (via settingsFromRows) peut être authoritative — jamais
    // le cache appareil relu (normalizeSudokuSettings force false).
    authoritative: dbSettings?.authoritative === true,
  };
  if (settings.authoritative) {
    writeJson(storage, SUDOKU_SETTINGS_CACHE_KEY, normalized);
    for (const t of settings.tailles) {
      if (!t.active) {
        removeKey(storage, grilleStorageKeyOf(t.taille));
      }
    }
  }
  return settings;
}

/* --------------------------- Reprise & étagère --------------------------- */

/**
 * L'état « sorti » d'un plateau + reprise : lit la clé de la taille, valide
 * avec le prédicat complet (isResumableGrille — structure ET aller-retour
 * d'empreinte à la générosité SAUVEGARDÉE, jamais le réglage courant : AE5),
 * PURGE silencieusement une clé non reprenable.
 */
export function readResumableGrille(
  storage: SerieStorage,
  taille: Taille
): GrilleStateLike | null {
  const key = grilleStorageKeyOf(taille);
  // La chaîne brute d'abord : une clé au JSON illisible doit être RANGÉE
  // (readJson rend null pour « absente » comme pour « corrompue »).
  if (readRaw(storage, key) === null) {
    return null;
  }
  const saved = readJson<unknown>(storage, key);
  if (saved !== null && isResumableGrille(saved) && saved.taille === taille) {
    return saved;
  }
  removeKey(storage, key);
  return null;
}

/**
 * L'état « sorti » de chaque plateau de l'étagère — tailles ACTIVES
 * seulement (une taille désactivée n'existe pas à l'écran, jamais de
 * plateau grisé), prédicat complet de reprise, jamais « la clé existe ».
 */
export function shelfTrays(
  storage: SerieStorage,
  settings: SudokuSettings
): { sorti: boolean; taille: Taille }[] {
  return settings.tailles
    .filter((t) => t.active)
    .map((t) => ({
      sorti: readResumableGrille(storage, t.taille) !== null,
      taille: t.taille,
    }));
}

function generositeFor(settings: SudokuSettings, taille: Taille): Generosite {
  const entry = settings.tailles.find((t) => t.taille === taille);
  return entry?.generosite ?? DEFAULT_SETTING_GENEROSITE;
}

function freshGrille(
  taille: Taille,
  generosite: Generosite,
  seed: number
): GrilleStateLike {
  const puzzle = generateSudoku(taille, generosite, seed);
  return {
    entries: puzzle.givens.map(() => null),
    fingerprint: puzzle.fingerprint,
    generosite: puzzle.generosite,
    seed,
    taille,
  };
}

/**
 * Prendre un plateau : reprise exacte si la grille est reprenable — à SA
 * générosité sauvegardée (AE5 : une baisse de générosité ne détruit jamais
 * le travail en cours) — sinon grille fraîche à la générosité COURANTE du
 * réglage parental. Le seed naît à la PRISE du plateau ; il est injectable
 * pour les goldens.
 */
export function takeTray(
  storage: SerieStorage,
  settings: SudokuSettings,
  taille: Taille,
  seed: number = newSudokuSeed()
): GrilleStateLike {
  // KTD3 : la grille reprise garde SA générosité sauvegardée — le réglage
  // courant ne s'applique qu'à une grille fraîche (AE5 : un changement de
  // générosité ne détruit jamais le travail ; seule la désactivation d'une
  // taille purge, côté loadSession).
  return (
    readResumableGrille(storage, taille) ??
    freshGrille(taille, generositeFor(settings, taille), seed)
  );
}

/** Persiste la grille sous la clé de SA taille — chaque chiffre est rangé. */
export function saveGrille(storage: SerieStorage, state: GrilleStateLike) {
  writeJson(storage, grilleStorageKeyOf(state.taille), state);
}

/** Ranger la grille (le geste de l'enfant, jamais automatique) — R16/KTD4. */
export function putAway(storage: SerieStorage, taille: Taille) {
  removeKey(storage, grilleStorageKeyOf(taille));
}

/* --------------------------- Gestes d'écriture --------------------------- */

/**
 * Écrit un chiffre dans une case. Tout est borné et gardé : une case DONNÉE,
 * un index hors grille ou un chiffre hors 1..N rendent l'état INCHANGÉ
 * (même référence — React ne re-rend pas). Les écritures restent légales
 * quand la grille est complète (KTD4 : pas d'état figé).
 */
export function writeCell(
  state: GrilleStateLike,
  index: number,
  digit: number
): GrilleStateLike {
  if (
    index < 0 ||
    index >= state.entries.length ||
    isGivenCell(state, index) ||
    !Number.isInteger(digit) ||
    digit < 1 ||
    digit > state.taille
  ) {
    return state;
  }
  const entries = [...state.entries];
  entries[index] = digit;
  return { ...state, entries };
}

/** La gomme : efface une case écrite ; une case donnée reste intouchable. */
export function eraseCell(
  state: GrilleStateLike,
  index: number
): GrilleStateLike {
  if (
    index < 0 ||
    index >= state.entries.length ||
    isGivenCell(state, index) ||
    state.entries[index] === null
  ) {
    return state;
  }
  const entries = [...state.entries];
  entries[index] = null;
  return { ...state, entries };
}

/**
 * Grille complète = chaque case à compléter porte un chiffre. Purement
 * descriptif (le moment où le rangement peut être proposé) — la
 * comparaison avec la solution est le geste calme de l'enfant côté rendu,
 * jamais une évaluation ici.
 */
export function isGrilleComplete(state: GrilleStateLike): boolean {
  return state.entries.every((v, i) => v !== null || isGivenCell(state, i));
}
