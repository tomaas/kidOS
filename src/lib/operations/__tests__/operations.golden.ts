/**
 * OPERATIONS assertion script — générateur, layout, paliers, énoncés.
 *
 * Pins the pure math mini-app modules. Same standalone-runnable pattern as
 * reading-aids.golden.ts (no test runner in this app):
 *   bun run src/lib/operations/__tests__/operations.golden.ts
 * (wired as `bun run test:operations`). Exits non-zero on any failure.
 * Pure modules (no env import) — no SKIP_ENV_VALIDATION needed.
 *
 * Ce que ces assertions verrouillent (décisions eng-review) :
 *  - déterminisme total à seed égal (goldens reproductibles) ;
 *  - soustraction jamais négative, résultats ≤ 9999 (4 rangs, D12-C) ;
 *  - contrainte insatisfaisable → erreur typée, jamais de boucle infinie ;
 *  - layout partagé écran/print (3A) : géométrie stable et exacte ;
 *  - paliers purement descriptifs (T2-A) : pas d'évaluation ici ;
 *  - énoncés (D11-C) : déterministes, calmes par construction.
 */

import {
  bridgeLegacySerie,
  countBorrows,
  countCarries,
  countMultCarries,
  DEFAULT_PALIER_ID,
  DEFAULT_SERIE_SIZE,
  enonceFor,
  FAMILLES,
  familleOfPalier,
  fingerprintOps,
  generateOperation,
  generateSerie,
  isPalierOfFamille,
  isResumableSerie,
  LEGACY_SERIE_STATE_KEY,
  layoutOperation,
  MAX_RESULT,
  MAX_SERIE_SIZE,
  MIN_SERIE_SIZE,
  matchesQuota,
  normalizeFamilySettings,
  OBJETS,
  OBJETS_EN,
  PALIERS,
  palierById,
  paliersByFamille,
  RANK_COLORS,
  RANK_LABELS,
  resolvePalier,
  resolvePalierForFamille,
  safeGenerateSerie,
  serieStorageKeyOf,
  settingsFromRows,
  skillKeyOf,
  UnsatisfiableConstraintError,
  varianteDuJour,
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

/* ----------------------------- Arithmétique ----------------------------- */

check("countCarries(47, 25) = 1", countCarries(47, 25) === 1);
check("countCarries(23, 45) = 0", countCarries(23, 45) === 0);
check("countCarries(999, 1) = 3", countCarries(999, 1) === 3);
check("countBorrows(52, 27) = 1", countBorrows(52, 27) === 1);
check("countBorrows(48, 25) = 0", countBorrows(48, 25) === 0);
check("countBorrows(100, 1) = 2", countBorrows(100, 1) === 2);
check("countMultCarries(24, 2) = 0", countMultCarries(24, 2) === 0);
check("countMultCarries(48, 7) = 2", countMultCarries(48, 7) === 2);

/* ------------------- Identité PRNG (goldens reproductibles) ------------------- */

// Valeurs EXACTES épinglées (même esprit que prompt-identity.golden.ts) :
// si mulberry32, l'échantillonnage ou la dérivation de seeds change, ces
// pins cassent — c'est voulu, les goldens sont l'identité du générateur.
{
  const op = generateOperation(PALIERS[0].constraints, 1);
  check(
    "identité PRNG: palier 0, seed 1 → 32 + 2 = 34 (0 retenue)",
    op.a === 32 && op.b === 2 && op.expected === 34 && op.carries === 0,
    JSON.stringify(op)
  );
  const serie = generateSerie(PALIERS[0].constraints, 2026, 3);
  check(
    "identité PRNG: dérivation des seeds de série (2026 → 62806, 70725, 78644)",
    JSON.stringify(serie.map((o) => o.seed)) ===
      JSON.stringify([62_806, 70_725, 78_644]),
    JSON.stringify(serie.map((o) => o.seed))
  );
}

/* ------------------------- Générateur : invariants ------------------------- */

// La sémantique des quotas vit dans matchesQuota (exportée) — pas de copie ici.
const quotaHolds = matchesQuota;

// Précondition exécutable : countBorrows(a < b) lève au lieu de boucler.
{
  let threw = false;
  try {
    countBorrows(1, 2);
  } catch (e) {
    threw = e instanceof RangeError;
  }
  check("countBorrows(1, 2) → RangeError (précondition a ≥ b gardée)", threw);
}

// Bornes de série : source unique pour l'UI et la validation zod.
check(
  "bornes de série: MIN=1 ≤ DEFAULT=3 ≤ MAX=6",
  MIN_SERIE_SIZE === 1 &&
    MAX_SERIE_SIZE === 6 &&
    DEFAULT_SERIE_SIZE >= MIN_SERIE_SIZE &&
    DEFAULT_SERIE_SIZE <= MAX_SERIE_SIZE
);

for (const palier of PALIERS) {
  let allValid = true;
  let firstProblem = "";
  for (let seed = 1; seed <= 200; seed += 1) {
    const op = generateOperation(palier.constraints, seed);
    const trueResult = {
      addition: op.a + op.b,
      multiplication: op.a * op.b,
      soustraction: op.a - op.b,
    }[op.op];
    const expectedOk = op.expected === trueResult;
    const quota =
      op.op === "soustraction"
        ? palier.constraints.borrows
        : palier.constraints.carries;
    const quotaOk = quotaHolds(quota, op.carries);
    const boundsOk =
      op.expected <= MAX_RESULT &&
      (op.op !== "soustraction" || op.expected > 0);
    if (!(expectedOk && quotaOk && boundsOk)) {
      allValid = false;
      firstProblem = `seed ${seed}: ${op.a} ${op.op} ${op.b} = ${op.expected} (carries ${op.carries})`;
      break;
    }
  }
  check(`palier ${palier.id}: 200 seeds valides`, allValid, firstProblem);
}

// Déterminisme : même seed → même opération ; seeds voisins → variété.
{
  const c = PALIERS[1].constraints;
  const a1 = generateOperation(c, 42);
  const a2 = generateOperation(c, 42);
  check(
    "déterminisme: seed 42 rejoue exactement la même opération",
    a1.a === a2.a && a1.b === a2.b && a1.expected === a2.expected
  );
  const varied = new Set(
    Array.from({ length: 50 }, (_, i) =>
      JSON.stringify(generateOperation(c, i + 1))
    )
  );
  check(
    "variété: 50 seeds → au moins 30 opérations distinctes",
    varied.size >= 30
  );
}

// Contrainte insatisfaisable → erreur typée (jamais de boucle infinie).
{
  let threw = false;
  try {
    generateOperation(
      {
        aDigits: { max: 1, min: 1 },
        bDigits: { max: 1, min: 1 },
        carries: "some",
        op: "addition",
      },
      7
    );
    // 1 chiffre + 1 chiffre AVEC retenue existe (ex. 7+8) — celle-ci est satisfaisable.
    threw = false;
  } catch {
    threw = true;
  }
  check(
    "contrainte satisfaisable: 1+1 chiffre avec retenue ne lève pas",
    !threw
  );

  let impossibleThrew = false;
  try {
    generateOperation(
      {
        aDigits: { max: 1, min: 1 },
        bDigits: { max: 1, min: 1 },
        borrows: "some",
        op: "soustraction",
      },
      7
    );
  } catch (e) {
    impossibleThrew = e instanceof UnsatisfiableConstraintError;
  }
  check(
    "contrainte insatisfaisable (emprunt sur 1 chiffre) → UnsatisfiableConstraintError",
    impossibleThrew
  );
}

// Multiplication : ×0 et ×1 n'apprennent rien à poser — jamais générés.
{
  let allB2Plus = true;
  for (const palier of PALIERS) {
    if (palier.constraints.op !== "multiplication") {
      continue;
    }
    for (let seed = 1; seed <= 200; seed += 1) {
      if (generateOperation(palier.constraints, seed).b < 2) {
        allB2Plus = false;
      }
    }
  }
  check("multiplication: b ≥ 2 toujours (jamais ×0 ni ×1)", allB2Plus);
}

// Soustraction : a > b strict par construction (0 n'apprend rien à poser).
// Et le swap du diminuende ne doit jamais sortir des plages de chiffres
// déclarées (invariant qui protège les futurs paliers à plages disjointes).
{
  let strict = true;
  let digitsOk = true;
  for (const palier of PALIERS) {
    if (palier.constraints.op !== "soustraction") {
      continue;
    }
    const { aDigits, bDigits } = palier.constraints;
    const minDigits = Math.min(aDigits.min, bDigits.min);
    const maxDigits = Math.max(aDigits.max, bDigits.max);
    for (let seed = 1; seed <= 200; seed += 1) {
      const o = generateOperation(palier.constraints, seed);
      if (o.a <= o.b) {
        strict = false;
      }
      const aLen = String(o.a).length;
      const bLen = String(o.b).length;
      if (
        aLen < minDigits ||
        aLen > maxDigits ||
        bLen < minDigits ||
        bLen > maxDigits
      ) {
        digitsOk = false;
      }
    }
  }
  check("soustraction: a > b strict (jamais de résultat nul)", strict);
  check(
    "soustraction: les opérandes échangés restent dans les plages de chiffres",
    digitsOk
  );
}

// Série : taille, déterminisme, même palier.
{
  const serie = generateSerie(PALIERS[0].constraints, 2026, DEFAULT_SERIE_SIZE);
  const replay = generateSerie(
    PALIERS[0].constraints,
    2026,
    DEFAULT_SERIE_SIZE
  );
  check("série: taille par défaut = 3", serie.length === 3);
  check(
    "série: déterministe à seed égal",
    JSON.stringify(serie) === JSON.stringify(replay)
  );
}

/* ------------------------------ Layout (3A) ------------------------------ */

{
  const l = layoutOperation({
    a: 47,
    b: 25,
    carries: 1,
    expected: 72,
    op: "addition",
    seed: 1,
  });
  check("layout 47+25: 2 colonnes", l.columnCount === 2);
  check("layout 47+25: signe +", l.sign === "+");
  check(
    "layout 47+25: retenue possible sur les dizaines seulement",
    JSON.stringify(l.carrySlots) === JSON.stringify([true, false])
  );
  check(
    "layout 47+25: rangées ['4','7'] / ['2','5']",
    JSON.stringify(l.operandRows) ===
      JSON.stringify([
        ["4", "7"],
        ["2", "5"],
      ])
  );
  check(
    "layout 47+25: résultat ['7','2']",
    JSON.stringify(l.expectedDigits) === JSON.stringify(["7", "2"])
  );
}

{
  // Le résultat déborde d'une colonne : la grille s'aligne sur lui.
  const l = layoutOperation({
    a: 85,
    b: 61,
    carries: 1,
    expected: 146,
    op: "addition",
    seed: 1,
  });
  check("layout 85+61: 3 colonnes (résultat 146)", l.columnCount === 3);
  check(
    "layout 85+61: opérandes alignés à droite avec case vide",
    JSON.stringify(l.operandRows) ===
      JSON.stringify([
        ["", "8", "5"],
        ["", "6", "1"],
      ])
  );
}

{
  const l = layoutOperation({
    a: 52,
    b: 27,
    carries: 1,
    expected: 25,
    op: "soustraction",
    seed: 1,
  });
  check("layout 52−27: signe −", l.sign === "−");
  const m = layoutOperation({
    a: 24,
    b: 3,
    carries: 1,
    expected: 72,
    op: "multiplication",
    seed: 1,
  });
  check("layout 24×3: signe ×", m.sign === "×");
  check(
    "layout 24×3: b aligné à droite ['','3']",
    JSON.stringify(m.operandRows[1]) === JSON.stringify(["", "3"])
  );
}

{
  // 4 rangs (D12-C) : jusqu'aux milliers, jamais au-delà.
  const l = layoutOperation({
    a: 4736,
    b: 2851,
    carries: 1,
    expected: 7587,
    op: "addition",
    seed: 1,
  });
  check("layout milliers: 4 colonnes max", l.columnCount === 4);
}

{
  // Cas limite 1 colonne : jamais de case de retenue au-dessus des unités.
  const l = layoutOperation({
    a: 9,
    b: 2,
    carries: 0,
    expected: 7,
    op: "soustraction",
    seed: 1,
  });
  check(
    "layout 9−2 (1 colonne): aucune case de retenue, aucun remplissage",
    l.columnCount === 1 &&
      JSON.stringify(l.carrySlots) === JSON.stringify([false]) &&
      JSON.stringify(l.operandRows) === JSON.stringify([["9"], ["2"]]) &&
      JSON.stringify(l.expectedDigits) === JSON.stringify(["7"])
  );
}

{
  // Invariant pour toute opération générée : géométrie cohérente + jamais
  // de retenue sur les unités (colonne la plus à droite).
  let coherent = true;
  let firstProblem = "";
  for (const palier of PALIERS) {
    for (let seed = 1; seed <= 60; seed += 1) {
      const o = generateOperation(palier.constraints, seed);
      const l = layoutOperation(o);
      const widthsOk =
        l.carrySlots.length === l.columnCount &&
        l.operandRows.every((r) => r.length === l.columnCount) &&
        l.expectedDigits.length === l.columnCount;
      const unitsFree = l.carrySlots[l.columnCount - 1] === false;
      const digitsMatch =
        l.expectedDigits.join("") === String(o.expected) &&
        Number(l.operandRows[0].join("")) === o.a &&
        Number(l.operandRows[1].join("")) === o.b;
      if (!(widthsOk && unitsFree && digitsMatch)) {
        coherent = false;
        firstProblem = `${palier.id} seed ${seed}: ${JSON.stringify(l)}`;
        break;
      }
    }
  }
  check(
    "layout: géométrie cohérente sur tous les paliers × 60 seeds",
    coherent,
    firstProblem
  );
}

/* --------------------------- Paliers (T2-A) --------------------------- */

check(
  "paliers: ordres strictement croissants",
  (() => {
    for (let i = 1; i < PALIERS.length; i += 1) {
      if (PALIERS[i].ordre <= PALIERS[i - 1].ordre) {
        return false;
      }
    }
    return true;
  })()
);
check(
  "paliers: le premier est l'addition sans retenue (progression Montessori)",
  PALIERS[0].constraints.op === "addition" &&
    PALIERS[0].constraints.carries === "none"
);
check(
  "resolvePalier: id inconnu ou null → premier palier, jamais d'erreur",
  resolvePalier("palier-disparu").id === PALIERS[0].id &&
    resolvePalier(null).id === PALIERS[0].id
);
check(
  "paliers: aucune notion d'évaluation (pas de champ score/confort/temps)",
  PALIERS.every((p) => !("comfort" in p || "score" in p || "time" in p))
);
check(
  "paliers: ids uniques (clés stables pour la DB et resolvePalier)",
  new Set(PALIERS.map((p) => p.id)).size === PALIERS.length
);
check(
  "palierById: id connu → le palier, id inconnu → undefined",
  palierById("mult-1-chiffre")?.id === "mult-1-chiffre" &&
    palierById("nope") === undefined
);
check(
  "resolvePalier: undefined / '' → premier palier ; id valide conservé",
  resolvePalier(undefined).id === PALIERS[0].id &&
    resolvePalier("").id === PALIERS[0].id &&
    resolvePalier("sous-emprunt").id === "sous-emprunt"
);
check(
  "rangs (D12-C): 4 rangs exactement, couleurs du matériel épinglées",
  MAX_RESULT === 9999 &&
    Object.keys(RANK_LABELS).length === 4 &&
    RANK_COLORS[0] === "vert" &&
    RANK_COLORS[1] === "bleu" &&
    RANK_COLORS[2] === "rouge" &&
    RANK_COLORS[3] === "vert-mille"
);

/* --------------------------- Énoncés (D11-C) --------------------------- */

{
  const op = generateOperation(PALIERS[0].constraints, 11);
  const e1 = enonceFor(op, { doudou: "Doudou", hero: "Arsène" });
  const e2 = enonceFor(op, { doudou: "Doudou", hero: "Arsène" });
  check("énoncé: déterministe à opération égale", e1 === e2);
  check("énoncé: contient le héros", e1.includes("Arsène"));
  check(
    "énoncé: contient les deux nombres",
    e1.includes(String(op.a)) && e1.includes(String(op.b))
  );
  check(
    "énoncé: une seule phrase courte",
    e1.split(".").length <= 2 && e1.length < 90
  );

  const sansDoudou = enonceFor(op, { hero: "Léa" });
  check("énoncé: fonctionne sans doudou", sansDoudou.includes("Léa"));

  // Calme + sobriété par construction, sur les DEUX branches (avec/sans
  // doudou) : aucun mot d'enjeu, et chaque gabarit tient la promesse
  // « UNE phrase courte » (≤ 1 point, < 90 caractères) — les pools élargis
  // (UX 2026-07-23) restent couverts en entier.
  const FORBIDDEN = [
    "bravo",
    "gagné",
    "perdu",
    "vite",
    "erreur",
    "faux",
    "point",
  ];
  let calm = true;
  let sobre = true;
  for (const palier of PALIERS) {
    for (let seed = 1; seed <= 60; seed += 1) {
      const o = generateOperation(palier.constraints, seed);
      const phrases = [
        enonceFor(o, { doudou: "Doudou", hero: "Arsène" }),
        enonceFor(o, { hero: "Arsène" }),
      ];
      for (const phrase of phrases) {
        if (FORBIDDEN.some((w) => phrase.toLowerCase().includes(w))) {
          calm = false;
        }
        if (!(phrase.split(".").length <= 2 && phrase.length < 90)) {
          sobre = false;
        }
      }
    }
  }
  check(
    "énoncés: aucun terme d'enjeu sur tous les paliers × 60 seeds × 2 branches",
    calm
  );
  check(
    "énoncés: sobriété (1 phrase, < 90 car.) sur TOUS les gabarits — paliers × 60 seeds × 2 branches",
    sobre
  );
}

// Identité des gabarits (comme prompt-identity) : la phrase exacte est
// épinglée — un changement de gabarit doit se voir dans le golden.
{
  const op = generateOperation(PALIERS[0].constraints, 1); // 32 + 2
  check(
    "énoncé épinglé (avec doudou): variante compagnon exacte",
    enonceFor(op, { doudou: "Doudou", hero: "Arsène" }) ===
      "Arsène range 32 plumes, Doudou en apporte 2.",
    enonceFor(op, { doudou: "Doudou", hero: "Arsène" })
  );
  check(
    "énoncé épinglé (sans doudou): variante solo exacte",
    enonceFor(op, { hero: "Arsène" }) ===
      "Arsène ramasse 32 plumes, puis encore 2.",
    enonceFor(op, { hero: "Arsène" })
  );
  // Invariance à la config d'entités (red-team 2026-07-23) : quand la
  // branche solo sort, le libellé est LE MÊME avec ou sans doudou — le
  // tirage de branche est consommé inconditionnellement. Vérifié sur les
  // TROIS familles (chaque branche a son propre garde compagnon).
  {
    let invariant = true;
    for (const palierIdx of [0, 3, 5]) {
      for (let seed = 1; seed <= 100; seed += 1) {
        const o = generateOperation(PALIERS[palierIdx].constraints, seed);
        const avec = enonceFor(o, { doudou: "Zaichik", hero: "A" });
        if (!avec.includes("Zaichik") && avec !== enonceFor(o, { hero: "A" })) {
          invariant = false;
          break;
        }
      }
    }
    check(
      "énoncé solo: libellé invariant à la présence du doudou (3 familles × 100 seeds)",
      invariant
    );
  }
}

// Pin délibéré du pool de contenants (identité, comme les phrases épinglées).
const CONTENANTS_PIN = ["paniers", "boîtes", "corbeilles", "sacs", "bols"];

/** Réduit une phrase à son gabarit : nombres → N, objets → OBJ (dérivés du
    pool EXPORTÉ — un objet ajouté ne fait pas dériver le normaliseur),
    contenants → CONT (depuis le pin ci-dessus). Mots ANCRÉS (\b) et
    échappés : un futur objet sous-chaîne d'un gabarit (« os » dans « pose »)
    ou porteur d'un métacaractère ne peut pas fausser la normalisation. */
function motsRegex(mots: readonly string[]): RegExp {
  const escaped = mots.map((m) => m.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
  return new RegExp(`\\b(?:${escaped.join("|")})\\b`, "g");
}
function gabaritOf(phrase: string): string {
  return phrase
    .replaceAll(/\d+/g, "N")
    .replaceAll(motsRegex(OBJETS), "OBJ")
    .replaceAll(motsRegex(CONTENANTS_PIN), "CONT");
}

// Couverture des branches de gabarits : avec un doudou, les deux variantes
// (compagnon / solo) sortent bien selon la seed — addition ET soustraction.
// La branche compagnon se détecte par la PRÉSENCE DU NOM du doudou, jamais
// par un verbe : les pools tournent, un verbe n'identifie plus la branche.
{
  const DOUDOU = "Zaichik";
  const addVariants = new Set<string>();
  const sousVariants = new Set<string>();
  const addCompagnon = new Set<string>();
  const sousCompagnon = new Set<string>();
  for (let seed = 1; seed <= 100; seed += 1) {
    const add = generateOperation(PALIERS[0].constraints, seed);
    const addPhrase = enonceFor(add, { doudou: DOUDOU, hero: "A" });
    addVariants.add(addPhrase.includes(DOUDOU) ? "compagnon" : "solo");
    if (addPhrase.includes(DOUDOU)) {
      addCompagnon.add(gabaritOf(addPhrase));
    }
    const sous = generateOperation(PALIERS[3].constraints, seed);
    const sousPhrase = enonceFor(sous, { doudou: DOUDOU, hero: "A" });
    sousVariants.add(sousPhrase.includes(DOUDOU) ? "compagnon" : "solo");
    if (sousPhrase.includes(DOUDOU)) {
      sousCompagnon.add(gabaritOf(sousPhrase));
    }
  }
  check(
    "énoncé addition: les deux variantes (compagnon/solo) apparaissent",
    addVariants.size === 2
  );
  check(
    "énoncé soustraction: les deux variantes (compagnon/solo) apparaissent",
    sousVariants.size === 2
  );
  check(
    "énoncé addition compagnon: le pool tourne (≥ 2 gabarits sur 100 seeds)",
    addCompagnon.size >= 2,
    [...addCompagnon].join(" | ")
  );
  check(
    "énoncé soustraction compagnon: le pool tourne (≥ 2 gabarits sur 100 seeds)",
    sousCompagnon.size >= 2,
    [...sousCompagnon].join(" | ")
  );

  // Multiplication : un CONTENANT du pool (plus jamais « toujours des
  // paniers » — UX 2026-07-23), jamais de compagnon, et le pool ET les
  // tournures (remplit/prépare) tournent vraiment sur les seeds.
  const contenantsVus = new Set<string>();
  const multGabarits = new Set<string>();
  let multOk = true;
  for (let seed = 1; seed <= 100; seed += 1) {
    const mult = generateOperation(PALIERS[5].constraints, seed);
    const multPhrase = enonceFor(mult, { doudou: "Doudou", hero: "Arsène" });
    const contenant = CONTENANTS_PIN.find((c) => multPhrase.includes(c));
    if (!contenant || multPhrase.includes("Doudou")) {
      multOk = false;
      break;
    }
    contenantsVus.add(contenant);
    multGabarits.add(gabaritOf(multPhrase));
  }
  check(
    "énoncé multiplication: toujours un contenant du pool, sans compagnon",
    multOk
  );
  check(
    "énoncé multiplication: plusieurs contenants sortent sur 100 seeds",
    contenantsVus.size >= 3,
    [...contenantsVus].join(", ")
  );
  check(
    "énoncé multiplication: les deux tournures sortent sur 100 seeds",
    multGabarits.size >= 2,
    [...multGabarits].join(" | ")
  );

  // Variété des gabarits (UX 2026-07-23) : les pools solo tournent aussi —
  // la soustraction sans doudou ne dit pas toujours « dans sa boîte ».
  const sousSolo = new Set<string>();
  const addSolo = new Set<string>();
  for (let seed = 1; seed <= 100; seed += 1) {
    const sous = generateOperation(PALIERS[3].constraints, seed);
    sousSolo.add(gabaritOf(enonceFor(sous, { hero: "A" })));
    const add = generateOperation(PALIERS[0].constraints, seed);
    addSolo.add(gabaritOf(enonceFor(add, { hero: "A" })));
  }
  check(
    "énoncé soustraction solo: plusieurs gabarits sortent sur 100 seeds",
    sousSolo.size >= 2
  );
  check(
    "énoncé addition solo: plusieurs gabarits sortent sur 100 seeds",
    addSolo.size >= 2
  );
}

/* ------------- Énoncés EN (plan multilangue, phase 2) ------------- */
// Le contrat PRNG bilingue : pools alignés INDEX PAR INDEX et de MÊME
// longueur — à seed égale, l'énoncé EN est LA TRADUCTION de l'énoncé FR
// (même objet, même gabarit). Les pins FR ci-dessus restent la référence ;
// ceux-ci épinglent la traduction du MÊME tirage.
{
  check(
    "énoncés EN: pool d'objets aligné (même longueur que OBJETS)",
    OBJETS_EN.length === OBJETS.length,
    `fr=${OBJETS.length} en=${OBJETS_EN.length}`
  );

  // Pin délibéré du pool de contenants EN (identité, comme CONTENANTS_PIN).
  const CONTENANTS_EN_PIN = ["baskets", "boxes", "tubs", "bags", "bowls"];
  check(
    "énoncés EN: pool de contenants aligné (même longueur que le pin FR)",
    CONTENANTS_EN_PIN.length === CONTENANTS_PIN.length
  );

  const op = generateOperation(PALIERS[0].constraints, 1); // 32 + 2
  check(
    "énoncé EN épinglé (avec doudou): traduction du MÊME tirage que le pin FR",
    enonceFor(op, { doudou: "Doudou", hero: "Arsène" }, "en") ===
      "Arsène puts away 32 feathers, Doudou brings 2 more.",
    enonceFor(op, { doudou: "Doudou", hero: "Arsène" }, "en")
  );
  check(
    "énoncé EN épinglé (sans doudou): traduction du MÊME tirage que le pin FR",
    enonceFor(op, { hero: "Arsène" }, "en") ===
      "Arsène gathers 32 feathers, then 2 more.",
    enonceFor(op, { hero: "Arsène" }, "en")
  );

  // Alignement d'index PROUVÉ sur un large échantillon : l'objet tiré en FR
  // et l'objet tiré en EN sont au MÊME index de leur pool respectif, sur les
  // trois familles et les deux branches.
  {
    let aligne = true;
    for (const palierIdx of [0, 3, 5]) {
      for (let seed = 1; seed <= 100; seed += 1) {
        const o = generateOperation(PALIERS[palierIdx].constraints, seed);
        for (const entities of [
          { doudou: "Doudou", hero: "A" },
          { hero: "A" },
        ]) {
          const idxFr = OBJETS.findIndex((mot) =>
            motsRegex([mot]).test(enonceFor(o, entities))
          );
          const idxEn = OBJETS_EN.findIndex((mot) =>
            motsRegex([mot]).test(enonceFor(o, entities, "en"))
          );
          if (idxFr === -1 || idxFr !== idxEn) {
            aligne = false;
            break;
          }
        }
      }
    }
    check(
      "énoncés EN: objet au même index que le FR (3 familles × 100 seeds × 2 branches)",
      aligne
    );
  }

  // Calme + sobriété EN, mêmes exigences que le FR : liste anglaise (jamais
  // well done/won/hurry/wrong…), ≤ 1 point, < 90 caractères — tous les
  // paliers × 60 seeds × 2 branches.
  const FORBIDDEN_EN = [
    "well done",
    "bravo",
    " won ",
    " win ",
    " lost ",
    " lose ",
    "hurry",
    "quick",
    " fast ",
    "wrong",
    "score",
    " points",
    "prize",
    "reward",
    " best ",
  ];
  let calmEn = true;
  let sobreEn = true;
  for (const palier of PALIERS) {
    for (let seed = 1; seed <= 60; seed += 1) {
      const o = generateOperation(palier.constraints, seed);
      const phrases = [
        enonceFor(o, { doudou: "Doudou", hero: "Arsène" }, "en"),
        enonceFor(o, { hero: "Arsène" }, "en"),
      ];
      for (const phrase of phrases) {
        if (FORBIDDEN_EN.some((w) => ` ${phrase.toLowerCase()} `.includes(w))) {
          calmEn = false;
        }
        if (!(phrase.split(".").length <= 2 && phrase.length < 90)) {
          sobreEn = false;
        }
      }
    }
  }
  check(
    "énoncés EN: aucun terme d'enjeu sur tous les paliers × 60 seeds × 2 branches",
    calmEn
  );
  check(
    "énoncés EN: sobriété (1 phrase, < 90 car.) sur TOUS les gabarits",
    sobreEn
  );

  // La variété EN suit le FR par construction (mêmes indices) : preuve
  // rapide — plusieurs contenants et les deux tournures mult sur 100 seeds.
  const contenantsVusEn = new Set<string>();
  for (let seed = 1; seed <= 100; seed += 1) {
    const mult = generateOperation(PALIERS[5].constraints, seed);
    const phrase = enonceFor(mult, { hero: "A" }, "en");
    const contenant = CONTENANTS_EN_PIN.find((c) => phrase.includes(c));
    if (contenant) {
      contenantsVusEn.add(contenant);
    }
  }
  check(
    "énoncés EN multiplication: plusieurs contenants sortent sur 100 seeds",
    contenantsVusEn.size >= 3,
    [...contenantsVusEn].join(", ")
  );
}

/* ------------------- Variante du jour (étagère, UX 2026-07-23) ------------------ */
{
  // Deux appels séparés (pas une self-compare : on épingle la VALEUR exacte —
  // si le hachage change, ce pin casse, comme les pins PRNG).
  const v1 = varianteDuJour("addition", "2026-7-23", 3);
  check(
    "varianteDuJour: déterministe, valeur épinglée (addition, 2026-7-23 → 1)",
    v1 === 1,
    String(v1)
  );
  let borne = true;
  const vues = new Set<number>();
  for (let j = 1; j <= 31; j += 1) {
    const v = varianteDuJour("multiplication", `2026-7-${j}`, 3);
    if (!(Number.isInteger(v) && v >= 0 && v < 3)) {
      borne = false;
    }
    vues.add(v);
  }
  check("varianteDuJour: toujours dans [0, count)", borne);
  check(
    "varianteDuJour: tourne vraiment sur un mois (≥ 2 variantes)",
    vues.size >= 2
  );
  check(
    "varianteDuJour: count ≤ 1 rend toujours 0",
    varianteDuJour("soustraction", "2026-7-23", 1) === 0 &&
      varianteDuJour("soustraction", "2026-7-23", 0) === 0
  );
}

/* ------------------- Familles & réglages (étagère, 1B/3A) ------------------ */
{
  check(
    "FAMILLES: ordre canonique addition, soustraction, multiplication",
    FAMILLES.length === 3 &&
      FAMILLES[0] === "addition" &&
      FAMILLES[1] === "soustraction" &&
      FAMILLES[2] === "multiplication"
  );
  check(
    "paliersByFamille: découpage 3/2/2 des 7 paliers",
    paliersByFamille("addition").length === 3 &&
      paliersByFamille("soustraction").length === 2 &&
      paliersByFamille("multiplication").length === 2
  );
  check(
    "paliersByFamille: chaque palier appartient bien à sa famille",
    FAMILLES.every((op) =>
      paliersByFamille(op).every((p) => p.constraints.op === op)
    )
  );
  check(
    "resolvePalierForFamille: id connu de la famille → lui-même",
    resolvePalierForFamille("soustraction", "sous-emprunt").id ===
      "sous-emprunt"
  );
  check(
    "resolvePalierForFamille: id inconnu → premier palier de la famille",
    resolvePalierForFamille("multiplication", "fantome").id === "mult-1-chiffre"
  );
  check(
    "resolvePalierForFamille: id d'une AUTRE famille → réparé (jamais d'erreur)",
    resolvePalierForFamille("addition", "sous-emprunt").id ===
      "add-sans-retenue"
  );
  check(
    "resolvePalierForFamille: null → premier palier de la famille",
    resolvePalierForFamille("soustraction", null).id === "sous-sans-emprunt"
  );
  check(
    "familleOfPalier: les 7 paliers pointent leur famille, inconnu → addition",
    familleOfPalier("add-retenue") === "addition" &&
      familleOfPalier("sous-sans-emprunt") === "soustraction" &&
      familleOfPalier("mult-abstraite") === "multiplication" &&
      familleOfPalier("fantome") === "addition" &&
      familleOfPalier(null) === "addition"
  );

  // settingsFromRows — les cas de bord tranchés en review (3A).
  const vide = settingsFromRows([]);
  check(
    "settingsFromRows: table vide → addition, premier palier, activée",
    vide.familles.length === 1 &&
      vide.familles[0].op === "addition" &&
      vide.familles[0].palier === DEFAULT_PALIER_ID &&
      vide.serieSize === DEFAULT_SERIE_SIZE
  );
  const troisRows = [
    {
      palier: "mult-abstraite",
      serieSize: 5,
      skill: skillKeyOf("multiplication"),
    },
    { palier: "add-retenue", serieSize: 4, skill: skillKeyOf("addition") },
    { palier: "sous-emprunt", serieSize: 6, skill: skillKeyOf("soustraction") },
  ];
  const trois = settingsFromRows(troisRows);
  check(
    "settingsFromRows: 3 familles, ré-émises dans l'ordre canonique",
    trois.familles.map((f) => f.op).join(",") ===
      "addition,soustraction,multiplication"
  );
  check(
    "settingsFromRows: serieSize lue sur la 1re ligne canonique (addition)",
    trois.serieSize === 4
  );
  const sale = settingsFromRows([
    { palier: "add-retenue", serieSize: 3, skill: "calcul-pose" },
    { palier: "add-retenue", serieSize: 3, skill: "exotique" },
    {
      palier: "mult-abstraite",
      serieSize: 99,
      skill: skillKeyOf("soustraction"),
    },
  ]);
  check(
    "settingsFromRows: legacy non migrée et clé exotique IGNORÉES",
    sale.familles.length === 1 && sale.familles[0].op === "soustraction"
  );
  check(
    "settingsFromRows: palier d'une autre famille réparé + serieSize clampée",
    sale.familles[0].palier === "sous-sans-emprunt" &&
      sale.serieSize === MAX_SERIE_SIZE
  );

  // normalizeFamilySettings — le cache appareil ne crashe jamais l'enfant.
  const garbage = normalizeFamilySettings({ palier: "add-retenue" });
  check(
    "normalizeFamilySettings: ancien format de cache → défauts sûrs",
    garbage.familles.length === 1 && garbage.familles[0].op === "addition"
  );
  const normal = normalizeFamilySettings({
    familles: [
      { op: "multiplication", palier: "mult-1-chiffre" },
      { op: "multiplication", palier: "mult-1-chiffre" },
      { op: "addition", palier: "fantome" },
      { op: "licorne", palier: "add-retenue" },
    ],
    serieSize: 2,
  });
  check(
    "normalizeFamilySettings: dédup + ordre canonique + paliers réparés",
    normal.serieSize === 2 &&
      normal.familles.map((f) => `${f.op}:${f.palier}`).join(",") ===
        "addition:add-sans-retenue,multiplication:mult-1-chiffre"
  );

  // bridgeLegacySerie — RÉGRESSION CRITIQUE (2A/T4) : la série d'avant la
  // mise à jour survit, enrichie de sa famille dérivée du palier.
  const legacy = {
    index: 1,
    opsFingerprint: "soustraction:52:27",
    palierId: "sous-emprunt",
    perOp: [{ done: false, entries: { carries: [null], result: ["5"] } }],
    seed: 42,
    serieSize: 3,
  };
  const bridged = bridgeLegacySerie(legacy);
  check(
    "pont legacy: famille dérivée du palierId, état intact + champ famille",
    bridged !== null &&
      bridged.famille === "soustraction" &&
      bridged.state.famille === "soustraction" &&
      bridged.state.seed === 42 &&
      bridged.state.index === 1
  );
  check(
    "pont legacy: un champ famille déjà présent est respecté",
    bridgeLegacySerie({ ...legacy, famille: "addition" })?.famille ===
      "addition"
  );
  check(
    "pont legacy: une valeur méconnaissable → null (pas de fantôme)",
    bridgeLegacySerie(null) === null &&
      bridgeLegacySerie({ seed: 1 }) === null &&
      bridgeLegacySerie("calcul") === null
  );
  check(
    "pont legacy: un champ famille INVALIDE est re-dérivé du palierId",
    bridgeLegacySerie({ ...legacy, famille: "licorne" })?.famille ===
      "soustraction"
  );
  const nul = normalizeFamilySettings(null);
  const texte = normalizeFamilySettings("calcul");
  check(
    "normalizeFamilySettings: null ou non-objet → défauts sûrs (jamais de crash)",
    nul.familles.length === 1 &&
      nul.familles[0].op === "addition" &&
      nul.serieSize === DEFAULT_SERIE_SIZE &&
      texte.familles.length === 1 &&
      texte.familles[0].op === "addition"
  );
  const brouillon = normalizeFamilySettings({
    familles: ["addition", null, 7, { op: "soustraction", palier: 42 }],
    serieSize: "beaucoup",
  });
  check(
    "normalizeFamilySettings: entrées non-objet filtrées, palier non-string et serieSize sales réparés",
    brouillon.familles.map((f) => `${f.op}:${f.palier}`).join(",") ===
      "soustraction:sous-sans-emprunt" &&
      brouillon.serieSize === DEFAULT_SERIE_SIZE
  );
  check(
    "clés de rangement: une par famille + préfixe skill stable",
    serieStorageKeyOf("addition") === "calcul:serie:addition" &&
      LEGACY_SERIE_STATE_KEY === "calcul:serie" &&
      skillKeyOf("soustraction") === "calcul-pose:soustraction"
  );

  // isPalierOfFamille — le prédicat du refine zod (T7) : REFUSE, ne répare pas.
  check(
    "isPalierOfFamille: appartient / autre famille / inconnu / null",
    isPalierOfFamille("soustraction", "sous-emprunt") &&
      !isPalierOfFamille("addition", "sous-emprunt") &&
      !isPalierOfFamille("addition", "fantome") &&
      !isPalierOfFamille("addition", null)
  );

  // normalizeFamilySettings — la taille de série d'un vieux cache SURVIT
  // (red-team RT4) même quand aucune famille n'est reconnaissable.
  const vieuxCache = normalizeFamilySettings({
    palier: "mult-1-chiffre",
    serieSize: 5,
  });
  check(
    "normalizeFamilySettings: vieux format → défaut addition MAIS serieSize conservée",
    vieuxCache.familles.length === 1 &&
      vieuxCache.familles[0].op === "addition" &&
      vieuxCache.serieSize === 5
  );

  // isResumableSerie — le prédicat de l'état « sorti » (D-3A/F5), désormais
  // pur et golden-testé : chaque branche de refus.
  const palierS = resolvePalierForFamille("soustraction", "sous-sans-emprunt");
  const opsS = safeGenerateSerie(palierS, 77, 2);
  const resumable = {
    famille: "soustraction" as const,
    index: 1,
    opsFingerprint: fingerprintOps(opsS),
    palierId: palierS.id,
    perOp: opsS.map(() => ({
      done: false,
      entries: { carries: [null], result: ["4", null] },
    })),
    seed: 77,
    serieSize: 2,
  };
  check(
    "isResumableSerie: une série valide se reprend",
    isResumableSerie(resumable, "soustraction", palierS.id, 2)
  );
  check(
    "isResumableSerie: autre famille / autre palier / autre taille → refus",
    !(
      isResumableSerie(resumable, "addition", palierS.id, 2) ||
      isResumableSerie(resumable, "soustraction", "sous-emprunt", 2) ||
      isResumableSerie(resumable, "soustraction", palierS.id, 3)
    )
  );
  check(
    "isResumableSerie: série FINIE (index === size) → rangée, pas sortie",
    !isResumableSerie({ ...resumable, index: 2 }, "soustraction", palierS.id, 2)
  );
  check(
    "isResumableSerie: empreinte qui ne régénère pas → série fraîche",
    !isResumableSerie(
      { ...resumable, opsFingerprint: "corrompue" },
      "soustraction",
      palierS.id,
      2
    )
  );
  check(
    "isResumableSerie: null et perOp difforme → refus sans crash",
    !(
      isResumableSerie(null, "soustraction", palierS.id, 2) ||
      isResumableSerie(
        {
          ...resumable,
          perOp: [{ done: false, entries: { carries: [], result: [3] } }],
        } as never,
        "soustraction",
        palierS.id,
        2
      )
    )
  );
  check(
    "safeGenerateSerie: palier valide → série pleine, déterministe",
    safeGenerateSerie(palierS, 77, 2).length === 2 &&
      fingerprintOps(safeGenerateSerie(palierS, 77, 2)) === fingerprintOps(opsS)
  );
}

/* --------------------------------- Bilan --------------------------------- */

if (failures > 0) {
  console.error(`\n${failures} assertion(s) en échec.`);
  process.exit(1);
}
console.log("\nToutes les assertions operations passent.");
