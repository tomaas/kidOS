/**
 * Réglages par famille d'opération — le cœur PUR de l'étagère de plateaux.
 *
 * La table math_skills porte une ligne par famille ACTIVÉE, keyée
 * `calcul-pose:<famille>` (décision eng-review 1B) : présence de ligne =
 * activée, absence = la famille n'existe pas à l'écran (prémisse 3 — jamais
 * de plateau grisé). Ce module transforme ces lignes en réglages sûrs, quelle
 * que soit la saleté de la source (ligne éditée à la main, cache localStorage
 * corrompu, palier d'une autre famille) — jamais d'erreur sur donnée sale,
 * comme resolvePalier avant lui.
 *
 * Pur : aucune lecture d'env, de DB ou de DOM (condition des golden tests).
 */

import { generateSerie } from "~/lib/operations/generator";
import {
  clampSerieSize,
  DEFAULT_SERIE_SIZE,
  FAMILLES,
  familleOfPalier,
  paliersByFamille,
  resolvePalierForFamille,
} from "~/lib/operations/progression";
import type {
  GeneratedOperation,
  Operation,
  Palier,
} from "~/lib/operations/types";

/**
 * Noms français des familles — depuis la phase 2 multilangue, l'affichage
 * passe par le catalogue i18n (m.calcul.familles : l'étagère dans l'aria, la
 * page parent capitalisée) ; CE mapping reste la RÉFÉRENCE française du
 * module pur, et test:i18n épingle le catalogue fr byte-identique à lui —
 * une nouvelle famille ne peut pas silencieusement manquer son libellé.
 */
export const FAMILLE_NOMS: Record<Operation, string> = {
  addition: "additions",
  multiplication: "multiplications",
  soustraction: "soustractions",
};

/** Préfixe des clés de la table math_skills (une ligne par famille). */
export const SKILL_KEY_PREFIX = "calcul-pose:";

export function skillKeyOf(op: Operation): string {
  return `${SKILL_KEY_PREFIX}${op}`;
}

export interface FamilleSetting {
  op: Operation;
  /** Toujours un palier DE cette famille (réparé sinon). */
  palier: string;
}

/**
 * Réglages effectifs de la mini-app : la taille de série reste GLOBALE
 * (recopiée à l'identique sur chaque ligne à la sauvegarde, lue sur la
 * première ligne par ordre canonique des familles) ; `familles` liste les
 * familles activées, dans l'ordre canonique — jamais vide.
 */
export interface FamilySettings {
  familles: FamilleSetting[];
  serieSize: number;
}

/** La forme minimale d'une ligne math_skills dont ce module a besoin. */
export interface MathSkillRowLike {
  palier: string;
  serieSize: number;
  skill: string;
}

/** Table vide (install neuve) → « addition, premier palier, activée ». */
export function defaultFamilySettings(): FamilySettings {
  return {
    familles: [{ op: "addition", palier: paliersByFamille("addition")[0].id }],
    serieSize: DEFAULT_SERIE_SIZE,
  };
}

/**
 * Lignes DB → réglages. Porte TOUS les cas de bord tranchés en review :
 * table vide → défaut addition ; présence = activée ; palier réparé au sein
 * de sa famille ; serieSize lue sur la PREMIÈRE ligne par ordre canonique,
 * clampée ; ligne au skill inconnu (legacy pas migrée, clé exotique) ignorée.
 */
export function settingsFromRows(
  rows: readonly MathSkillRowLike[]
): FamilySettings {
  const familles: FamilleSetting[] = [];
  let serieSize: number | null = null;
  for (const op of FAMILLES) {
    const row = rows.find((r) => r.skill === skillKeyOf(op));
    if (!row) {
      continue;
    }
    familles.push({ op, palier: resolvePalierForFamille(op, row.palier).id });
    if (serieSize === null) {
      serieSize = clampSerieSize(row.serieSize);
    }
  }
  if (familles.length === 0) {
    return defaultFamilySettings();
  }
  return { familles, serieSize: serieSize ?? DEFAULT_SERIE_SIZE };
}

function isOperation(value: unknown): value is Operation {
  return (FAMILLES as readonly unknown[]).includes(value);
}

/**
 * Shape-guard du cache appareil (`calcul:settings`) : un cache d'un ancien
 * format, tronqué ou édité doit produire des réglages sûrs, jamais un crash
 * sur la page enfant. Chaque famille est dédupliquée, réordonnée dans l'ordre
 * canonique et son palier réparé ; une valeur méconnaissable → défauts.
 */
export function normalizeFamilySettings(value: unknown): FamilySettings {
  const raw = value as
    | { serieSize?: unknown; familles?: unknown }
    | null
    | undefined;
  const rawFamilles = Array.isArray(raw?.familles) ? raw.familles : [];
  const familles: FamilleSetting[] = [];
  for (const op of FAMILLES) {
    const entry = rawFamilles.find(
      (f: unknown) =>
        typeof f === "object" && f !== null && (f as { op?: unknown }).op === op
    ) as { palier?: unknown } | undefined;
    if (!entry) {
      continue;
    }
    const palier = typeof entry.palier === "string" ? entry.palier : undefined;
    familles.push({ op, palier: resolvePalierForFamille(op, palier).id });
  }
  if (familles.length === 0) {
    // Un cache d'un ANCIEN format ({palier, serieSize}) n'a pas de familles
    // reconnaissables mais sa taille de série reste valable (red-team RT4) —
    // la série de l'enfant ne rétrécit pas en silence à la mise à jour.
    return {
      ...defaultFamilySettings(),
      serieSize: clampSerieSize(raw?.serieSize),
    };
  }
  return { familles, serieSize: clampSerieSize(raw?.serieSize) };
}

/** Clé localStorage de la série en cours d'une famille (une par plateau). */
export function serieStorageKeyOf(op: Operation): string {
  return `calcul:serie:${op}`;
}

/** L'ancienne clé unique, d'avant l'étagère — lue une fois par le pont. */
export const LEGACY_SERIE_STATE_KEY = "calcul:serie";

/**
 * Pont de clé legacy (décisions 2A + T4) — cœur pur du test de régression
 * CRITIQUE : une série sauvegardée AVANT l'étagère (clé `calcul:serie`, sans
 * champ famille) est enrichie et re-rangée sous la clé de sa famille, dérivée
 * de son palierId. Le pont ne valide PAS la série (c'est le travail du
 * shape-guard normal derrière) : il déplace et enrichit, rien d'autre —
 * il refuse seulement ce qui n'a même pas la forme d'un état de série.
 */
export function bridgeLegacySerie(
  saved: unknown
): { famille: Operation; state: Record<string, unknown> } | null {
  if (typeof saved !== "object" || saved === null) {
    return null;
  }
  const state = saved as Record<string, unknown>;
  if (typeof state.palierId !== "string" || !Array.isArray(state.perOp)) {
    return null;
  }
  const famille = isOperation(state.famille)
    ? state.famille
    : familleOfPalier(state.palierId);
  return { famille, state: { ...state, famille } };
}

/* ------------------------- Série : état & reprise ------------------------- */

/** La grille écrite d'une opération — LE type d'entrées, lib ET UI. */
export interface SerieEntriesLike {
  carries: (string | null)[];
  result: (string | null)[];
}

/**
 * L'état persisté d'une série (clé serieStorageKeyOf). `opsFingerprint` :
 * empreinte des opérations générées à la création — à la reprise, la
 * régénération depuis (palier, seed) doit produire la MÊME empreinte, sinon
 * les chiffres écrits appartiendraient à d'autres calculs (corruption
 * silencieuse) et on repart sur une série fraîche.
 */
export interface SerieStateLike {
  famille: Operation;
  index: number;
  opsFingerprint: string;
  palierId: string;
  perOp: { entries: SerieEntriesLike; done: boolean }[];
  seed: number;
  serieSize: number;
}

export function fingerprintOps(ops: readonly GeneratedOperation[]): string {
  return ops.map((o) => `${o.op}:${o.a}:${o.b}`).join("|");
}

/**
 * Génération contenue : une contrainte de palier devenue insatisfaisable
 * (erreur de code future) ne doit JAMAIS montrer un écran d'erreur à
 * l'enfant — on retombe sur le premier palier d'addition, puis sur rien
 * (l'atelier rangé) si même lui échoue.
 */
export function safeGenerateSerie(
  palier: Palier,
  seed: number,
  size: number
): GeneratedOperation[] {
  try {
    return generateSerie(palier.constraints, seed, size);
  } catch {
    try {
      return generateSerie(
        resolvePalierForFamille("addition", null).constraints,
        seed,
        size
      );
    } catch {
      return [];
    }
  }
}

/**
 * Shape guard de la série reprise : un cache corrompu, d'un ancien format,
 * d'une autre famille ou d'une série FINIE retombe sur « pas reprenable »,
 * jamais sur un crash. L'état « sorti » d'un plateau utilise CE prédicat
 * complet (design-review D-3A/F5) — jamais « la clé existe » — pour qu'un
 * plateau sorti reprenne toujours pour de vrai.
 */
export function isResumableSerie(
  saved: SerieStateLike | null,
  famille: Operation,
  palierId: string,
  serieSize: number
): saved is SerieStateLike {
  return (
    saved !== null &&
    saved.famille === famille &&
    saved.palierId === palierId &&
    saved.serieSize === serieSize &&
    typeof saved.seed === "number" &&
    typeof saved.index === "number" &&
    saved.index >= 0 &&
    saved.index < saved.serieSize &&
    Array.isArray(saved.perOp) &&
    saved.perOp.length === saved.serieSize &&
    typeof saved.opsFingerprint === "string" &&
    saved.perOp.every(
      (op) =>
        typeof op?.done === "boolean" &&
        Array.isArray(op?.entries?.result) &&
        op.entries.result.every((v) => v === null || typeof v === "string") &&
        Array.isArray(op?.entries?.carries) &&
        op.entries.carries.every((v) => v === null || typeof v === "string")
    ) &&
    // La régénération doit reproduire exactement les opérations d'origine —
    // sinon les chiffres écrits appartiennent à d'autres calculs.
    fingerprintOps(
      safeGenerateSerie(
        resolvePalierForFamille(famille, saved.palierId),
        saved.seed,
        saved.serieSize
      )
    ) === saved.opsFingerprint
  );
}
