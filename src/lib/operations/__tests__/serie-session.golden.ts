/**
 * SERIE-SESSION assertion script — la vie de la série hors rendu.
 *
 * Pins the serie-session module (the deep module behind the /calcul route):
 * legacy bridge, authoritative purge, resume-or-fresh (incl. purge on
 * mismatch), fingerprint round-trip, silent storage-failure degradation and
 * the writing verbs. Same standalone-runnable pattern as operations.golden.ts:
 *   bun run src/lib/operations/__tests__/serie-session.golden.ts
 * (chained into `bun run test:operations`). Exits non-zero on any failure.
 *
 * Le stockage passe par le port SerieStorage : une Map ici (adaptateur
 * mémoire), window.localStorage en prod — la MÊME logique tourne des deux
 * côtés, c'est tout l'intérêt de la couture.
 */

import {
  advanceSerie,
  browserSerieStorage,
  clearSerie,
  DEFAULT_SERIE_SIZE,
  defaultFamilySettings,
  emptyEntries,
  fingerprintOps,
  finishCurrent,
  isCellRef,
  isSerieFinished,
  LEGACY_SERIE_STATE_KEY,
  layoutOperation,
  loadSession,
  pencilAdvance,
  readResumableSerie,
  resolvePalierForFamille,
  SETTINGS_CACHE_KEY,
  safeGenerateSerie,
  saveSerie,
  serieStorageKeyOf,
  shelfTrays,
  takeTray,
  writeCell,
} from "~/lib/operations";
import type {
  CellRef,
  FamilySettings,
  SerieStateLike,
  SerieStorage,
} from "~/lib/operations";

let failures = 0;
function check(name: string, ok: boolean, detail?: string) {
  if (ok) {
    console.log(`✓ ${name}`);
  } else {
    failures += 1;
    console.error(`✗ ${name}${detail ? `\n  ${detail}` : ""}`);
  }
}

/* ------------------------------- Adaptateurs ------------------------------- */

/** Adaptateur mémoire des goldens — la Map est inspectable directement. */
function memoryStorage(initial?: Record<string, string>): {
  map: Map<string, string>;
  storage: SerieStorage;
} {
  const map = new Map(Object.entries(initial ?? {}));
  return {
    map,
    storage: {
      getItem: (key) => map.get(key) ?? null,
      removeItem: (key) => {
        map.delete(key);
      },
      setItem: (key, value) => {
        map.set(key, value);
      },
    },
  };
}

/** Un stockage qui lève sur TOUT (mode privé le plus hostile). */
function brokenStorage(): SerieStorage {
  const boom = () => {
    throw new Error("storage indisponible");
  };
  return { getItem: boom, removeItem: boom, setItem: boom };
}

/** Un stockage plein : lecture OK, écriture/suppression refusées (quota). */
function fullStorage(initial?: Record<string, string>): {
  map: Map<string, string>;
  storage: SerieStorage;
} {
  const { map } = memoryStorage(initial);
  const boom = () => {
    throw new Error("quota dépassé");
  };
  return {
    map,
    storage: {
      getItem: (key) => map.get(key) ?? null,
      removeItem: boom,
      setItem: boom,
    },
  };
}

/* --------------------------- États de référence --------------------------- */

const palierAdd = resolvePalierForFamille("addition", null); // premier palier
const opsAdd = safeGenerateSerie(palierAdd, 42, 3);
/** Une série valide au format d'AVANT l'étagère (sans champ famille). */
const legacyState = {
  index: 1,
  opsFingerprint: fingerprintOps(opsAdd),
  palierId: palierAdd.id,
  perOp: opsAdd.map(() => ({
    done: false,
    entries: emptyEntries(layoutOperation(opsAdd[0])),
  })),
  seed: 42,
  serieSize: 3,
};
const defaultSettings: FamilySettings = defaultFamilySettings();

check(
  "clé du cache de réglages: l'ex-clé orpheline de la route, épinglée",
  SETTINGS_CACHE_KEY === "calcul:settings"
);

/* ----------------------------- Pont de clé legacy ----------------------------- */

{
  const { map, storage } = memoryStorage({
    [LEGACY_SERIE_STATE_KEY]: JSON.stringify(legacyState),
  });
  const settings = loadSession(storage, null);
  const moved = JSON.parse(map.get(serieStorageKeyOf("addition")) ?? "null");
  check(
    "pont legacy: la série migre sous la clé de sa famille, enrichie",
    moved !== null && moved.famille === "addition" && moved.seed === 42,
    map.get(serieStorageKeyOf("addition"))
  );
  check(
    "pont legacy: l'ancienne clé disparaît après relecture de la cible",
    map.get(LEGACY_SERIE_STATE_KEY) === undefined
  );
  check(
    "pont legacy: sans DB ni cache → réglages par défaut",
    JSON.stringify(settings) === JSON.stringify(defaultSettings)
  );
  // Aller-retour complet : la série migrée est REPRENABLE telle quelle
  // (même palier par défaut, même taille) — le plateau est « sorti ».
  check(
    "pont legacy: la série migrée se reprend (plateau sorti sur l'étagère)",
    JSON.stringify(shelfTrays(storage, settings)) ===
      JSON.stringify([{ op: "addition", sorti: true }])
  );
  // Une seconde ouverture ne migre plus rien (le pont est une seule fois).
  loadSession(storage, null);
  check(
    "pont legacy: idempotent — une seconde ouverture ne change rien",
    map.get(LEGACY_SERIE_STATE_KEY) === undefined &&
      JSON.parse(map.get(serieStorageKeyOf("addition")) ?? "null").seed === 42
  );
}

{
  // Jamais écrasante : une clé de famille déjà occupée gagne sur la legacy.
  const occupant = JSON.stringify({ ...legacyState, seed: 7 });
  const { map, storage } = memoryStorage({
    [LEGACY_SERIE_STATE_KEY]: JSON.stringify(legacyState),
    [serieStorageKeyOf("addition")]: occupant,
  });
  loadSession(storage, null);
  check(
    "pont legacy: une clé cible occupée n'est jamais écrasée",
    map.get(serieStorageKeyOf("addition")) === occupant
  );
  check(
    "pont legacy: la legacy est tout de même rangée (cible confirmée)",
    map.get(LEGACY_SERIE_STATE_KEY) === undefined
  );
}

{
  // Red-team RT1 : un write avalé (quota plein) ne coûte pas la série —
  // la legacy RESTE pour un prochain passage.
  const { map, storage } = fullStorage({
    [LEGACY_SERIE_STATE_KEY]: JSON.stringify(legacyState),
  });
  const settings = loadSession(storage, null);
  check(
    "pont legacy: cible inécrivable → la legacy survit pour un prochain passage",
    map.get(LEGACY_SERIE_STATE_KEY) !== undefined &&
      map.get(serieStorageKeyOf("addition")) === undefined
  );
  check(
    "pont legacy: l'échec d'écriture ne bloque pas les réglages",
    JSON.stringify(settings) === JSON.stringify(defaultSettings)
  );
  // Un passage suivant, stockage redevenu accessible : la migration aboutit.
  const retry = memoryStorage(Object.fromEntries(map));
  loadSession(retry.storage, null);
  check(
    "pont legacy: retenté au passage suivant, il aboutit",
    retry.map.get(LEGACY_SERIE_STATE_KEY) === undefined &&
      retry.map.get(serieStorageKeyOf("addition")) !== undefined
  );
}

{
  // Adversarial #7 : une legacy corrompue (JSON illisible) est nettoyée,
  // rien n'est créé.
  const { map, storage } = memoryStorage({ [LEGACY_SERIE_STATE_KEY]: "{oops" });
  loadSession(storage, null);
  check(
    "pont legacy: une clé corrompue est nettoyée sans rien créer",
    map.get(LEGACY_SERIE_STATE_KEY) === undefined && map.size === 0
  );
}

/* --------------------- Réglages : cache & purge authoritative --------------------- */

{
  const junk = JSON.stringify({ ...legacyState, famille: "soustraction" });
  const { map, storage } = memoryStorage({
    [serieStorageKeyOf("addition")]: "addition-serie",
    [serieStorageKeyOf("multiplication")]: junk,
    [serieStorageKeyOf("soustraction")]: junk,
  });
  const db = {
    authoritative: true,
    familles: [{ op: "addition" as const, palier: "add-retenue" }],
    serieSize: 4,
  };
  const settings = loadSession(storage, db);
  check(
    "purge authoritative: les clés des familles désactivées sont rangées",
    map.get(serieStorageKeyOf("soustraction")) === undefined &&
      map.get(serieStorageKeyOf("multiplication")) === undefined
  );
  check(
    "purge authoritative: la clé d'une famille ACTIVÉE survit",
    map.get(serieStorageKeyOf("addition")) === "addition-serie"
  );
  check(
    "réglages authoritatifs: mis en cache appareil, normalisés",
    map.get(SETTINGS_CACHE_KEY) === JSON.stringify(settings) &&
      settings.familles.length === 1 &&
      settings.familles[0].palier === "add-retenue" &&
      settings.serieSize === 4
  );
}

{
  // Adversarial #3 / RT1 : des réglages NON authoritatifs (défauts servis
  // pendant la fenêtre pré-migration) ne cachent rien et ne purgent RIEN.
  const { map, storage } = memoryStorage({
    [serieStorageKeyOf("soustraction")]: "une-serie-locale",
  });
  loadSession(storage, {
    authoritative: false,
    familles: [{ op: "addition", palier: "add-sans-retenue" }],
    serieSize: 3,
  });
  check(
    "réglages non authoritatifs: jamais de purge ni de cache",
    map.get(serieStorageKeyOf("soustraction")) === "une-serie-locale" &&
      map.get(SETTINGS_CACHE_KEY) === undefined
  );
}

{
  // Hors-ligne : la DB muette (null) lit le cache appareil, ne purge rien.
  const cached: FamilySettings = {
    familles: [{ op: "soustraction", palier: "sous-emprunt" }],
    serieSize: 5,
  };
  const { map, storage } = memoryStorage({
    [SETTINGS_CACHE_KEY]: JSON.stringify(cached),
    [serieStorageKeyOf("addition")]: "serie-orpheline-locale",
  });
  const settings = loadSession(storage, null);
  check(
    "hors-ligne: les réglages viennent du cache appareil, normalisés",
    JSON.stringify(settings) === JSON.stringify(cached)
  );
  check(
    "hors-ligne: aucune purge — une série locale n'est jamais rangée sur des défauts",
    map.get(serieStorageKeyOf("addition")) === "serie-orpheline-locale"
  );
}

{
  // Un cache appareil corrompu → défauts sûrs, jamais un crash.
  const { storage } = memoryStorage({ [SETTINGS_CACHE_KEY]: "{oops" });
  check(
    "cache corrompu: défauts sûrs",
    JSON.stringify(loadSession(storage, null)) ===
      JSON.stringify(defaultSettings)
  );
}

/* ------------------- Reprise-ou-fraîche & purge sur désaccord ------------------- */

{
  const saved: SerieStateLike = { ...legacyState, famille: "addition" };
  const { storage } = memoryStorage({
    [serieStorageKeyOf("addition")]: JSON.stringify(saved),
  });
  const taken = takeTray(storage, defaultSettings, "addition", 999);
  check(
    "takeTray: une série reprenable se reprend EXACTEMENT (jamais régénérée)",
    JSON.stringify(taken) === JSON.stringify(saved)
  );
}

{
  // Palier changé par le parent → la clé est purgée, la série repart fraîche
  // au palier parental (l'éducatrice a réorganisé l'étagère).
  const saved: SerieStateLike = { ...legacyState, famille: "addition" };
  const parentSettings: FamilySettings = {
    familles: [{ op: "addition", palier: "add-retenue" }],
    serieSize: 3,
  };
  const { map, storage } = memoryStorage({
    [serieStorageKeyOf("addition")]: JSON.stringify(saved),
  });
  const fresh = takeTray(storage, parentSettings, "addition", 123);
  check(
    "takeTray: palier changé → série fraîche au palier parental, index 0",
    fresh.palierId === "add-retenue" &&
      fresh.index === 0 &&
      fresh.seed === 123 &&
      fresh.perOp.length === 3 &&
      fresh.perOp.every((op) => !op.done)
  );
  check(
    "purge sur désaccord: la clé non reprenable a été rangée",
    map.get(serieStorageKeyOf("addition")) === undefined
  );
  check(
    "readResumableSerie: après purge, plus rien à reprendre",
    readResumableSerie(storage, "addition", "add-retenue", 3) === null
  );
}

{
  // Une famille sans réglage explicite prend le premier palier de SA famille.
  const { storage } = memoryStorage();
  const fresh = takeTray(
    storage,
    {
      familles: [{ op: "multiplication", palier: "mult-1-chiffre" }],
      serieSize: 2,
    },
    "soustraction",
    5
  );
  check(
    "takeTray: famille sans réglage → premier palier de la famille",
    fresh.famille === "soustraction" && fresh.palierId === "sous-sans-emprunt"
  );
}

/* ----------------------- Aller-retour d'empreinte (seed) ----------------------- */

{
  const { map, storage } = memoryStorage();
  const settings = defaultSettings;
  const t1 = takeTray(storage, settings, "addition", 2026);
  check(
    "empreinte: la série fraîche régénère IDENTIQUEMENT depuis (palier, seed)",
    t1.opsFingerprint ===
      fingerprintOps(safeGenerateSerie(palierAdd, 2026, settings.serieSize)) &&
      t1.opsFingerprint.length > 0
  );
  // Écrire un chiffre, ranger, reprendre : la MÊME série revient, chiffre
  // compris — une série interrompue ne change jamais sous les yeux de
  // l'enfant.
  const written = writeCell(t1, { col: 1, row: "result" }, "4");
  saveSerie(storage, written);
  const t2 = takeTray(storage, settings, "addition", 777);
  check(
    "empreinte: rangée puis reprise → même série, chiffre écrit compris",
    JSON.stringify(t2) === JSON.stringify(written) &&
      t2.seed === 2026 &&
      t2.perOp[0].entries.result[1] === "4"
  );
  check(
    "shelfTrays: le plateau écrit est « sorti » (prédicat complet)",
    JSON.stringify(shelfTrays(storage, settings)) ===
      JSON.stringify([{ op: "addition", sorti: true }])
  );
  clearSerie(storage, "addition");
  check(
    "clearSerie: la clé de la famille est rangée, le plateau n'est plus sorti",
    map.get(serieStorageKeyOf("addition")) === undefined &&
      JSON.stringify(shelfTrays(storage, settings)) ===
        JSON.stringify([{ op: "addition", sorti: false }])
  );
}

/* -------------------- Stockage en panne : dégradation silencieuse -------------------- */

{
  const broken = brokenStorage();
  let settings: FamilySettings | null = null;
  let threw = false;
  try {
    settings = loadSession(broken, null);
    const serie = takeTray(broken, settings, "addition", 11);
    saveSerie(broken, serie);
    clearSerie(broken, "addition");
    check(
      "stockage en panne: une série fraîche naît quand même",
      serie.index === 0 && serie.perOp.length === settings.serieSize
    );
    check(
      "stockage en panne: l'étagère s'affiche, plateaux rangés",
      JSON.stringify(shelfTrays(broken, settings)) ===
        JSON.stringify([{ op: "addition", sorti: false }])
    );
  } catch {
    threw = true;
  }
  check(
    "stockage en panne: AUCUNE exception ne sort du module (défauts sûrs)",
    !threw && JSON.stringify(settings) === JSON.stringify(defaultSettings)
  );
  // La purge authoritative sur stockage en panne ne lève pas non plus.
  let purgeThrew = false;
  try {
    loadSession(broken, {
      authoritative: true,
      familles: [{ op: "addition", palier: "add-sans-retenue" }],
      serieSize: 3,
    });
  } catch {
    purgeThrew = true;
  }
  check(
    "stockage en panne: cache + purge authoritative silencieux",
    !purgeThrew
  );
}

{
  // L'adaptateur prod : window n'existe pas sous bun — chaque méthode lève,
  // et le module dégrade en défauts sûrs. C'est EXACTEMENT le contrat SSR /
  // mode privé (window touché à l'appel seulement, jamais à la création).
  let threw = false;
  let settings: FamilySettings | null = null;
  try {
    settings = loadSession(browserSerieStorage(), null);
  } catch {
    threw = true;
  }
  check(
    "browserSerieStorage: sans window (SSR/bun), défauts sûrs sans exception",
    !threw && JSON.stringify(settings) === JSON.stringify(defaultSettings)
  );
}

/* ----------------------------- Gestes d'écriture ----------------------------- */

{
  const { storage } = memoryStorage();
  const serie = takeTray(storage, defaultSettings, "addition", 42);
  const cols = serie.perOp[0].entries.result.length;

  const inked = writeCell(serie, { col: 0, row: "result" }, "9");
  check(
    "writeCell: encre la case visée de l'opération courante, immutable",
    inked.perOp[0].entries.result[0] === "9" &&
      serie.perOp[0].entries.result[0] === null &&
      inked !== serie
  );
  const erased = writeCell(inked, { col: 0, row: "result" }, null);
  check(
    "writeCell: value null efface (la gomme)",
    erased.perOp[0].entries.result[0] === null
  );
  const carry = writeCell(serie, { col: 0, row: "carry" }, "1");
  check(
    "writeCell: la rangée des retenues s'écrit aussi",
    carry.perOp[0].entries.carries[0] === "1"
  );
  check(
    "writeCell: hors bornes → état INCHANGÉ (même référence, pas de re-rendu)",
    writeCell(serie, { col: cols, row: "result" }, "1") === serie &&
      writeCell(serie, { col: -1, row: "result" }, "1") === serie
  );
  const done = finishCurrent(serie);
  check(
    "finishCurrent: fige l'opération courante seulement",
    done.perOp[0].done && done.perOp.slice(1).every((op) => !op.done)
  );
  check(
    "writeCell: une opération figée (done) n'encre plus jamais",
    writeCell(done, { col: 0, row: "result" }, "5") === done
  );
  const advanced = advanceSerie(done);
  check(
    "advanceSerie: passe à l'opération suivante",
    advanced.index === serie.index + 1
  );
  check(
    "isSerieFinished: fin quand l'index dépasse, ou série vide (palier cassé)",
    !isSerieFinished(serie) &&
      isSerieFinished({ ...serie, index: serie.serieSize }) &&
      isSerieFinished({ ...serie, perOp: [] })
  );
}

{
  check(
    "pencilAdvance: un chiffre de résultat fait avancer le crayon vers la gauche",
    JSON.stringify(pencilAdvance({ col: 2, row: "result" })) ===
      JSON.stringify({ col: 1, row: "result" })
  );
  check(
    "pencilAdvance: colonne 0 et retenues gardent le crayon en place",
    JSON.stringify(pencilAdvance({ col: 0, row: "result" })) ===
      JSON.stringify({ col: 0, row: "result" }) &&
      JSON.stringify(pencilAdvance({ col: 2, row: "carry" })) ===
        JSON.stringify({ col: 2, row: "carry" })
  );
  const valid: CellRef = { col: 1, row: "carry" };
  check(
    "isCellRef: valide le payload dnd non typé, refuse le reste",
    isCellRef(valid) &&
      isCellRef({ col: 0, row: "result" }) &&
      !(
        isCellRef(null) ||
        isCellRef("cell") ||
        isCellRef({ col: "1", row: "result" }) ||
        isCellRef({ col: 1, row: "operand" })
      )
  );
  const layout = layoutOperation({
    a: 85,
    b: 61,
    carries: 1,
    expected: 146,
    op: "addition",
    seed: 1,
  });
  const entries = emptyEntries(layout);
  check(
    "emptyEntries: aux dimensions exactes du layout, toutes cases vides",
    entries.result.length === 3 &&
      entries.carries.length === 3 &&
      entries.result.every((v) => v === null) &&
      entries.carries.every((v) => v === null)
  );
  check(
    "DEFAULT_SERIE_SIZE: les défauts de session suivent la source unique",
    defaultSettings.serieSize === DEFAULT_SERIE_SIZE
  );
}

/* --------------------------------- Bilan --------------------------------- */

if (failures > 0) {
  console.error(`\n${failures} assertion(s) en échec.`);
  process.exit(1);
}
console.log("\nToutes les assertions serie-session passent.");
