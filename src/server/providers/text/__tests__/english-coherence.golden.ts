/**
 * ENGLISH-coherence assertion script (plan multilangue, phase 3) — le pendant
 * EN de story-coherence.golden.ts. Same standalone-runnable pattern:
 *   SKIP_ENV_VALIDATION=1 bun run src/server/providers/text/__tests__/english-coherence.golden.ts
 * (wired into `bun run test:coherence`). Exits non-zero on any failure.
 *
 * Ce que ces assertions verrouillent :
 *  - le BRANCHEMENT : lang === "en" → corpus anglais (system, prompt, schéma,
 *    validateurs) ; le défaut/"fr" reste le chemin historique (ses propres
 *    pins vivent dans story-coherence.golden.ts, INTOUCHÉS) ;
 *  - les substrings du prompt système et du prompt utilisateur EN (format,
 *    CONTINUITY, anti-tic, décrescendo, mustEnd, fil secret, corrections) ;
 *  - l'ORDRE DES CLÉS des schémas EN — identique aux schémas FR (l'ordre EST
 *    le JSON envoyé au modèle) ;
 *  - le scan WORD-BOUNDARY : « war » est pris, « warm » ne l'est JAMAIS —
 *    c'est LE contrat qui distingue le scan EN du scan FR par sous-chaîne ;
 *  - l'anti-tic EN (soft/softly/gentle/gently) : morphologie ancrée \b ;
 *  - les messages de validation EN (ré-injectés dans le prompt correctif —
 *    ils doivent être dans la langue de l'histoire) ;
 *  - le prompt d'ILLUSTRATION EN, épinglé byte-exact (avec et sans image de
 *    référence), et le défaut sans lang qui reste français.
 */

import {
  buildSegmentImagePrompt,
  type SegmentImagePromptContext,
} from "~/server/providers/image/segment-prompt";
import {
  ARC_SCHEMA,
  BEAT_SCHEMA,
  buildPrompt,
  buildSystem,
  coerceBeat,
  safetyProblems,
  scanForbidden,
  structureProblems,
} from "~/server/providers/text/dynamic";
import {
  ARC_SCHEMA_EN,
  BEAT_SCHEMA_EN,
  LANDING_BEAT_SCHEMA_EN,
  softnessTicCountEn,
} from "~/server/providers/text/english";
import type { DynamicBeat, GenerateBeatInput } from "~/server/providers/types";

let failures = 0;
function check(name: string, ok: boolean, detail?: string) {
  if (ok) {
    console.log(`✓ ${name}`);
  } else {
    failures += 1;
    console.error(`✗ ${name}${detail ? `\n  ${detail}` : ""}`);
  }
}

// ── Fixtures EN ──────────────────────────────────────────────────────────────

const HERO_NAME = "Léa";

const cleanBeat: DynamicBeat = {
  choices: ["Follow the little path", "Open the wooden door"],
  isFinal: false,
  paragraphs: [
    "Léa walks to the big tree.",
    "Then she finds a little door and smiles.",
  ],
  sceneHint: "a clearing at the foot of a big tree, late afternoon",
  title: undefined,
};

const beatInput: GenerateBeatInput = {
  customPrompt: undefined,
  doudous: [],
  elements: [{ label: "a magic key", promptHint: "a small golden key" }],
  heroes: [
    {
      imageHint: "a little girl with brown hair and a bright smile",
      label: HERO_NAME,
      promptHint: "Léa, a curious little girl",
    },
  ],
  history: [],
  lang: "en",
  mustEnd: false,
  place: {
    emoji: "",
    id: "jardin",
    label: "the garden",
    promptHint: "in grandpa's garden",
  },
  storyArc: "Léa wants to see the far side of the garden.",
};

// ── Système EN ───────────────────────────────────────────────────────────────

{
  const system = buildSystem("en");
  const attendus = [
    "Write in English, naturally.",
    "READING LEVEL",
    "sceneHint",
    "CONTINUITY: the sceneHint keeps the SAME time of",
    "STRICT rules",
    '"soft", "softly" or',
    "The surprise element is the THREAD of the story",
    "cuddly toy",
  ];
  for (const attendu of attendus) {
    check(`system EN contient : ${attendu}`, system.includes(attendu));
  }
  check(
    "system EN ne contient aucun fragment français",
    !(system.includes("Écris") || system.includes("héros"))
  );
}

// ── Prompt utilisateur EN ────────────────────────────────────────────────────

{
  const opening = buildPrompt(beatInput);
  check(
    "prompt EN (ouverture) : Hero + Setting + Surprise element",
    opening.includes("Hero: Léa, a curious little girl") &&
      opening.includes("Setting: the story takes place in grandpa's garden.") &&
      opening.includes("Surprise element: a small golden key.")
  );
  check(
    "prompt EN (ouverture) : fil secret + VERY FIRST part",
    opening.includes(
      "Story thread (secret, for you only — don't recite it, bring it to life):"
    ) && opening.includes("Write the VERY FIRST part of the story")
  );

  const history = [
    {
      chosenLabel: "Follow the little path",
      offered: ["Follow the little path", "Open the wooden door"] as [
        string,
        string,
      ],
      paragraphs: ["Léa walks to the big tree."],
      sceneHint: "a clearing at the foot of a big tree",
    },
  ];

  const suite = buildPrompt({ ...beatInput, history });
  check(
    "prompt EN (suite) : bloc historique complet",
    suite.includes("The story so far:") &&
      suite.includes("Part 1: Léa walks to the big tree.") &&
      suite.includes("→ scene: “a clearing at the foot of a big tree”") &&
      suite.includes(
        "→ choices offered: “Follow the little path” / “Open the wooden door”"
      ) &&
      suite.includes("→ the child chose: “Follow the little path”")
  );

  const fin = buildPrompt({ ...beatInput, history, mustEnd: true });
  check(
    "prompt EN (mustEnd) : bloc de fin",
    fin.includes("This is the LAST part: the story must END now.") &&
      fin.includes("MANDATORY: isFinal = true AND choices = null.") &&
      fin.includes("This is the last page of the book.")
  );

  const dernier = buildPrompt({ ...beatInput, history, remainingChoices: 1 });
  check(
    "prompt EN (décrescendo, dernier choix) : 2 sentences only",
    dernier.includes("this part offers the LAST choice of the story") &&
      dernier.includes("Write a short part: 2 sentences only.")
  );
  const avantDernier = buildPrompt({
    ...beatInput,
    history,
    remainingChoices: 2,
  });
  check(
    "prompt EN (décrescendo, avant-dernier) : the story is landing",
    avantDernier.includes("Only 2 choices are left before the end") &&
      avantDernier.includes(
        "The story is landing: write a slightly shorter part (2 sentences)."
      )
  );

  const corrige = buildPrompt(beatInput, ["The 2 choices must be different."]);
  check(
    "prompt EN (corrections) : bloc de reprise en anglais",
    corrige.includes("The previous attempt had these problems, fix them:") &&
      corrige.includes("- The 2 choices must be different.")
  );
}

// ── Ordre des clés des schémas (identique au FR) ─────────────────────────────

{
  const ordreFr = Object.keys(BEAT_SCHEMA.shape);
  const ordreEn = Object.keys(BEAT_SCHEMA_EN.shape);
  check(
    "schéma beat EN : même ordre de clés que le FR",
    JSON.stringify(ordreEn) === JSON.stringify(ordreFr),
    JSON.stringify(ordreEn)
  );
  check(
    "schéma landing EN : même ordre de clés",
    JSON.stringify(Object.keys(LANDING_BEAT_SCHEMA_EN.shape)) ===
      JSON.stringify(ordreFr)
  );
  check(
    "schéma arc EN : même ordre de clés que le FR",
    JSON.stringify(Object.keys(ARC_SCHEMA_EN.shape)) ===
      JSON.stringify(Object.keys(ARC_SCHEMA.shape))
  );
}

// ── Scan word-boundary (LE contrat du scan EN) ───────────────────────────────

check(
  "scan EN : « the war drums » est pris (\\bwar\\b)",
  scanForbidden("the war drums", "en") === "war"
);
check(
  "scan EN : « a warm evening » ne déclenche RIEN (war ⊄ warm)",
  scanForbidden("a warm evening by the fire", "en") === null
);
check(
  "scan EN : « window » ne déclenche pas « win »",
  scanForbidden("she looks out of the window", "en") === null
);
check(
  "scan EN : « the best path » est pris (enjeu)",
  scanForbidden("the best path", "en") === "best"
);
check(
  "scan EN : « well done » (deux mots) est pris",
  scanForbidden("Well done, little one!", "en") === "well done"
);
check(
  "scan FR par défaut inchangé : « charme » contient « arme »",
  scanForbidden("un pull plein de charme") === "arme"
);

// ── Anti-tic EN ──────────────────────────────────────────────────────────────

check(
  "tic EN : soft + gentle + softly = 3",
  softnessTicCountEn("A soft blanket, a gentle breeze, she walks softly.") === 3
);
check(
  "tic EN : « softness » ne compte pas (\\b)",
  softnessTicCountEn("the softness of the moss") === 0
);
check(
  "tic EN : « Soft. » compte 1 (casse)",
  softnessTicCountEn("A SOFT nest.") === 1
);

// ── Validateurs EN (messages anglais, ré-injectés dans le prompt) ────────────

{
  const problems = safetyProblems(
    {
      ...cleanBeat,
      paragraphs: ["A monster waits near the tree."],
    },
    HERO_NAME,
    "en"
  );
  check(
    "safety EN : monstre pris + héros non nommé, messages en anglais",
    problems.some((p) => p.includes("monster")) &&
      problems.some(
        (p) => p === `The hero must be called by name (${HERO_NAME}).`
      )
  );
}
{
  const problems = structureProblems(
    { ...cleanBeat, choices: ["Same", "same"] },
    false,
    false,
    "en"
  );
  check(
    "structure EN : choix identiques → message anglais",
    problems.includes("The 2 choices must be different.")
  );
}
{
  const longue = Array.from({ length: 20 }, () => "word").join(" ");
  const problems = structureProblems(
    { ...cleanBeat, paragraphs: [`Léa says ${longue}.`] },
    false,
    false,
    "en"
  );
  check(
    "structure EN : phrase trop longue → nudge lisibilité anglais",
    problems.some((p) => p.startsWith("Sentences too long"))
  );
}
{
  const coerced = coerceBeat(
    { ...cleanBeat, choices: null, isFinal: false },
    HERO_NAME,
    true,
    "en"
  );
  check(
    "coerce EN : bout final sûr récupéré (choices=null, isFinal=true)",
    coerced?.isFinal === true && coerced.choices === null
  );
  const refused = coerceBeat(
    { ...cleanBeat, paragraphs: ["A monster in the clearing."] },
    HERO_NAME,
    true,
    "en"
  );
  check("coerce EN : texte non sûr refusé (null)", refused === null);
}

// ── Prompt d'illustration EN, épinglé byte-exact ─────────────────────────────

{
  const story = {
    visualWorld: "late summer afternoon, golden light, clear sky",
  };
  const segment = {
    paragraphs: ["Léa walks to the big tree.", "Then she finds a little door."],
    sceneHint: "a clearing at the foot of a big tree, late afternoon",
  };
  const frozen: SegmentImagePromptContext = {
    doudous: [
      {
        imageHint: "a cream plush rabbit with long ears",
        label: "Bunny",
        promptHint: "a small plush rabbit",
      },
    ],
    heroes: [
      {
        imageHint: "a little girl with brown hair and a bright smile",
        label: "Léa",
        promptHint: "Léa, a curious little girl",
      },
    ],
    outfit: "Léa in a blue jumper and beige trousers",
    place: { label: "the garden", promptHint: "in grandpa's garden" },
  };

  check(
    "image EN (sans référence) : prompt épinglé byte-exact",
    buildSegmentImagePrompt(story, segment, false, frozen, "en") ===
      "Illustration for one part of a child's story, tender and reassuring. Léa walks to the big tree. Then she finds a little door. The scene: a clearing at the foot of a big tree, late afternoon Overall mood of the story (unless the scene says otherwise): late summer afternoon, golden light, clear sky. The characters' outfit, to keep IDENTICAL from one image to the next (unless the reference image already shows their clothes): Léa in a blue jumper and beige trousers. a little girl with brown hair and a bright smile With a cream plush rabbit with long ears, tenderly close to the child. Studio Ghibli style. No text in the image. No photorealistic faces. A calm, reassuring and wonder-filled mood, suited to a 5-year-old child.",
    buildSegmentImagePrompt(story, segment, false, frozen, "en")
  );
  check(
    "image EN (avec référence) : prompt épinglé byte-exact",
    buildSegmentImagePrompt(story, segment, true, frozen, "en") ===
      "Reuse EXACTLY the characters from the provided image (faces, hairstyles, clothes, proportions) and its style — but NOT its scenery or framing. Draw the place where the story is NOW (see “The scene” below), even if it no longer looks like the one in the provided image: Léa walks to the big tree. Then she finds a little door. The scene: a clearing at the foot of a big tree, late afternoon Overall mood of the story (unless the scene says otherwise): late summer afternoon, golden light, clear sky. The characters' outfit, to keep IDENTICAL from one image to the next (unless the reference image already shows their clothes): Léa in a blue jumper and beige trousers. a little girl with brown hair and a bright smile With a cream plush rabbit with long ears, tenderly close to the child. Studio Ghibli style. No text in the image. No photorealistic faces. A calm, reassuring and wonder-filled mood, suited to a 5-year-old child.",
    buildSegmentImagePrompt(story, segment, true, frozen, "en")
  );
  check(
    "image sans lang : le défaut reste FRANÇAIS (octets historiques)",
    buildSegmentImagePrompt(story, segment, false, frozen).startsWith(
      "Illustration pour un bout d'une histoire d'enfant, tendre et rassurante."
    )
  );
}

// ── Verdict ──────────────────────────────────────────────────────────────────

if (failures > 0) {
  console.error(`\n${failures} assertion(s) english-coherence en échec.`);
  process.exit(1);
}
console.log("\nENGLISH-COHERENCE OK: toutes les assertions passent.");
