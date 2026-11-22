/**
 * STORY-COHERENCE assertion script (the story-coherence feature).
 *
 * Pins the PURE logic added by the coherence work:
 *  - softness anti-tic counter + its NON-fatal structure nudge,
 *  - sceneHint scanned by the SAFETY validator (drives the illustration),
 *  - hidden story-arc ("fil rouge") prompt injection,
 *  - countdown ("remainingChoices") landing announcement,
 *  - landing DECRESCENDO (isLanding predicate, shorter landing schema,
 *    brevity prompt lines, NON-fatal sentence-count nudge),
 *  - coerceBeat preserving sceneHint / rejecting unsafe sceneHint,
 *  - system-prompt clauses (sceneHint instruction, anti-doux rule, fil clause),
 *  - sceneHint CONTINUITY: prior scenes rendered into the history block +
 *    system clause pinning same time/light/setting across beats.
 *
 * No test runner is configured in this app, so this is a standalone runnable
 * assertion (same pattern as prompt-identity.golden.ts):
 *   SKIP_ENV_VALIDATION=1 bun run src/server/providers/text/__tests__/story-coherence.golden.ts
 * (wired as `bun run test:coherence`). It exits non-zero on any failure.
 * NO network / DB / LLM calls — pure string logic only.
 */

import {
  ARC_SCHEMA,
  BEAT_SCHEMA,
  buildPrompt,
  buildSystem,
  coerceBeat,
  isLanding,
  LANDING_BEAT_SCHEMA,
  safeOutfitOrNull,
  safetyProblems,
  scanForbidden,
  softnessTicCount,
  structureProblems,
} from "~/server/providers/text/dynamic";
import type { DynamicBeat, GenerateBeatInput } from "~/server/providers/types";

let failures = 0;
let checks = 0;
function check(name: string, ok: boolean, detail?: string) {
  checks += 1;
  if (ok) {
    console.log(`✓ ${name}`);
  } else {
    failures += 1;
    console.error(`✗ ${name}${detail ? `\n  ${detail}` : ""}`);
  }
}

// ── Fixtures (safe wording: no forbidden/stakes substrings, short sentences) ──
const HERO_NAME = "Jules";

function cleanBeat(overrides: Partial<DynamicBeat> = {}): DynamicBeat {
  return {
    choices: ["Suivre le sentier", "Regarder le ruisseau"],
    isFinal: false,
    paragraphs: [
      "Jules marche vers le grand chêne.",
      "Puis il ramasse une jolie feuille.",
    ],
    sceneHint: "Jules sous un grand chêne, au matin.",
    ...overrides,
  };
}

function beatInput(
  overrides: Partial<GenerateBeatInput> = {}
): GenerateBeatInput {
  return {
    doudous: [],
    elements: [{ label: "une clé magique", promptHint: "une clé magique" }],
    heroes: [
      {
        imageHint: "un petit garçon aux cheveux blonds",
        label: HERO_NAME,
        promptHint: "Jules, un petit garçon curieux et malin.",
      },
    ],
    history: [],
    lang: "fr",
    mustEnd: false,
    place: {
      emoji: "🌲",
      id: "foret",
      label: "la forêt",
      promptHint: "dans une forêt paisible et lumineuse",
    },
    ...overrides,
  };
}

const HISTORY = [
  {
    chosenLabel: "Ouvrir la porte",
    offered: ["Ouvrir la porte", "Suivre le papillon"] as [string, string],
    paragraphs: ["Jules trouve une clé dorée.", "Alors il sourit."],
  },
];

const SCENE = "Jules devant la porte du jardin, fin d'après-midi dorée.";
const HISTORY_WITH_SCENE = [{ ...HISTORY[0], sceneHint: SCENE }];

// ── 1-3: softnessTicCount ────────────────────────────────────────────────────
check(
  "tic: plain text without softness words counts 0",
  softnessTicCount("Jules regarde la lune tranquille.") === 0
);
check(
  "tic: doux / douce / douces / doucement each counted (4 total)",
  softnessTicCount(
    "Un pont doux, une nuit douce, des mousses douces, il avance doucement."
  ) === 4
);
check(
  "tic: word-boundary safe (Douze douceurs au redoux = 0) and case-insensitive (DOUX = 1)",
  softnessTicCount("Douze douceurs au redoux.") === 0 &&
    softnessTicCount("Un nuage DOUX.") === 1
);

// ── 4-8: safetyProblems (sceneHint now scanned) ──────────────────────────────
check(
  "safety: clean beat with clean sceneHint has zero problems",
  safetyProblems(cleanBeat(), HERO_NAME).length === 0,
  JSON.stringify(safetyProblems(cleanBeat(), HERO_NAME))
);
check(
  "safety: forbidden term ONLY in sceneHint is caught (drives the image)",
  safetyProblems(
    cleanBeat({ sceneHint: "Un monstre près du chêne." }),
    HERO_NAME
  ).some((p) => p.includes("Mots interdits"))
);
check(
  "safety: stakes term ONLY in sceneHint is caught",
  safetyProblems(
    cleanBeat({ sceneHint: "Bravo, une belle clairière." }),
    HERO_NAME
  ).some((p) => p.includes("enjeu"))
);
check(
  "safety: undefined sceneHint does not crash and stays clean",
  safetyProblems(cleanBeat({ sceneHint: undefined }), HERO_NAME).length === 0
);
check(
  "safety: hero named only in sceneHint still fails the named-hero rule (paragraphs-only)",
  safetyProblems(
    cleanBeat({
      paragraphs: ["Il marche vers le grand chêne."],
      sceneHint: "Jules sous le chêne.",
    }),
    HERO_NAME
  ).some((p) => p.includes("prénom"))
);

// ── 9-11: structureProblems anti-tic nudge ───────────────────────────────────
check(
  "structure: a single « doux » is tolerated (no tic problem)",
  !structureProblems(
    cleanBeat({ paragraphs: ["Jules caresse le tissu doux."] }),
    false,
    false
  ).some((p) => p.includes("doux / douce / doucement"))
);
check(
  "structure: two softness words (paragraph + choice label) trigger the nudge with the count",
  structureProblems(
    cleanBeat({
      choices: ["Avancer doucement", "Regarder le ruisseau"],
      paragraphs: ["Jules caresse le tissu doux."],
    }),
    false,
    false
  ).some((p) => p.includes("(2 fois)"))
);
check(
  "structure: softness words in sceneHint alone do NOT trigger the tic nudge (text-only scope)",
  !structureProblems(
    cleanBeat({ sceneHint: "Une mousse douce et un coussin doux." }),
    false,
    false
  ).some((p) => p.includes("doux / douce / doucement"))
);

// ── Landing decrescendo: sentence-count nudge (NON-fatal, landing only) ──────
const FOUR_SENTENCES = [
  "Jules marche vers le grand chêne. Puis il ramasse une jolie feuille.",
  "Alors il regarde le ciel. Enfin il sourit.",
];
check(
  "structure: landing beat with 4 sentences triggers the decrescendo nudge",
  structureProblems(
    cleanBeat({ paragraphs: FOUR_SENTENCES }),
    false,
    true
  ).some((p) => p.includes("raccourcis ce bout"))
);
check(
  "structure: landing beat with 3 sentences is tolerated (retry only at 4+)",
  !structureProblems(
    cleanBeat({
      paragraphs: [
        "Jules marche vers le grand chêne.",
        "Puis il ramasse une jolie feuille. Alors il sourit.",
      ],
    }),
    false,
    true
  ).some((p) => p.includes("raccourcis ce bout"))
);
check(
  "structure: NON-landing beat with 4 sentences gets no decrescendo nudge",
  !structureProblems(
    cleanBeat({ paragraphs: FOUR_SENTENCES }),
    false,
    false
  ).some((p) => p.includes("raccourcis ce bout"))
);

// ── isLanding predicate + per-phase schemas ──────────────────────────────────
check(
  "landing: mustEnd → landing; last 2 choices (with history) → landing",
  isLanding(beatInput({ history: HISTORY, mustEnd: true })) &&
    isLanding(beatInput({ history: HISTORY, remainingChoices: 2 })) &&
    isLanding(beatInput({ history: HISTORY, remainingChoices: 1 }))
);
check(
  "landing: early beats and the opening beat are NOT landing",
  !(
    isLanding(beatInput({ history: HISTORY, remainingChoices: 3 })) ||
    isLanding(beatInput({ history: HISTORY })) ||
    isLanding(beatInput({ remainingChoices: 1 }))
  )
);
check(
  "landing schema caps paragraphs at 2; normal schema still allows 3",
  (() => {
    const three = {
      choices: null,
      isFinal: true,
      paragraphs: ["Un premier pas.", "Un deuxième pas.", "Un troisième pas."],
      sceneHint: "Jules sous le chêne.",
    };
    const two = { ...three, paragraphs: three.paragraphs.slice(0, 2) };
    return (
      !LANDING_BEAT_SCHEMA.safeParse(three).success &&
      LANDING_BEAT_SCHEMA.safeParse(two).success &&
      BEAT_SCHEMA.safeParse(three).success
    );
  })()
);

// ── 12-17: buildPrompt — story arc + countdown ───────────────────────────────
const ARC =
  "Jules veut voir le sommet. La clé ouvre la cabane perchée. Il rentre avec un joli souvenir.";
check(
  "prompt: storyArc injected with the secret 'Fil de l'histoire' preamble",
  (() => {
    const p = buildPrompt(beatInput({ history: HISTORY, storyArc: ARC }));
    return p.includes("Fil de l'histoire (secret") && p.includes(ARC);
  })()
);
check(
  "prompt: no storyArc → no 'Fil de l'histoire' block",
  !buildPrompt(beatInput({ history: HISTORY })).includes("Fil de l'histoire")
);
check(
  "prompt: remainingChoices=2 → 'Il ne reste que 2 choix' countdown",
  buildPrompt(beatInput({ history: HISTORY, remainingChoices: 2 })).includes(
    "Il ne reste que 2 choix"
  )
);
check(
  "prompt: remainingChoices=1 → 'La fin est proche' announcement",
  buildPrompt(beatInput({ history: HISTORY, remainingChoices: 1 })).includes(
    "La fin est proche"
  )
);
check(
  "prompt: remainingChoices=3 or undefined → no countdown line",
  (() => {
    const p3 = buildPrompt(
      beatInput({ history: HISTORY, remainingChoices: 3 })
    );
    const pU = buildPrompt(beatInput({ history: HISTORY }));
    const has = (s: string) =>
      s.includes("La fin est proche") || s.includes("Il ne reste que");
    return !(has(p3) || has(pU));
  })()
);
check(
  "prompt: mustEnd wins — final instructions, no countdown even at remaining=0",
  (() => {
    const p = buildPrompt(
      beatInput({ history: HISTORY, mustEnd: true, remainingChoices: 0 })
    );
    return (
      p.includes("C'est le DERNIER bout") &&
      !p.includes("La fin est proche") &&
      !p.includes("Il ne reste que")
    );
  })()
);
check(
  "prompt: opening beat (empty history) → 'TOUT PREMIER bout', countdown never rendered",
  (() => {
    const p = buildPrompt(beatInput({ remainingChoices: 1 }));
    return p.includes("TOUT PREMIER bout") && !p.includes("La fin est proche");
  })()
);

// ── buildPrompt — decrescendo brevity lines on the landing beats ─────────────
check(
  "prompt: remainingChoices=2 countdown also asks for a shorter beat",
  buildPrompt(beatInput({ history: HISTORY, remainingChoices: 2 })).includes(
    "L'histoire atterrit : écris un bout un peu plus court (2 phrases)."
  )
);
check(
  "prompt: remainingChoices=1 announcement asks for 2 phrases seulement",
  buildPrompt(beatInput({ history: HISTORY, remainingChoices: 1 })).includes(
    "2 phrases seulement"
  )
);
check(
  "prompt: mustEnd final block asks the last page to stay very short",
  buildPrompt(beatInput({ history: HISTORY, mustEnd: true })).includes(
    "Reste très court : 2 phrases simples"
  )
);
check(
  "prompt: opening beat gets NO brevity line",
  (() => {
    const p = buildPrompt(beatInput({ remainingChoices: 1 }));
    return !(
      p.includes("2 phrases seulement") || p.includes("L'histoire atterrit")
    );
  })()
);

// ── buildPrompt — sceneHint continuity (prior scenes rendered) ───────────────
check(
  "prompt: history sceneHint rendered as a '→ scène' line between beat text and choices",
  (() => {
    const p = buildPrompt(beatInput({ history: HISTORY_WITH_SCENE }));
    const iBeat = p.indexOf("Bout 1 :");
    const iScene = p.indexOf(`  → scène : « ${SCENE} »`);
    const iChoices = p.indexOf("  → choix proposés :");
    return iBeat !== -1 && iScene > iBeat && iChoices > iScene;
  })()
);
check(
  "prompt: history entry WITHOUT sceneHint (older segment) omits the scène line",
  !buildPrompt(beatInput({ history: HISTORY })).includes("→ scène")
);

// ── buildSystem — new clauses present ────────────────────────────────────────
check(
  "system: sceneHint instruction + anti-doux rule + fil-de-l'histoire clause all present",
  (() => {
    const s = buildSystem("fr");
    return (
      s.includes("sceneHint") &&
      s.includes("VARIE les mots du réconfort") &&
      s.includes("Fil de l'histoire")
    );
  })()
);
check(
  "system: sceneHint CONTINUITÉ clause (same time/light unless the story moved; decor follows the story)",
  (() => {
    const s = buildSystem("fr");
    return (
      s.includes("CONTINUITÉ") &&
      s.includes("MÊME") &&
      s.includes("changer de lieu ou de moment")
    );
  })()
);

// ── 19-20: coerceBeat — sceneHint carried / unsafe sceneHint rejected ────────
check(
  "coerce: forced-final coercion strips choices, keeps sceneHint; non-final salvage keeps it too",
  (() => {
    const src = cleanBeat();
    const final = coerceBeat(src, HERO_NAME, true);
    const salvaged = coerceBeat(
      cleanBeat({ isFinal: false }),
      HERO_NAME,
      false
    );
    if (!(final && salvaged)) {
      return false;
    }
    return (
      final.isFinal &&
      final.choices === null &&
      final.sceneHint === src.sceneHint &&
      salvaged.sceneHint === src.sceneHint
    );
  })()
);
check(
  "coerce: a scary sceneHint makes the beat un-coercible (returns null)",
  coerceBeat(
    cleanBeat({ sceneHint: "Un monstre dans la clairière." }),
    HERO_NAME,
    true
  ) === null
);

// ── scanForbidden — the outfit / arc safety-scan primitive ───────────────────
// The frozen outfit is scanned with this same over-blocking substring scan; a
// hit nulls the outfit (drops the image line) instead of crashing. These pin
// the primitive that drives that nulling.
check(
  "scanForbidden: a clean wardrobe sentence is safe (null)",
  scanForbidden(
    "Jules en pull bleu et pantalon beige ; Mona en veste verte"
  ) === null
);
check(
  "scanForbidden: a still-forbidden term is caught (couteau kept after épée removal)",
  scanForbidden("Jules tient un couteau") === "couteau"
);
check(
  "scanForbidden: a stakes term is caught too (same list as arc/visualWorld)",
  scanForbidden("Bravo, la belle tenue !") !== null
);
check(
  "scanForbidden: over-blocks by design (substring): 'charme' matches 'arme'",
  scanForbidden("un pull plein de charme") === "arme"
);

// ── outfit safety ISOLATION (SEV-1): a dirty outfit nulls ONLY itself ─────────
// Mirrors generateStoryArc's exact composition: arc + visualWorld are scanned
// TOGETHER (outfit is NOT in that string), the outfit is scanned SEPARATELY via
// safeOutfitOrNull. So an unsafe wardrobe must NOT drop the arc/visualWorld.
check(
  "safeOutfitOrNull: a clean wardrobe is kept verbatim",
  safeOutfitOrNull("Jules en pull bleu ; Léa en robe jaune") ===
    "Jules en pull bleu ; Léa en robe jaune"
);
check("safeOutfitOrNull: empty → null", safeOutfitOrNull("") === null);
check(
  "isolation: a forbidden word in the OUTFIT nulls the outfit but leaves arc+visualWorld intact",
  (() => {
    const arc = "Jules cherche le sommet paisible et rentre content.";
    const visualWorld = "matin d'été, lumière dorée, ciel dégagé.";
    const outfit = "Jules tient un couteau"; // forbidden term ONLY in outfit
    // The arc/visualWorld scan must NOT see the outfit (survives → null hit).
    const arcHit = scanForbidden(`${arc}\n${visualWorld}`);
    return arcHit === null && safeOutfitOrNull(outfit) === null;
  })()
);

// L'ordre des clés zod EST l'ordre des propriétés du schéma JSON envoyé au
// modèle (le récit d'abord) — un tri de formatage ne doit jamais le réordonner.
check(
  "schéma beat : ordre des propriétés épinglé (title → paragraphs → choices → isFinal → sceneHint)",
  JSON.stringify(Object.keys(BEAT_SCHEMA.shape)) ===
    JSON.stringify(["title", "paragraphs", "choices", "isFinal", "sceneHint"])
);
check(
  "schéma beat (landing) : même ordre de propriétés",
  JSON.stringify(Object.keys(LANDING_BEAT_SCHEMA.shape)) ===
    JSON.stringify(["title", "paragraphs", "choices", "isFinal", "sceneHint"])
);
check(
  "schéma arc : ordre des propriétés épinglé (arc → visualWorld → outfit)",
  JSON.stringify(Object.keys(ARC_SCHEMA.shape)) ===
    JSON.stringify(["arc", "visualWorld", "outfit"])
);

if (failures > 0) {
  console.error(`\nCOHERENCE FAILED: ${failures} check(s).`);
  process.exit(1);
}
console.log(
  `\nCOHERENCE OK: ${checks} checks passed (validators + prompt builders).`
);
