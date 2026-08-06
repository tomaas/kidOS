/**
 * Échelle de générosité — purement DESCRIPTIVE, comme les paliers du calcul
 * posé (progression.ts côté operations). Aucune évaluation de l'enfant ne
 * vit ici : la générosité est un choix du parent, et la difficulté qu'elle
 * décrit est garantie PAR CONSTRUCTION du générateur (techniques bornées),
 * jamais mesurée sur l'enfant.
 *
 * Générosité 1 = le plus de givens + singletons nus seulement ;
 * générosité 3 = le moins de givens + candidats bloqués autorisés.
 */

import type { Generosite, Taille, TechniqueTier } from "~/lib/sudoku/types";

export const TAILLES: readonly Taille[] = [4, 6, 9];

export const GENEROSITES: readonly Generosite[] = [1, 2, 3];

/** La valeur par défaut est la plus généreuse — jamais l'inverse. */
export const DEFAULT_GENEROSITE: Generosite = 1;

/**
 * Générosité sûre, quelle que soit la source (ligne DB éditée à la main,
 * cache) : toute valeur invalide retombe sur 1, la plus généreuse — une
 * valeur corrompue ne durcit jamais la grille dans le dos du parent.
 */
export function clampGenerosite(value: unknown): Generosite {
  if (value === 1 || value === 2 || value === 3) {
    return value;
  }
  return DEFAULT_GENEROSITE;
}

/**
 * Palier de techniques autorisé par générosité (KTD2) : la borne du solveur
 * pendant le creusement — chaque grille émise se termine sans deviner.
 */
export const TIER_BY_GENEROSITE: Record<Generosite, TechniqueTier> = {
  1: 1,
  2: 2,
  3: 3,
};

/**
 * Bornes du nombre de givens par (taille, générosité). `cible` est l'objectif
 * du creusement (le générateur s'arrête d'enlever des cases en l'atteignant) ;
 * `max` absorbe les grilles où la borne de techniques bloque le creusement
 * plus tôt (épuisement de budget = grille plus généreuse, jamais une erreur).
 * Les cibles décroissent avec la générosité : générosité 1 = le plus rempli.
 */
export const GIVENS_RANGES: Record<
  Taille,
  Record<Generosite, { cible: number; max: number }>
> = {
  4: {
    1: { cible: 9, max: 13 },
    2: { cible: 7, max: 11 },
    3: { cible: 5, max: 10 },
  },
  6: {
    1: { cible: 20, max: 28 },
    2: { cible: 16, max: 24 },
    3: { cible: 13, max: 22 },
  },
  9: {
    1: { cible: 42, max: 62 },
    2: { cible: 34, max: 54 },
    3: { cible: 28, max: 48 },
  },
};
