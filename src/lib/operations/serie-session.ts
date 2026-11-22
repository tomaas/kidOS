/**
 * Session de série — le module PROFOND derrière la route /calcul.
 *
 * Toute la vie d'une série hors rendu vit ici : le pont de clé legacy
 * (`calcul:serie`), le cache de réglages appareil (`calcul:settings`), la
 * reprise-ou-fraîche avec purge sur désaccord, l'aller-retour d'empreinte
 * (palier, seed) → mêmes opérations, et les gestes d'écriture (crayon,
 * cellule, avancement). La route ne garde que le rendu et le câblage dnd.
 *
 * Le stockage passe par un PORT minuscule (SerieStorage) : window.localStorage
 * en prod (browserSerieStorage), une Map dans les goldens — et CHAQUE accès
 * est enveloppé ici : un stockage qui lève (mode privé, quota, SSR) dégrade
 * en silence, l'enfant ne voit jamais une erreur (invariant 2A).
 *
 * Pur au sens des goldens : aucune lecture d'env, de DB ni de DOM au chargement
 * du module (window n'est touché qu'à l'appel des méthodes de l'adaptateur).
 */

import { newSerieSeed } from "~/lib/operations/generator";
import { layoutOperation } from "~/lib/operations/layout";
import type { OperationLayout } from "~/lib/operations/layout";
import {
  FAMILLES,
  resolvePalierForFamille,
} from "~/lib/operations/progression";
import {
  bridgeLegacySerie,
  fingerprintOps,
  isResumableSerie,
  LEGACY_SERIE_STATE_KEY,
  normalizeFamilySettings,
  safeGenerateSerie,
  serieStorageKeyOf,
} from "~/lib/operations/settings";
import type {
  FamilySettings,
  SerieEntriesLike,
  SerieStateLike,
} from "~/lib/operations/settings";
import type { Operation, Palier } from "~/lib/operations/types";

/* ------------------------------ Port stockage ------------------------------ */

/** Le port de rangement : localStorage en prod, une Map dans les goldens. */
export interface SerieStorage {
  getItem: (key: string) => string | null;
  removeItem: (key: string) => void;
  setItem: (key: string, value: string) => void;
}

/**
 * L'adaptateur prod — window n'est touché qu'à l'appel (jamais à la création,
 * donc sûr à instancier au niveau module, y compris côté serveur). Toute
 * exception (mode privé, SSR) est avalée par les enveloppes ci-dessous.
 */
export function browserSerieStorage(): SerieStorage {
  return {
    getItem: (key) => window.localStorage.getItem(key),
    removeItem: (key) => {
      window.localStorage.removeItem(key);
    },
    setItem: (key, value) => {
      window.localStorage.setItem(key, value);
    },
  };
}

/** Clé du cache appareil des réglages (l'ex-clé orpheline de la route). */
export const SETTINGS_CACHE_KEY = "calcul:settings";

function readRaw(storage: SerieStorage, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    // Stockage indisponible — comme une clé absente.
    return null;
  }
}

// oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- T names the shape the caller expects from the stored JSON (an unchecked cast, as before).
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
    // Stockage indisponible (mode privé, quota…) — la session ne
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

/** La forme des réglages venus du serveur (MathSettings, sans l'importer). */
export interface SessionSettingsSource extends FamilySettings {
  authoritative?: boolean;
}

/**
 * Pont 2A/T4 : la série d'AVANT l'étagère (clé unique `calcul:serie`) est
 * re-rangée sous la clé de sa famille — jamais écrasante, et l'ancienne clé
 * ne disparaît qu'après RELECTURE de la clé cible (red-team RT1 : un write
 * avalé par un quota plein ne doit pas coûter la série ; on garde alors la
 * legacy pour un prochain passage). La chaîne brute est lue d'abord pour
 * pouvoir nettoyer une clé corrompue (adversarial #7 — readJson rend null
 * pour « absente » comme pour « illisible »).
 */
function migrateLegacySerie(storage: SerieStorage) {
  const legacyStr = readRaw(storage, LEGACY_SERIE_STATE_KEY);
  if (legacyStr === null) {
    return;
  }
  const legacy = bridgeLegacySerie(
    readJson<unknown>(storage, LEGACY_SERIE_STATE_KEY)
  );
  if (legacy) {
    const target = serieStorageKeyOf(legacy.famille);
    if (readJson<unknown>(storage, target) === null) {
      writeJson(storage, target, legacy.state);
    }
    if (readJson<unknown>(storage, target) === null) {
      // La cible n'a pas pu s'écrire : on garde la legacy pour un
      // prochain passage plutôt que de détruire la série.
      return;
    }
  }
  removeKey(storage, LEGACY_SERIE_STATE_KEY);
}

/**
 * Ouvre la session de l'atelier : pont de clé legacy (une seule fois), puis
 * réglages — DB quand elle répond (et mise en cache), sinon cache appareil,
 * sinon défauts — NORMALISÉS quelle que soit la source (un cache édité ou un
 * vieux format ne crashe jamais la page enfant).
 *
 * Le cache appareil ne mémorise que des réglages AUTHORITATIFS (adversarial
 * #3) : des défauts servis pendant la fenêtre pré-migration écraseraient les
 * vrais réglages mémorisés. La purge des clés orphelines des familles
 * désactivées (D-3A/F9) obéit à la même garde — des défauts (hors-ligne +
 * cache froid) ne sont pas une vérité sur les familles et ne doivent JAMAIS
 * coûter une série locale (red-team RT1 — « rien n'est jamais rangé dans le
 * dos de l'enfant »).
 */
export function loadSession(
  storage: SerieStorage,
  dbSettings: SessionSettingsSource | null
): FamilySettings {
  migrateLegacySerie(storage);
  const normalized = normalizeFamilySettings(
    dbSettings ?? readJson<unknown>(storage, SETTINGS_CACHE_KEY)
  );
  if (dbSettings?.authoritative) {
    writeJson(storage, SETTINGS_CACHE_KEY, normalized);
    for (const op of FAMILLES) {
      if (!normalized.familles.some((f) => f.op === op)) {
        removeKey(storage, serieStorageKeyOf(op));
      }
    }
  }
  return normalized;
}

/* --------------------------- Reprise & étagère --------------------------- */

/**
 * L'état « sorti » d'un plateau + reprise : lit la clé de la famille, valide
 * avec le prédicat complet (isResumableSerie, pur et golden-testé), PURGE
 * silencieusement une clé non reprenable (palier changé par le parent, cache
 * d'un autre format — l'éducatrice a réorganisé l'étagère, exception assumée
 * de la prémisse 4).
 */
export function readResumableSerie(
  storage: SerieStorage,
  famille: Operation,
  palierId: string,
  serieSize: number
): SerieStateLike | null {
  const key = serieStorageKeyOf(famille);
  const saved = readJson<SerieStateLike>(storage, key);
  if (saved === null) {
    return null;
  }
  if (isResumableSerie(saved, famille, palierId, serieSize)) {
    return saved;
  }
  removeKey(storage, key);
  return null;
}

/**
 * L'état « sorti » de chaque plateau de l'étagère — le prédicat complet
 * (reprise réelle), jamais « la clé existe » (design-review D-3A/F5).
 */
export function shelfTrays(
  storage: SerieStorage,
  settings: FamilySettings
): { op: Operation; sorti: boolean }[] {
  return settings.familles.map((f) => ({
    op: f.op,
    sorti:
      readResumableSerie(
        storage,
        f.op,
        resolvePalierForFamille(f.op, f.palier).id,
        settings.serieSize
      ) !== null,
  }));
}

function freshSerie(
  famille: Operation,
  palier: Palier,
  serieSize: number,
  seed: number
): SerieStateLike {
  const ops = safeGenerateSerie(palier, seed, serieSize);
  return {
    famille,
    // ops vide (palier cassé, cas théorique) : perOp vide → isSerieFinished
    // rend vrai et le rendu tombe sur l'état « rangé » — dégradation calme.
    index: 0,
    opsFingerprint: fingerprintOps(ops),
    palierId: palier.id,
    perOp: ops.map((op) => ({
      done: false,
      entries: emptyEntries(layoutOperation(op)),
    })),
    seed,
    serieSize,
  };
}

/**
 * Prendre un plateau : reprise exacte si la série est reprenable, sinon série
 * fraîche au palier parental de CETTE famille. Le seed naît à la PRISE du
 * plateau (T1 : plus de seed pré-engagé) ; il est injectable pour les goldens.
 */
export function takeTray(
  storage: SerieStorage,
  settings: FamilySettings,
  op: Operation,
  seed: number = newSerieSeed()
): SerieStateLike {
  const reglage = settings.familles.find((f) => f.op === op);
  const palier = resolvePalierForFamille(op, reglage?.palier);
  return (
    readResumableSerie(storage, op, palier.id, settings.serieSize) ??
    freshSerie(op, palier, settings.serieSize, seed)
  );
}

/** Persiste la série sous la clé de SA famille — chaque frappe est rangée. */
export function saveSerie(storage: SerieStorage, state: SerieStateLike) {
  writeJson(storage, serieStorageKeyOf(state.famille), state);
}

/** Range la clé d'une série finie (le moment « rangé », D-2A). */
export function clearSerie(storage: SerieStorage, famille: Operation) {
  removeKey(storage, serieStorageKeyOf(famille));
}

/* --------------------------- Gestes d'écriture --------------------------- */

/** Une case adressable de la grille (résultat ou retenue), colonne 0 à gauche. */
export type CellRef =
  | { row: "result"; col: number }
  | { row: "carry"; col: number };

/** The droppable payload crosses dnd-kit untyped — validate, never cast. */
export function isCellRef(value: unknown): value is CellRef {
  const cell = value as CellRef | null;
  return (
    typeof cell === "object" &&
    cell !== null &&
    (cell.row === "result" || cell.row === "carry") &&
    typeof cell.col === "number"
  );
}

/**
 * Pencil flow, shared by tap and drag: after a result digit, the pencil steps
 * to the next column leftwards; col 0 and carry cells keep the pencil put.
 */
export function pencilAdvance(cell: CellRef): CellRef {
  return cell.row === "result" && cell.col > 0
    ? { col: cell.col - 1, row: "result" }
    : cell;
}

/** La grille vide d'une opération, aux dimensions exactes de son layout. */
export function emptyEntries(layout: OperationLayout): SerieEntriesLike {
  return {
    carries: layout.carrySlots.map(() => null),
    result: layout.expectedDigits.map(() => null),
  };
}

/**
 * Écrit (ou efface, value null) une case de l'opération COURANTE. Tout est
 * borné et gardé : un drop tardif ou une écriture sur une opération figée
 * (done) rend l'état INCHANGÉ (même référence — React ne re-rend pas), jamais
 * une réponse gelée encrée ni un débordement.
 */
export function writeCell(
  state: SerieStateLike,
  cell: CellRef,
  value: string | null
): SerieStateLike {
  const op = state.perOp[state.index];
  if (!op || op.done) {
    return state;
  }
  const rowKey = cell.row === "result" ? "result" : "carries";
  if (cell.col < 0 || cell.col >= op.entries[rowKey].length) {
    return state;
  }
  const entries: SerieEntriesLike = {
    carries: [...op.entries.carries],
    result: [...op.entries.result],
  };
  entries[rowKey][cell.col] = value;
  const perOp = state.perOp.map((o, i) =>
    i === state.index ? { ...o, entries } : o
  );
  return { ...state, perOp };
}

/** « J'ai fini, je compare » : fige l'opération courante (done). */
export function finishCurrent(state: SerieStateLike): SerieStateLike {
  const perOp = state.perOp.map((op, i) =>
    i === state.index ? { ...op, done: true } : op
  );
  return { ...state, perOp };
}

/** « Plateau suivant » : avance d'une opération dans la série. */
export function advanceSerie(state: SerieStateLike): SerieStateLike {
  return { ...state, index: state.index + 1 };
}

/**
 * Fin de série : l'index a dépassé la taille, ou série VIDE (palier cassé,
 * cas théorique) — même chemin calme vers le moment « rangé », jamais un
 * écran bloqué.
 */
export function isSerieFinished(state: SerieStateLike): boolean {
  return state.index >= state.serieSize || state.perOp.length === 0;
}
