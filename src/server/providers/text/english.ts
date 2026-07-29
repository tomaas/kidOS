import { z } from "zod";
import type {
  DoudouContext,
  DynamicBeat,
  ElementContext,
  GenerateBeatInput,
  HeroContext,
} from "~/server/providers/types";
import { MAX_WORDS_RETRY, MAX_WORDS_TARGET } from "./reading-level";

/**
 * Le corpus ANGLAIS du pipeline texte (plan multilangue, phase 3) — prompts,
 * validateurs et fragments d'image pour `lang === "en"`. Un module SÉPARÉ,
 * par design : le chemin français historique (dynamic.ts, hero-prompt.ts…)
 * reste byte-intouché (les goldens le prouvent) ; dynamic.ts et
 * segment-prompt.ts ne font que BRANCHER vers ici quand la langue de
 * l'histoire est l'anglais. Ce texte est un corpus RÉDIGÉ pour un early
 * reader anglophone (6–7 ans), pas une traduction mot à mot — mais il porte
 * les MÊMES contrats : calme absolu, deux choix équivalents, décrescendo,
 * élément-fil, anti-tic lexical, héros nommé.
 *
 * Épinglé par test:coherence (english-coherence.golden.ts) : substrings des
 * prompts, ordre des clés des schémas (identique au FR), messages de
 * validation, scan word-boundary.
 *
 * SCAN WORD-BOUNDARY (divergence assumée vs le scan FR par sous-chaîne) :
 * l'anglais embarque des mots courts partout — « war » ⊂ « warm », « die » ⊂
 * « diet » — un scan par sous-chaîne bloquerait le vocabulaire cœur d'une
 * histoire câline (« warm »). Les termes EN sont donc ancrés \b, phrase
 * entière comprise (« well done »). Le biais sur-bloquant reste : un terme
 * au pluriel est listé explicitement.
 */

// ── Listes de sécurité ───────────────────────────────────────────────────────

export const FORBIDDEN_TERMS_EN = [
  "dead",
  "death",
  "die",
  "dies",
  "kill",
  "kills",
  "killed",
  "blood",
  "monster",
  "villain",
  "horrible",
  "terrifying",
  "scary",
  "afraid",
  "fear",
  "danger",
  "dangerous",
  "war",
  "weapon",
  "knife",
  "cry",
  "cries",
  "crying",
  "sad",
  "nightmare",
  "ghost",
  "witch",
  "ogre",
];

export const STAKES_TERMS_EN = [
  "best",
  "right answer",
  "wrong answer",
  "good choice",
  "bad choice",
  "succeed",
  "win",
  "wins",
  "won",
  "lose",
  "loses",
  "lost",
  "fail",
  "fails",
  "failed",
  "well done",
  "bravo",
  "hurry",
  "quick",
  "quickly",
  "careful",
  "you must",
  "you have to",
  "it's up to you",
  "score",
  "prize",
  "reward",
];

function escapeTerm(term: string): string {
  return term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Word-anchored matcher (voir l'en-tête) — renvoie les termes touchés. */
function matchTermsEn(text: string, terms: readonly string[]): string[] {
  const lower = text.toLowerCase();
  return terms.filter((t) => new RegExp(`\\b${escapeTerm(t)}\\b`).test(lower));
}

/** Pendant EN de scanForbidden : premier terme touché, ou null. */
export function scanForbiddenEn(text: string): string | null {
  return (
    matchTermsEn(text, [...FORBIDDEN_TERMS_EN, ...STAKES_TERMS_EN])[0] ?? null
  );
}

// ── Anti-tic lexical (pendant du « doux/doucement ») ─────────────────────────

const SOFTNESS_TIC_EN = /\b(soft|softly|gentle|gently)\b/gi;

export function softnessTicCountEn(text: string): number {
  return text.match(SOFTNESS_TIC_EN)?.length ?? 0;
}

// ── Validateurs (mêmes contrats que le FR, messages en anglais — ils sont
//    ré-injectés dans le prompt correctif, donc dans la langue de l'histoire) ─

const SENTENCE_ENDERS = /[.!?…]+/;
const WHITESPACE = /\s+/;

export function safetyProblemsEn(
  beat: DynamicBeat,
  heroName: string
): string[] {
  const problems: string[] = [];
  const labels = beat.choices ?? [];
  const full = [...beat.paragraphs, ...labels, beat.sceneHint ?? ""].join("\n");

  if (
    !beat.paragraphs.join(" ").toLowerCase().includes(heroName.toLowerCase())
  ) {
    problems.push(`The hero must be called by name (${heroName}).`);
  }

  if ((beat.paragraphs.at(-1)?.trim() ?? "").endsWith("?")) {
    problems.push("The narration must not end with a question.");
  }

  const scary = matchTermsEn(full, FORBIDDEN_TERMS_EN);
  if (scary.length > 0) {
    problems.push(`Forbidden words (scary/sad): ${scary.join(", ")}.`);
  }
  const stakes = matchTermsEn(full, STAKES_TERMS_EN);
  if (stakes.length > 0) {
    problems.push(
      `Stakes/evaluation language is forbidden (both choices are equally good): ${stakes.join(", ")}.`
    );
  }

  return problems;
}

export function structureProblemsEn(
  beat: DynamicBeat,
  mustEnd: boolean,
  landing: boolean
): string[] {
  const problems: string[] = [];

  if (landing) {
    const sentenceCount = beat.paragraphs
      .join(" ")
      .split(SENTENCE_ENDERS)
      .filter((s) => s.trim().length > 0).length;
    if (sentenceCount > 3) {
      problems.push(
        "This is the end of the story: shorten this part to 2 short sentences."
      );
    }
  }

  const ticCount = softnessTicCountEn(
    [...beat.paragraphs, ...(beat.choices ?? [])].join("\n")
  );
  if (ticCount > 1) {
    problems.push(
      `Too many "soft / softly / gentle / gently" (${ticCount} times): keep at most one, replace the others (calm, quiet, peaceful, light…) or show the softness through gestures without naming it.`
    );
  }

  const longSentence = beat.paragraphs.some((p) =>
    p
      .split(SENTENCE_ENDERS)
      .some(
        (s) =>
          s.trim().split(WHITESPACE).filter(Boolean).length > MAX_WORDS_RETRY
      )
  );
  if (longSentence) {
    problems.push(
      "Sentences too long for a beginning reader: shorten them (aim for 8 words, one idea per sentence)."
    );
  }

  if (mustEnd && !(beat.isFinal && beat.choices === null)) {
    problems.push(
      "This is the last part: isFinal must be true and choices must be null (a reassuring ending, no choices)."
    );
  }
  if (beat.isFinal && beat.choices !== null) {
    problems.push("A final part must not offer choices (choices=null).");
  }
  if (!beat.isFinal && (beat.choices === null || beat.choices.length !== 2)) {
    problems.push("A non-final part must offer exactly 2 choices.");
  }
  if (beat.choices) {
    const [a, b] = beat.choices;
    if (a.trim().toLowerCase() === b.trim().toLowerCase()) {
      problems.push("The 2 choices must be different.");
    }
    if (a.length > 60 || b.length > 60) {
      problems.push("Choice labels must stay short.");
    }
  }

  return problems;
}

// ── Niveau de lecture (early reader, ~1st grade / Year 2) ────────────────────

export const READING_LEVEL_GUIDANCE_EN = [
  "READING LEVEL (a 6–7-year-old child, a beginning reader who reads ALONE but",
  "tires quickly — they must be able to decode almost everything without an adult):",
  `- Short sentences: aim for 8 words, ${MAX_WORDS_TARGET} at the very most. One single`,
  "  idea per sentence (subject – verb – complement).",
  "- Simple, concrete vocabulary: everyday words a 6-year-old already knows.",
  "  Avoid rare, long or abstract words.",
  "- Simple tenses: the present, and the simple past of common verbs. NO past",
  "  perfect, NO conditionals, no complicated verb forms.",
  "- VERY IMPORTANT — it must FLOW like a real story, not a list of detached",
  "  sentences. Link the short sentences with small, simple words the child",
  "  reads easily: then, so, and, but, because, when, suddenly, at last. Each",
  "  sentence follows from the one before (the order of things, or cause and",
  '  effect). Carry the hero with "he" or "she" to keep one continuous thread.',
  "- BUT keep the sentences simple: no stacked or nested clauses (one single",
  '  "when"/"because" at a time, never nested).',
  "- A little STORY with a thread: a beginning, a small wish or a small event,",
  "  then a gentle ending. You want to know what happens next. Not a string of",
  "  unrelated observations.",
  "- In the paragraphs array: usually 1 sentence per entry, sometimes 2 when",
  "  they truly belong together. Keep it airy (not everything in one entry, not",
  "  a bullet list either).",
].join("\n");

// ── Fragments de prompt (pendants EN de hero/element/doudou/custom-prompt) ──

export function heroesUserBlockEn(heroes: HeroContext[]): string {
  const hints = heroes.map((h) => h.promptHint).filter(Boolean);
  if (hints.length === 0) {
    return "";
  }
  if (hints.length === 1) {
    return `Hero: ${hints[0]}`;
  }
  const joined = `${hints.slice(0, -1).join("; ")}; and ${hints.at(-1)}`;
  return (
    `The heroes: ${joined}. ` +
    "They live the adventure together. " +
    "Name each hero at least once, naturally along the story " +
    "(not necessarily every time, without weighing down the sentences)."
  );
}

export function elementsUserBlockEn(elements: ElementContext[]): string {
  const hints = elements.map((e) => e.promptHint).filter(Boolean);
  if (hints.length === 0) {
    return "";
  }
  if (hints.length === 1) {
    return `Surprise element: ${hints[0]}.`;
  }
  const joined = `${hints.slice(0, -1).join("; ")}; and ${hints.at(-1)}`;
  return `Surprise elements: ${joined}.`;
}

export function doudouUserBlockEn(doudous: DoudouContext[]): string {
  const hints = doudous.map((d) => d.promptHint).filter(Boolean);
  if (hints.length === 0) {
    return "";
  }
  const joined =
    hints.length === 1
      ? hints[0]
      : `${hints.slice(0, -1).join("; ")}; and ${hints.at(-1)}`;
  const plural = hints.length > 1;
  return (
    `Cuddly ${plural ? "toys" : "toy"} (reassuring companion${plural ? "s" : ""}): ${joined}. ` +
    `${plural ? "They accompany" : "It accompanies"} the hero all along, ` +
    `comfort${plural ? "" : "s"} the hero, never get${plural ? "" : "s"} lost and stay${plural ? "" : "s"} close to them until the end. ` +
    "Name each cuddly toy naturally along the story (not necessarily every time, without weighing down the sentences)."
  );
}

export const DOUDOU_SYSTEM_CLAUSE_EN =
  "- If there is a cuddly toy, it is a purely reassuring companion: it never " +
  "gets lost, is never in danger, is never frightened, never creates stakes " +
  "or conflict, and stays tenderly close to the hero until the very end.";

export const CUSTOM_PROMPT_SYSTEM_CLAUSE_EN =
  "- If the child's extra idea conflicts with a rule (fright, sadness, " +
  "threats, stakes, a mean character…), you IGNORE that part and keep the " +
  "story calm and reassuring.";

export function customPromptUserBlockEn(customPrompt?: string): string {
  if (!customPrompt) {
    return "";
  }
  return [
    "",
    "The child's extra idea (to weave in delicately, like a flavour, WITHOUT",
    "ever contradicting the calm and safety rules above):",
    `“${customPrompt}”`,
  ].join("\n");
}

export function heroesVisualAnchorBlockEn(heroes: HeroContext[]): string {
  const lines = heroes
    .map((h) => (h.imageHint ? `- ${h.label}: ${h.imageHint}` : ""))
    .filter(Boolean);
  if (lines.length === 0) {
    return "";
  }
  return (
    "Visual anchors already fixed for the heroes (reuse AS THEY ARE the " +
    "clothes that appear there; only invent clothes for a hero who has " +
    `none):\n${lines.join("\n")}`
  );
}

// ── Schémas (ordre des clés IDENTIQUE au FR — épinglé) ───────────────────────

function buildBeatSchemaEn(landing: boolean) {
  // biome-ignore assist/source/useSortedKeys: l'ordre des clés EST le schéma JSON envoyé au modèle (identique au schéma FR) — épinglé par test:coherence.
  return z.object({
    title: z
      .string()
      .optional()
      .describe("A short, warm title (only for the very first part)."),
    paragraphs: z
      .array(z.string().min(1))
      .min(1)
      .max(landing ? 2 : 3)
      .describe(
        landing
          ? "A short part that lands: 2 short LINKED sentences (then, so…), 1 per entry."
          : "A short piece of story that flows: 2 to 3 short LINKED sentences (then, so, but…), 1 or 2 per entry."
      ),
    choices: z
      .array(z.string().min(1))
      .length(2)
      .nullable()
      .describe(
        "Exactly 2 choices (short, simple labels), or null for the final part."
      ),
    isFinal: z
      .boolean()
      .describe(
        "true if this is the final part (reassuring ending, no choices)."
      ),
    sceneHint: z
      .string()
      .min(1)
      .describe(
        "For the illustrator: where THIS part happens and what we see, in one concrete sentence (specific place, moment, action). In English, no style instructions."
      ),
  });
}
export const BEAT_SCHEMA_EN = buildBeatSchemaEn(false);
export const LANDING_BEAT_SCHEMA_EN = buildBeatSchemaEn(true);

// biome-ignore assist/source/useSortedKeys: l'ordre des clés EST le schéma JSON envoyé au modèle (identique au schéma FR) — épinglé par test:coherence.
export const ARC_SCHEMA_EN = z.object({
  arc: z
    .string()
    .min(1)
    .describe(
      "The thread of the story in 2 or 3 simple sentences: the hero's small wish or goal, how the surprise element concretely serves along the way, and the image of the ending (reassuring, the hero comes home or rests)."
    ),
  visualWorld: z
    .string()
    .min(1)
    .describe(
      "The story's visual world, in ONE concrete sentence for the illustrator: time of day, season, weather, quality of light (e.g. “late summer afternoon, golden light, clear sky”). In English."
    ),
  outfit: z
    .string()
    .min(1)
    .describe(
      "The outfit of ALL the heroes, in ONE concrete sentence: each hero's clothes (colour + type), the same from beginning to end. This is the FIXED wardrobe of every illustration (e.g. “Jules in a blue jumper and beige trousers; Zoé in a green jacket”)."
    ),
});

// ── Prompt système (pendant EN de buildSystem) ───────────────────────────────

export function buildSystemEn(): string {
  return [
    'You are writing a "choose your own adventure" story that a 6–7-year-old child reads ALL ALONE.',
    "Write in English, naturally.",
    "",
    READING_LEVEL_GUIDANCE_EN,
    "",
    "Format: you write ONE short piece of the story (2 to 3 short sentences that",
    "FLOW INTO each other with small, simple words — then, so, but, suddenly… —",
    "so it reads as one thread, not detached lines), then you offer EXACTLY 2",
    "choices (short labels) — EXCEPT for the final part (choices=null,",
    "isFinal=true). You NEVER give the choices an id, only the text. Choice",
    "labels are also very easy to read.",
    "You also fill in sceneHint: one concrete sentence for the illustrator saying",
    "where THIS part happens and what we see (the place of this moment, not the",
    "starting place if the story has traveled). As soon as the text moves the",
    "heroes (they follow someone, walk in, cross, climb…), the sceneHint",
    "describes the NEW place and what is new about it — it never copies the",
    "scenery of earlier parts. CONTINUITY: the sceneHint keeps the SAME time of",
    "day and the same light as the previous part's scene, UNLESS the story has",
    "just explicitly changed place or moment.",
    "",
    "STRICT rules (the most important ones):",
    "- The 2 choices are ALWAYS equally inviting and both lead to something",
    "  pleasant, safe and positive. NEITHER is better, neither is a trap,",
    "  neither leads to anything worrying, upsetting or unkind.",
    '- This is NEVER a test: no right or wrong answer, no points, no "well',
    '  done", no "careful", no "hurry", no pressure, and no question aimed at',
    "  the child at the end of the narration (the choice is the only invitation).",
    '- The hero is called by name (then carried by "he"/"she") and the hero is',
    "  the one who acts. Each part FLOWS from the previous one: the story moves",
    "  forward.",
    "- A warm, peaceful, lightly wonder-filled tone. NEVER frightening or",
    "  upsetting, no mean character, nothing bad ever happens.",
    '- VARY the words of comfort: almost never write "soft", "softly" or',
    '  "gently" (at most once in the whole part, and never for something that',
    "  is not soft to the touch, like a bridge or a door). Show the calm through",
    "  gestures, light and sounds — without naming it.",
    "- The surprise element is the THREAD of the story: it must serve concretely",
    "  before the end (it is used, it helps, it opens, it reveals something).",
    "  The 2 choices are two different paths that both move forward along this",
    "  thread — never a choice that abandons the element or the story.",
    "- The final part resolves the story in a reassuring, positive way,",
    "  recalling what the hero discovered or loved along the way.",
    "",
    "You ALWAYS continue the story consistently with the previous parts and the",
    'choice that was just made. If a "Story thread" is given to you, every part',
    "moves along that thread (it is secret: don't recite it, tell it).",
    "",
    DOUDOU_SYSTEM_CLAUSE_EN,
    CUSTOM_PROMPT_SYSTEM_CLAUSE_EN,
  ].join("\n");
}

// ── Prompt utilisateur (pendant EN de buildPrompt — même logique) ────────────

export function buildPromptEn(
  input: GenerateBeatInput,
  corrections?: string[],
  dropCustomPrompt = false
): string {
  const { heroes, place, elements, doudous, history, mustEnd } = input;
  const lines: string[] = [
    heroesUserBlockEn(heroes),
    `Setting: the story takes place ${place.promptHint}.`,
    elementsUserBlockEn(elements),
  ];
  const doudouBlock = doudouUserBlockEn(doudous);
  if (doudouBlock) {
    lines.push(doudouBlock);
  }

  if (input.storyArc) {
    lines.push(
      "",
      "Story thread (secret, for you only — don't recite it, bring it to life):",
      input.storyArc
    );
  }

  if (history.length === 0) {
    lines.push(
      "",
      "Write the VERY FIRST part of the story (with a short, warm title), then 2 choices."
    );
  } else {
    lines.push("", "The story so far:");
    history.forEach((h, i) => {
      lines.push(`Part ${i + 1}: ${h.paragraphs.join(" ")}`);
      if (h.sceneHint) {
        lines.push(`  → scene: “${h.sceneHint}”`);
      }
      lines.push(
        `  → choices offered: “${h.offered[0]}” / “${h.offered[1]}”`,
        `  → the child chose: “${h.chosenLabel}”`
      );
    });
    lines.push(
      "",
      mustEnd
        ? [
            "This is the LAST part: the story must END now.",
            "Write a warm, reassuring ending that truly CONCLUDES the adventure:",
            "the hero comes home or rests, and the ending recalls what they",
            "discovered or loved along the way (the surprise element has played",
            "its part).",
            "Keep it very short: 2 simple sentences — the last page reads in one breath.",
            "MANDATORY: isFinal = true AND choices = null.",
            "Do NOT offer any choice. Do NOT ask any question. Do NOT open a new",
            "adventure. This is the last page of the book.",
          ].join("\n")
        : "Write the next part, continuing from the child's choice, then 2 new choices."
    );
    const remaining = input.remainingChoices;
    if (!mustEnd && typeof remaining === "number" && remaining <= 2) {
      lines.push(
        remaining <= 1
          ? "The end is near: this part offers the LAST choice of the story. It must prepare the conclusion (the surprise element has served or serves now, the hero is getting close to the end of their adventure). Write a short part: 2 sentences only."
          : `Only ${remaining} choices are left before the end of the story (counting this part's): start pulling the thread toward its conclusion, without opening a new path. The story is landing: write a slightly shorter part (2 sentences).`
      );
    }
  }

  if (!dropCustomPrompt) {
    const block = customPromptUserBlockEn(input.customPrompt);
    if (block) {
      lines.push(block);
    }
  }

  if (corrections && corrections.length > 0) {
    lines.push(
      "",
      "The previous attempt had these problems, fix them:",
      ...corrections.map((c) => `- ${c}`)
    );
  }

  return lines.join("\n");
}

// ── Arc (fil rouge) EN ───────────────────────────────────────────────────────

export const ARC_SYSTEM_EN = [
  'You are SECRETLY preparing the thread of a "choose your own adventure"',
  "story for a 6–7-year-old child. This thread is an internal author note,",
  "never shown to the child. Write it in English, in 2 or 3 simple sentences:",
  "1) the small wish or discovery that sets the hero off,",
  "2) the CONCRETE role of the surprise element along the way (it serves, it",
  "   opens, it reveals something),",
  "3) the image of the ending, reassuring (the hero comes home, rests, keeps",
  "   a lovely memory).",
  "You ALSO give the story's visual world (visualWorld): time of day, season,",
  "weather, quality of light — ONE concrete sentence for the illustrator,",
  "valid from the beginning to the end of the story. Write it in English.",
  "You FINALLY give the characters' outfit (outfit): the clothes of EACH",
  'hero, named ("Jules: …; Zoé: …"), ONE sentence — the FIXED wardrobe the',
  "illustrator keeps identical across every image of the story.",
  'REUSE WORD FOR WORD the clothes already described in the "Visual anchors',
  'already fixed" above; only invent clothes for a hero who has none. Do not',
  "include the cuddly toy, unless it wears clothing itself.",
  "Nothing worrying, nothing upsetting, no mean character, no stakes and no",
  "trial: a wonder-filled, calm stroll. The story will fit in 6 short parts.",
  'Avoid the words "soft", "softly", "gently" (they rub off on the final',
  "text): say calm, peaceful, tender, quiet.",
].join("\n");

// ── Fragments d'image (pendants EN de segment-prompt/hero/doudou lines) ─────

export const IMAGE_REFERENCE_CLAUSE_EN =
  "Reuse EXACTLY the characters from the provided image (faces, hairstyles, clothes, proportions) and its style — but NOT its scenery or framing. Draw the place where the story is NOW (see “The scene” below), even if it no longer looks like the one in the provided image:";

export const IMAGE_NO_REFERENCE_CLAUSE_EN =
  "Illustration for one part of a child's story, tender and reassuring.";

export function heroesImageLineEn(heroes: HeroContext[]): string {
  const hints = heroes.map((h) => h.imageHint).filter(Boolean);
  if (hints.length === 0) {
    return "";
  }
  if (hints.length === 1) {
    return hints[0];
  }
  const joined = `${hints.slice(0, -1).join(", ")} and ${hints.at(-1)}`;
  return `${joined}, all together in the scene.`;
}

export function doudouImageLineEn(doudous: DoudouContext[]): string {
  const hints = doudous.map((d) => d.imageHint).filter(Boolean);
  if (hints.length === 0) {
    return "";
  }
  const joined =
    hints.length === 1
      ? hints[0]
      : `${hints.slice(0, -1).join(", ")} and ${hints.at(-1)}`;
  return hints.length === 1
    ? `With ${joined}, tenderly close to the child.`
    : `With ${joined}, the chosen cuddly toys gathered tenderly close to the child.`;
}

export function outfitImageLineEn(outfit: string | null): string {
  if (!outfit) {
    return "";
  }
  return (
    "The characters' outfit, to keep IDENTICAL from one image to the next " +
    `(unless the reference image already shows their clothes): ${outfit}.`
  );
}
