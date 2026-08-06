/**
 * SUDOKU-SESSION assertion script — la vie de la grille hors rendu.
 *
 * Pins the sudoku session module (the deep module behind the /sudoku route):
 * authoritative purge (AE2/KTD8), resume-with-SAVED-generosity (AE5/KTD3),
 * fingerprint round-trip incl. purge on mismatch, silent storage-failure
 * degradation (AE4), the writing verbs (given cells guarded, no freeze —
 * KTD4) and settingsFromRows (authoritative computed inside the pure
 * normalization — the plan-mandated deviation from the math template).
 * Same standalone-runnable pattern as serie-session.golden.ts:
 *   bun run src/lib/sudoku/__tests__/sudoku-session.golden.ts
 * Exits non-zero on any failure.
 *
 * Le stockage passe par le port SerieStorage RÉUTILISÉ de ~/lib/operations :
 * une Map ici, window.localStorage en prod — la même logique des deux côtés.
 */

import type { SerieStorage } from "~/lib/operations";
import {
  defaultSudokuSettings,
  eraseCell,
  type GrilleStateLike,
  generateSudoku,
  grilleStorageKeyOf,
  isGrilleComplete,
  isResumableGrille,
  loadSession,
  putAway,
  readResumableGrille,
  SUDOKU_SETTINGS_CACHE_KEY,
  type SudokuSettings,
  saveGrille,
  settingsFromRows,
  shelfTrays,
  sudokuSkillKeyOf,
  takeTray,
  writeCell,
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

/** Des réglages avec les trois tailles actives, générosité au choix. */
function allActive(generosite: 1 | 2 | 3): SudokuSettings {
  return {
    authoritative: true,
    tailles: ([4, 6, 9] as const).map((taille) => ({
      active: true,
      generosite,
      taille,
    })),
  };
}

const defaults = defaultSudokuSettings();

/* ------------------ AE5 : baisser la générosité ne range rien ------------------ */

{
  const { map, storage } = memoryStorage();
  // Grille commencée à l'étape 2 (un chiffre écrit), rangée par frappe.
  const g2 = takeTray(storage, allActive(2), 4, 42);
  const empty = g2.entries.findIndex((_, i) => g2.entries[i] === null);
  const { solution } = generateSudoku(4, 2, 42);
  const written = writeCell(g2, empty, solution[empty]);
  saveGrille(storage, written);
  check(
    "AE5: la grille fraîche porte la générosité du réglage courant",
    g2.generosite === 2 && g2.seed === 42
  );
  // Le parent baisse la générosité à 1 : la grille sauvegardée CONTINUE,
  // inchangée (même empreinte, mêmes chiffres) — jamais détruite.
  const lowered = allActive(1);
  const resumed = readResumableGrille(storage, 4);
  check(
    "AE5: readResumableGrille rend la grille sauvegardée telle quelle",
    resumed !== null && JSON.stringify(resumed) === JSON.stringify(written)
  );
  const taken = takeTray(storage, lowered, 4, 777);
  check(
    "AE5: takeTray après baisse de générosité reprend la MÊME grille (empreinte et chiffres compris)",
    JSON.stringify(taken) === JSON.stringify(written) &&
      taken.generosite === 2 &&
      taken.seed === 42,
    JSON.stringify(taken)
  );
  check(
    "AE5: la clé sauvegardée n'a pas été rangée dans le dos de l'enfant",
    map.get(grilleStorageKeyOf(4)) !== undefined
  );
  // Après rangement, la générosité NOUVELLE s'applique à la grille fraîche.
  putAway(storage, 4);
  const fresh = takeTray(storage, lowered, 4, 777);
  check(
    "AE5: après rangement, la prochaine grille fraîche prend la nouvelle générosité",
    fresh.generosite === 1 && fresh.seed === 777
  );
}

/* --------------- AE2 : purge authoritative des tailles désactivées --------------- */

{
  const { map, storage } = memoryStorage({
    [grilleStorageKeyOf(4)]: "grille-4-locale",
    [grilleStorageKeyOf(6)]: "grille-6-locale",
  });
  // DB authoritative SANS 6×6 : sa grille locale est rangée en silence.
  const db = settingsFromRows([
    { generosite: 2, skill: sudokuSkillKeyOf(4) },
    { generosite: 2, skill: sudokuSkillKeyOf(9) },
  ]);
  const settings = loadSession(storage, db);
  check(
    "AE2: la clé de la taille désactivée (6×6) est rangée en silence",
    map.get(grilleStorageKeyOf(6)) === undefined
  );
  check(
    "AE2: la clé d'une taille ACTIVÉE survit",
    map.get(grilleStorageKeyOf(4)) === "grille-4-locale"
  );
  check(
    "AE2: le plateau 6×6 n'existe plus à l'écran (jamais grisé)",
    !shelfTrays(storage, settings).some((t) => t.taille === 6)
  );
  check(
    "réglages authoritatifs: mis en cache appareil (sans autorité)",
    JSON.parse(map.get(SUDOKU_SETTINGS_CACHE_KEY) ?? "null")?.authoritative ===
      false
  );
  // Réactivation : la taille repart FRAÎCHE (la clé a bien disparu).
  check(
    "AE2: réactivée, la taille repart sur une grille fraîche",
    takeTray(storage, allActive(2), 6, 5).seed === 5
  );
}

{
  // KTD8 : des réglages NON authoritatifs (défauts, 9×9 inactive) ne
  // purgent RIEN et ne cachent rien — même une clé d'une taille inactive.
  const { map, storage } = memoryStorage({
    [grilleStorageKeyOf(9)]: "grille-9-locale",
  });
  loadSession(storage, defaults);
  check(
    "KTD8: des défauts (non authoritatifs) ne purgent ni ne cachent rien",
    map.get(grilleStorageKeyOf(9)) === "grille-9-locale" &&
      map.get(SUDOKU_SETTINGS_CACHE_KEY) === undefined
  );
  // Hors-ligne (DB muette) : le cache appareil relu n'est JAMAIS
  // authoritative — il ne peut pas autoriser une purge.
  const cached = memoryStorage({
    [SUDOKU_SETTINGS_CACHE_KEY]: JSON.stringify({
      ...allActive(3),
      authoritative: true, // cache édité à la main — ignoré
    }),
    [grilleStorageKeyOf(9)]: "grille-9-locale",
  });
  const offline = loadSession(cached.storage, null);
  check(
    "KTD8: le cache appareil relu n'est jamais authoritative",
    offline.authoritative === false &&
      cached.map.get(grilleStorageKeyOf(9)) === "grille-9-locale"
  );
  check(
    "hors-ligne: les réglages viennent du cache appareil, normalisés",
    offline.tailles.every((t) => t.active && t.generosite === 3)
  );
}

/* ------------------- AE4 : stockage en panne, dégradation calme ------------------- */

{
  const broken = brokenStorage();
  let threw = false;
  let taken: GrilleStateLike | null = null;
  try {
    const settings = loadSession(broken, null);
    check(
      "AE4: sans stockage ni DB, les défauts sûrs (4×4 + 6×6 étape 2, 9×9 rangée)",
      JSON.stringify(settings) === JSON.stringify(defaults)
    );
    check(
      "AE4: l'étagère s'affiche, plateaux rangés, 9×9 absente",
      JSON.stringify(shelfTrays(broken, settings)) ===
        JSON.stringify([
          { sorti: false, taille: 4 },
          { sorti: false, taille: 6 },
        ])
    );
    taken = takeTray(broken, settings, 4, 11);
    saveGrille(broken, taken);
    putAway(broken, 4);
    loadSession(
      broken,
      settingsFromRows([{ generosite: 1, skill: "sudoku:4" }])
    );
  } catch {
    threw = true;
  }
  check(
    "AE4: AUCUNE exception ne sort du module — le jeu continue en mémoire",
    !threw && taken !== null && taken.seed === 11 && taken.taille === 4
  );
}

/* --------------- Clé corrompue / trafiquée : purge silencieuse --------------- */

{
  const { map, storage } = memoryStorage({ [grilleStorageKeyOf(4)]: "{oops" });
  check(
    "clé corrompue: traitée comme absente, rangée, sans exception",
    readResumableGrille(storage, 4) === null &&
      map.get(grilleStorageKeyOf(4)) === undefined
  );
}

{
  // Empreinte trafiquée (même seed, givens d'une autre grille) → purge,
  // grille fraîche — les chiffres écrits n'appartiennent jamais à d'autres
  // cases.
  const { map, storage } = memoryStorage();
  const honest = takeTray(storage, allActive(2), 4, 42);
  const tampered: GrilleStateLike = {
    ...honest,
    fingerprint: `${honest.fingerprint.slice(0, -1)}${
      honest.fingerprint.endsWith("0") ? "1" : "0"
    }`,
  };
  saveGrille(storage, tampered);
  check(
    "empreinte trafiquée: pas reprenable (prédicat complet)",
    !isResumableGrille(tampered)
  );
  const fresh = takeTray(storage, allActive(2), 4, 99);
  check(
    "empreinte trafiquée: purge + grille fraîche au seed neuf",
    fresh.seed === 99 &&
      map.get(grilleStorageKeyOf(4)) === undefined &&
      fresh.fingerprint === generateSudoku(4, 2, 99).fingerprint
  );
}

{
  // Aller-retour d'empreinte : rangée puis reprise → la MÊME grille,
  // chiffre écrit compris.
  const { storage } = memoryStorage();
  const settings = allActive(2);
  const t1 = takeTray(storage, settings, 6, 2026);
  check(
    "empreinte: la grille fraîche régénère IDENTIQUEMENT depuis (taille, générosité, seed)",
    t1.fingerprint === generateSudoku(6, 2, 2026).fingerprint &&
      t1.fingerprint.length === 36
  );
  const empty = t1.entries.findIndex((_, i) => t1.fingerprint[i] === "0");
  const written = writeCell(t1, empty, 1);
  saveGrille(storage, written);
  const t2 = takeTray(storage, settings, 6, 777);
  check(
    "empreinte: rangée puis reprise → même grille, chiffre écrit compris",
    JSON.stringify(t2) === JSON.stringify(written) && t2.seed === 2026
  );
  check(
    "shelfTrays: le plateau écrit est « sorti » (prédicat complet)",
    shelfTrays(storage, settings).find((t) => t.taille === 6)?.sorti === true
  );
}

/* ----------------------------- Gestes d'écriture ----------------------------- */

{
  const { storage } = memoryStorage();
  const grille = takeTray(storage, allActive(1), 4, 7);
  const given = grille.entries.findIndex(
    (_, i) => grille.fingerprint[i] !== "0"
  );
  const empty = grille.entries.findIndex(
    (_, i) => grille.fingerprint[i] === "0"
  );
  check(
    "writeCell: une case DONNÉE rend l'état INCHANGÉ (même référence)",
    writeCell(grille, given, 1) === grille &&
      eraseCell(grille, given) === grille
  );
  const inked = writeCell(grille, empty, 2);
  check(
    "writeCell: encre la case visée, immutable",
    inked !== grille &&
      inked.entries[empty] === 2 &&
      grille.entries[empty] === null
  );
  check(
    "writeCell: hors bornes ou chiffre hors 1..N → même référence",
    writeCell(grille, -1, 1) === grille &&
      writeCell(grille, grille.entries.length, 1) === grille &&
      writeCell(grille, empty, 0) === grille &&
      writeCell(grille, empty, 5) === grille &&
      writeCell(grille, empty, 1.5) === grille
  );
  check(
    "eraseCell: efface une case écrite ; une case déjà vide, même référence",
    eraseCell(inked, empty).entries[empty] === null &&
      eraseCell(grille, empty) === grille
  );
  // Grille complétée depuis la solution : les écritures RESTENT légales
  // (KTD4 — pas d'état figé), et putAway est le seul rangement.
  const { solution } = generateSudoku(4, 1, 7);
  let complete = grille;
  for (let i = 0; i < solution.length; i += 1) {
    if (grille.fingerprint[i] === "0") {
      complete = writeCell(complete, i, solution[i]);
    }
  }
  check(
    "isGrilleComplete: vraie une fois chaque case à compléter remplie",
    !isGrilleComplete(grille) && isGrilleComplete(complete)
  );
  const rewritten = writeCell(
    complete,
    empty,
    complete.entries[empty] === 1 ? 2 : 1
  );
  check(
    "KTD4: écrire reste légal grille complète (jamais figée)",
    rewritten !== complete && !isGrilleComplete(eraseCell(complete, empty))
  );
  saveGrille(storage, complete);
  check(
    "grille complète pas encore rangée: toujours « sortie » (le rangement est un geste)",
    shelfTrays(storage, allActive(1)).find((t) => t.taille === 4)?.sorti ===
      true
  );
}

/* ------------------------ putAway : chirurgical par taille ------------------------ */

{
  const { map, storage } = memoryStorage();
  saveGrille(storage, takeTray(storage, allActive(2), 4, 1));
  saveGrille(storage, takeTray(storage, allActive(2), 6, 2));
  putAway(storage, 4);
  check(
    "putAway: range exactement la clé de SA taille, les autres survivent",
    map.get(grilleStorageKeyOf(4)) === undefined &&
      map.get(grilleStorageKeyOf(6)) !== undefined
  );
}

/* ---------------------- settingsFromRows : normalisation pure ---------------------- */

{
  const empty = settingsFromRows([]);
  check(
    "settingsFromRows: table vide → 4×4 + 6×6 actives à l'étape 2, 9×9 rangée, PAS authoritative",
    JSON.stringify(empty) ===
      JSON.stringify({
        authoritative: false,
        tailles: [
          { active: true, generosite: 2, taille: 4 },
          { active: true, generosite: 2, taille: 6 },
          { active: false, generosite: 2, taille: 9 },
        ],
      }),
    JSON.stringify(empty)
  );
  const one = settingsFromRows([{ generosite: 3, skill: "sudoku:9" }]);
  check(
    "settingsFromRows: une ligne reconnue → authoritative (déviation KTD8, calculée ICI)",
    one.authoritative === true &&
      one.tailles.find((t) => t.taille === 9)?.active === true &&
      one.tailles.find((t) => t.taille === 9)?.generosite === 3 &&
      one.tailles.find((t) => t.taille === 4)?.active === false
  );
  const junk = settingsFromRows([
    { generosite: 2, skill: "calcul-pose:addition" },
    { generosite: 2, skill: "sudoku:12" },
  ]);
  check(
    "settingsFromRows: clés inconnues seules → ignorées, défauts NON authoritatifs",
    JSON.stringify(junk) === JSON.stringify(empty)
  );
  const garbage = settingsFromRows([{ generosite: 42, skill: "sudoku:4" }]);
  check(
    "settingsFromRows: générosité poubelle clampée à 1 (la plus généreuse)",
    garbage.tailles.find((t) => t.taille === 4)?.generosite === 1
  );
  const dup = settingsFromRows([
    { generosite: 1, skill: "sudoku:4" },
    { generosite: 3, skill: "sudoku:4" },
  ]);
  check(
    "settingsFromRows: lignes dupliquées → la PREMIÈRE reconnue gagne (épinglé)",
    dup.tailles.find((t) => t.taille === 4)?.generosite === 1
  );
}

/* --------------------------------- Bilan --------------------------------- */

if (failures > 0) {
  console.error(`\n${failures} assertion(s) en échec.`);
  process.exit(1);
}
console.log("\nToutes les assertions sudoku-session passent.");
