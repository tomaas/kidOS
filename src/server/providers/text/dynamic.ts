import { createAnthropic } from "@ai-sdk/anthropic";
import { generateObject } from "ai";
import { z } from "zod";
import type { ProviderConfig } from "~/server/app-config";
import type {
  DynamicBeat,
  GenerateArcInput,
  GenerateBeatInput,
  StoryArcResult,
} from "~/server/providers/types";
import {
  CUSTOM_PROMPT_SYSTEM_CLAUSE,
  customPromptUserBlock,
} from "./custom-prompt";
import { DOUDOU_SYSTEM_CLAUSE, doudouUserBlock } from "./doudou-prompt";
import { elementsUserBlock } from "./element-prompt";
// Le corpus ANGLAIS vit dans son module (english.ts) : le chemin FR/RU
// historique ci-dessous reste byte-intouché (goldens) — les fonctions
// publiques ne font que BRANCHER vers lui quand lang === "en".
import {
  ARC_SCHEMA_EN,
  ARC_SYSTEM_EN,
  BEAT_SCHEMA_EN,
  buildPromptEn,
  buildSystemEn,
  customPromptUserBlockEn,
  doudouUserBlockEn,
  elementsUserBlockEn,
  heroesUserBlockEn,
  heroesVisualAnchorBlockEn,
  LANDING_BEAT_SCHEMA_EN,
  safetyProblemsEn,
  scanForbiddenEn,
  structureProblemsEn,
} from "./english";
import { FORBIDDEN_TERMS } from "./forbidden-terms";
import {
  heroesUserBlock,
  heroesVisualAnchorBlock,
  primaryHeroName,
} from "./hero-prompt";
import { MAX_WORDS_RETRY, READING_LEVEL_GUIDANCE } from "./reading-level";

// Sentence enders / whitespace used by the structure validators.
const SENTENCE_ENDERS = /[.!?…]+/;
const WHITESPACE = /\s+/;

// Claude models bill per input/output token. Prices per 1M tokens, matched on
// a model-id substring so the STORY_MODEL env override keeps costing correctly
// across tiers. Unknown models log tokens without a cost estimate.
// Source: https://platform.claude.com/docs/en/pricing (2026-07).
const TEXT_USD_PER_MTOK = [
  { input: 5, match: "opus", output: 25 },
  { input: 3, match: "sonnet", output: 15 },
  { input: 1, match: "haiku", output: 5 },
] as const;

/**
 * One log line per BILLED text-generation call, in the style of the image
 * provider's `[image-gen]` lines: model, latency, token usage and an estimated
 * cost. `kind` distinguishes the story-arc call from beat calls; `attempt` is
 * 1-based (beats retry up to 3×, the arc up to 2×). Never throws — cost
 * logging must never break generation (same contract as nanobanana).
 */
function logTextGen(
  kind: "beat" | "arc",
  attempt: number,
  ms: number,
  // Le modèle vient de l'INSTANTANÉ de config de l'opération (jamais relu
  // ici) — logTextGen reste synchrone.
  model: string,
  usage?: { inputTokens?: number; outputTokens?: number }
): void {
  try {
    const inTok = usage?.inputTokens;
    const outTok = usage?.outputTokens;
    const price = TEXT_USD_PER_MTOK.find((p) => model.includes(p.match));
    const cost =
      price && inTok !== undefined && outTok !== undefined
        ? ((inTok * price.input + outTok * price.output) / 1_000_000).toFixed(4)
        : null;
    console.log(
      `[text-gen] kind=${kind} model=${model} attempt=${attempt} ms=${ms} ` +
        `tokens=${inTok ?? "?"}in/${outTok ?? "?"}out` +
        (cost ? ` cost≈$${cost}` : " cost=unknown-model")
    );
  } catch {
    // Never let cost logging break text generation.
  }
}

/**
 * Per-beat structured output. The model emits choice LABELS ONLY — the server
 * assigns stable ids (a/b). `choices` is null on the final beat. A `title` is
 * only meaningful on the opening beat (used to name the story).
 *
 * Two instances of the same shape (see `isLanding`): landing beats cap
 * `paragraphs` at 2 entries so the decrescendo is enforced by the schema, not
 * only asked in the prompt.
 */
function buildBeatSchema(landing: boolean) {
  // biome-ignore assist/source/useSortedKeys: l'ordre des clés EST le schéma JSON envoyé au modèle (le récit d'abord : title → paragraphs → choices) — épinglé par test:coherence.
  return z.object({
    title: z
      .string()
      .optional()
      .describe(
        "Titre court et chaleureux (uniquement pour le tout premier bout)."
      ),
    paragraphs: z
      .array(z.string().min(1))
      .min(1)
      .max(landing ? 2 : 3)
      .describe(
        landing
          ? "Un bout court qui atterrit : 2 phrases courtes LIÉES (puis, alors…), 1 par entrée."
          : "Un court bout d'histoire qui coule : 2 à 3 phrases courtes LIÉES (puis, alors, mais…), 1 ou 2 par entrée."
      ),
    choices: z
      .array(z.string().min(1))
      .length(2)
      .nullable()
      .describe(
        "Exactement 2 choix (libellés courts et simples), ou null pour le bout final."
      ),
    isFinal: z
      .boolean()
      .describe("true si c'est le bout final (fin rassurante, sans choix)."),
    sceneHint: z
      .string()
      .min(1)
      .describe(
        "Pour l'illustrateur : où se passe CE bout et ce qu'on y voit, en une phrase concrète (lieu précis, moment, action). En français, sans consigne de style."
      ),
  });
}
// Exported for the standalone assertion script (test:coherence) only.
export const BEAT_SCHEMA = buildBeatSchema(false);
export const LANDING_BEAT_SCHEMA = buildBeatSchema(true);

/**
 * Landing predicate — the story's DECRESCENDO. A beat is a "landing" beat when
 * it carries one of the last 2 choices or is the forced final: those beats are
 * asked (and schema-capped) SHORTER — 2 phrases, paragraphs.max(2) — so the
 * story winds down like a bedtime story instead of staying dense while the
 * child tires. The opening beat is never a landing beat (same guard as the
 * countdown: an empty history means the story just started).
 */
// Exported for the standalone assertion script (test:coherence) only.
export function isLanding(
  input: Pick<GenerateBeatInput, "mustEnd" | "history" | "remainingChoices">
): boolean {
  return (
    input.mustEnd ||
    (input.history.length > 0 &&
      typeof input.remainingChoices === "number" &&
      input.remainingChoices <= 2)
  );
}

// Stakes / evaluation language — forbidden anywhere in a beat or a choice label.
// These read as a test/pressure, which is the #1 thing to avoid for this child.
const STAKES_TERMS = [
  "meilleur",
  "meilleure",
  "bon choix",
  "mauvais choix",
  "bonne réponse",
  "mauvaise réponse",
  "réussir",
  "réussi",
  "gagner",
  "gagné",
  "perdre",
  "perdu",
  "bravo",
  "attention",
  "vite",
  "dépêche",
  "il faut",
  "tu dois",
  "à toi de",
];

/**
 * SAFETY problems — the emotional-safety contract that must NEVER be violated
 * (scary/sad/stakes language, hero un-named, a question at the child). These
 * are always hard: a beat with any of these is rejected, even the final beat.
 */
// Exported for the standalone assertion script (test:coherence) only.
// `lang` par défaut "fr" : les appels historiques (goldens compris) gardent
// leurs octets ; "en" délègue au corpus anglais (scan word-boundary).
export function safetyProblems(
  beat: DynamicBeat,
  heroName: string,
  lang: GenerateBeatInput["lang"] = "fr"
): string[] {
  if (lang === "en") {
    return safetyProblemsEn(beat, heroName);
  }
  const problems: string[] = [];
  const labels = beat.choices ?? [];
  // sceneHint is scanned too: it drives the ILLUSTRATION prompt, so a scary
  // word there would surface as a scary image even with clean narration.
  const full = [...beat.paragraphs, ...labels, beat.sceneHint ?? ""].join("\n");
  const lower = full.toLowerCase();

  if (
    !beat.paragraphs.join(" ").toLowerCase().includes(heroName.toLowerCase())
  ) {
    problems.push(`Le héros doit être nommé par son prénom (${heroName}).`);
  }

  // The narration must not end on a question to the child.
  if ((beat.paragraphs.at(-1)?.trim() ?? "").endsWith("?")) {
    problems.push("La narration ne doit pas se terminer par une question.");
  }

  const scary = FORBIDDEN_TERMS.filter((t) => lower.includes(t));
  if (scary.length > 0) {
    problems.push(`Mots interdits (effrayants/tristes) : ${scary.join(", ")}.`);
  }
  const stakes = STAKES_TERMS.filter((t) => lower.includes(t));
  if (stakes.length > 0) {
    problems.push(
      `Langage d'enjeu/évaluation interdit (les 2 choix sont également bons) : ${stakes.join(", ")}.`
    );
  }

  return problems;
}

// The lexical tic this app kept producing: the prompts were saturated with
// "doux/douce" and the model parroted it into every beat ("un pont en bois tout
// doux"…). One occurrence per beat is tolerated; more triggers a NON-fatal
// corrective retry (structure, not safety — a warm beat with two "doux" is
// still perfectly safe to show).
const SOFTNESS_TIC = /\b(doux|douces?|doucement)\b/gi;

// Exported for the standalone assertion script (test:coherence) only.
export function softnessTicCount(text: string): number {
  return text.match(SOFTNESS_TIC)?.length ?? 0;
}

/**
 * STRUCTURE problems — every NON-fatal, retry-correctable concern: the
 * branching contract (final-beat shape, exactly 2 distinct short choices on a
 * non-final beat), beginning-reader readability, and lexical style (the
 * "doux" tic). On a forced-final beat these are COERCIBLE server-side (strip
 * choices, set isFinal) rather than fatal, so the child always gets an ending.
 */
// Exported for the standalone assertion script (test:coherence) only.
export function structureProblems(
  beat: DynamicBeat,
  mustEnd: boolean,
  landing: boolean,
  lang: GenerateBeatInput["lang"] = "fr"
): string[] {
  if (lang === "en") {
    return structureProblemsEn(beat, mustEnd, landing);
  }
  const problems: string[] = [];

  // Decrescendo nudge (NON-fatal): a landing beat (last 2 choices + final)
  // must wind down — target 2 sentences, tolerate 3, corrective retry at 4+.
  // Sentence count approximated by splitting on sentence enders.
  if (landing) {
    const sentenceCount = beat.paragraphs
      .join(" ")
      .split(SENTENCE_ENDERS)
      .filter((s) => s.trim().length > 0).length;
    if (sentenceCount > 3) {
      problems.push(
        "C'est la fin de l'histoire : raccourcis ce bout à 2 phrases courtes."
      );
    }
  }

  // Soft anti-tic nudge (NON-fatal): more than one "doux/douce/doucement" in a
  // single beat reads as a verbal tic. The retry rewrites with varied words.
  const ticCount = softnessTicCount(
    [...beat.paragraphs, ...(beat.choices ?? [])].join("\n")
  );
  if (ticCount > 1) {
    problems.push(
      `Trop de « doux / douce / doucement » (${ticCount} fois) : garde-en un seul au maximum, remplace les autres (calme, tendre, tranquille, léger…) ou montre la douceur par les gestes sans la nommer.`
    );
  }

  // Soft readability nudge (NON-fatal, like the other structure checks): flag a
  // sentence that runs long for a beginning reader so the retry shortens it. It
  // lives in structure — not safety — on purpose, so coerceBeat can still
  // salvage an otherwise-safe beat and the child never gets stuck.
  // A paragraph may hold 1–2 linked sentences now, so split on sentence enders
  // before counting words — flag a SENTENCE strictly longer than MAX_WORDS_RETRY.
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
      "Phrases trop longues pour un lecteur débutant : raccourcis-les (vise 8 mots, une idée par phrase)."
    );
  }

  if (mustEnd && !(beat.isFinal && beat.choices === null)) {
    problems.push(
      "C'est le dernier bout : isFinal doit être true et choices doit être null (fin rassurante, sans choix)."
    );
  }
  if (beat.isFinal && beat.choices !== null) {
    problems.push(
      "Un bout final ne doit pas proposer de choix (choices=null)."
    );
  }
  if (!beat.isFinal && (beat.choices === null || beat.choices.length !== 2)) {
    problems.push("Un bout non final doit proposer exactement 2 choix.");
  }
  if (beat.choices) {
    const [a, b] = beat.choices;
    if (a.trim().toLowerCase() === b.trim().toLowerCase()) {
      problems.push("Les 2 choix doivent être différents.");
    }
    if (a.length > 60 || b.length > 60) {
      problems.push("Les libellés de choix doivent rester courts.");
    }
  }

  return problems;
}

/** All problems (safety + structure), for the corrective-retry prompt. */
function validateBeat(
  beat: DynamicBeat,
  heroName: string,
  mustEnd: boolean,
  landing: boolean,
  lang: GenerateBeatInput["lang"]
): string[] {
  return [
    ...safetyProblems(beat, heroName, lang),
    ...structureProblems(beat, mustEnd, landing, lang),
  ];
}

// Exported for the standalone assertion script (test:coherence) only.
export function buildSystem(lang: GenerateBeatInput["lang"]): string {
  if (lang === "en") {
    return buildSystemEn();
  }
  const langLine =
    lang === "ru" ? "Écris en russe, naturellement." : "Écris en français.";
  return [
    "Tu écris une histoire 'dont tu es le héros' qu'un enfant de 6–7 ans lit TOUT SEUL.",
    langLine,
    "",
    READING_LEVEL_GUIDANCE,
    "",
    "Format : tu écris UN court bout d'histoire (2 à 3 phrases courtes qui",
    "S'ENCHAÎNENT avec des petits mots simples — puis, alors, mais, soudain… —",
    "pour que ça coule, pas des phrases détachées), puis tu proposes EXACTEMENT 2",
    "choix (libellés courts) — SAUF pour le bout final (choices=null,",
    "isFinal=true). Tu ne donnes JAMAIS d'identifiant aux choix, seulement le",
    "texte. Les libellés de choix sont aussi très simples à lire.",
    "Tu remplis aussi sceneHint : une phrase concrète pour l'illustrateur qui dit",
    "où se passe CE bout et ce qu'on y voit (le lieu du moment, pas celui du",
    "début si l'histoire a voyagé). Dès que le texte fait bouger les héros (ils",
    "suivent quelqu'un, entrent, traversent, montent…), le sceneHint décrit le",
    "NOUVEAU lieu et ce qu'il a de nouveau — il ne recopie pas le décor des",
    "bouts précédents. CONTINUITÉ : le sceneHint garde la MÊME heure et la même",
    "lumière que la scène du bout précédent, SAUF si l'histoire vient",
    "explicitement de changer de lieu ou de moment.",
    "",
    "Règles STRICTES (les plus importantes) :",
    "- Les 2 choix sont TOUJOURS aussi attirants l'un que l'autre et mènent tous",
    "  les deux vers quelque chose d'agréable, sûr et positif. AUCUN n'est",
    "  meilleur, aucun n'est un piège, aucun ne mène au danger, à la tristesse ou",
    "  à un échec.",
    "- Ce n'est JAMAIS un test : pas de bonne/mauvaise réponse, pas de score, pas de",
    "  'bravo', pas de 'attention', pas de 'vite', aucune pression, aucune question",
    "  à l'enfant à la fin de la narration (le choix est la seule invitation).",
    "- Le héros est nommé par son prénom (puis repris par « il »/« elle ») et",
    "  c'est lui qui agit. Chaque bout DÉCOULE du précédent : l'histoire avance.",
    "- Ton chaleureux, paisible, légèrement merveilleux. JAMAIS effrayant ni",
    "  triste, aucun méchant menaçant, aucune mort, aucun danger réel.",
    "- VARIE les mots du réconfort : n'écris presque jamais « doux », « douce » ou",
    "  « doucement » (au grand maximum une fois dans tout le bout, et jamais pour",
    "  un objet qui n'est pas doux au toucher, comme un pont ou une porte).",
    "  Montre le calme par les gestes, la lumière, les sons — sans le nommer.",
    "- L'élément surprise est le FIL de l'histoire : il doit servir concrètement",
    "  avant la fin (on l'utilise, il aide, il ouvre, il révèle quelque chose).",
    "  Les 2 choix sont deux chemins différents qui avancent tous les deux le",
    "  long de ce fil — jamais un choix qui abandonne l'élément ou l'histoire.",
    "- Le bout final résout l'histoire de façon rassurante et positive, en",
    "  rappelant ce que le héros a découvert ou aimé en chemin.",
    "",
    "Tu continues TOUJOURS l'histoire en cohérence avec les bouts précédents et le",
    "choix qui vient d'être fait. Si un « Fil de l'histoire » t'est donné, chaque",
    "bout avance le long de ce fil (il est secret : ne le récite pas, raconte-le).",
    "",
    DOUDOU_SYSTEM_CLAUSE,
    CUSTOM_PROMPT_SYSTEM_CLAUSE,
  ].join("\n");
}

// Exported for the standalone assertion script (test:coherence) only.
export function buildPrompt(
  input: GenerateBeatInput,
  corrections?: string[],
  dropCustomPrompt = false
): string {
  if (input.lang === "en") {
    return buildPromptEn(input, corrections, dropCustomPrompt);
  }
  const { heroes, place, elements, doudous, history, mustEnd } = input;
  // Single hero / single element emit BYTE-IDENTICAL lines to the pre-multi code
  // (`Héros : …` / `Élément surprise : ….`) — see hero-prompt.ts / element-prompt.ts.
  const lines: string[] = [
    heroesUserBlock(heroes),
    `Lieu : l'histoire se passe ${place.promptHint}.`,
    elementsUserBlock(elements),
  ];
  // The doudous are present on EVERY beat (safe config/snapshot values), so they
  // are included on corrective retries too — unlike the child's saveur below.
  const doudouBlock = doudouUserBlock(doudous);
  if (doudouBlock) {
    lines.push(doudouBlock);
  }

  // The hidden fil rouge, frozen at creation. Injected on EVERY beat (incl.
  // corrective retries — it is generated safe) so the story advances along one
  // thread instead of drifting episodically.
  if (input.storyArc) {
    lines.push(
      "",
      "Fil de l'histoire (secret, pour toi seulement — ne le récite pas, fais-le vivre) :",
      input.storyArc
    );
  }

  if (history.length === 0) {
    lines.push(
      "",
      "Écris le TOUT PREMIER bout de l'histoire (avec un titre court et chaleureux), puis 2 choix."
    );
  } else {
    lines.push("", "Histoire jusqu'ici :");
    history.forEach((h, i) => {
      lines.push(`Bout ${i + 1} : ${h.paragraphs.join(" ")}`);
      // The scene each prior beat gave the illustrator: without it the model
      // emits every sceneHint blind and the illustrations jump from day to
      // night between pages. Older segments have none → line omitted.
      if (h.sceneHint) {
        lines.push(`  → scène : « ${h.sceneHint} »`);
      }
      lines.push(
        `  → choix proposés : « ${h.offered[0]} » / « ${h.offered[1]} »`,
        `  → l'enfant a choisi : « ${h.chosenLabel} »`
      );
    });
    lines.push(
      "",
      mustEnd
        ? [
            "C'est le DERNIER bout : l'histoire doit se TERMINER maintenant.",
            "Écris une fin chaleureuse et rassurante qui CONCLUT vraiment l'aventure :",
            "le héros rentre ou se repose, et la fin rappelle ce qu'il a découvert",
            "ou aimé en chemin (l'élément surprise a joué son rôle).",
            "Reste très court : 2 phrases simples — la dernière page se lit d'un souffle.",
            "OBLIGATOIRE : isFinal = true ET choices = null.",
            "NE propose AUCUN choix. Ne pose AUCUNE question. N'ouvre PAS de nouvelle",
            "aventure. C'est la dernière page du livre.",
          ].join("\n")
        : "Écris le bout suivant en continuant à partir du choix de l'enfant, puis 2 nouveaux choix."
    );
    // Landing announcement: on the last beats before the forced final one, tell
    // the model the end is near so the resolution is PREPARED (the element has
    // served, the thread tightens) instead of hitting the mustEnd wall cold.
    // These beats are also the DECRESCENDO (see isLanding): shorter on purpose,
    // because a beginning reader tires by the end of the story.
    const remaining = input.remainingChoices;
    if (!mustEnd && typeof remaining === "number" && remaining <= 2) {
      lines.push(
        remaining <= 1
          ? "La fin est proche : ce bout propose le DERNIER choix de l'histoire. Il doit préparer la conclusion (l'élément surprise a servi ou sert maintenant, le héros se rapproche de la fin de son aventure). Écris un bout court : 2 phrases seulement."
          : `Il ne reste que ${remaining} choix avant la fin de l'histoire (en comptant celui de ce bout) : commence à resserrer le fil vers sa conclusion, sans ouvrir de nouvelle piste. L'histoire atterrit : écris un bout un peu plus court (2 phrases).`
      );
    }
  }

  // Keep the saveur UNLESS this retry was triggered by a SAFETY failure (same
  // rationale as classic): only then might the flavour be the cause. A
  // readability/structure-only retry keeps the child's personalization.
  if (!dropCustomPrompt) {
    const block = customPromptUserBlock(input.customPrompt);
    if (block) {
      lines.push(block);
    }
  }

  if (corrections && corrections.length > 0) {
    lines.push(
      "",
      "La tentative précédente avait ces problèmes, corrige-les :",
      ...corrections.map((c) => `- ${c}`)
    );
  }

  return lines.join("\n");
}

async function generateOnce(
  input: GenerateBeatInput,
  attempt: number,
  config: ProviderConfig,
  corrections?: string[],
  dropCustomPrompt = false
): Promise<DynamicBeat> {
  const anthropic = createAnthropic({ apiKey: config.anthropicApiKey });
  const startedAt = Date.now();
  // Les descriptions du schéma sont visibles du modèle → schéma dans la
  // langue de l'histoire (même forme, même ordre de clés — épinglé).
  const landingSchema =
    input.lang === "en" ? LANDING_BEAT_SCHEMA_EN : LANDING_BEAT_SCHEMA;
  const beatSchema = input.lang === "en" ? BEAT_SCHEMA_EN : BEAT_SCHEMA;
  const { object, usage } = await generateObject({
    model: anthropic(config.storyModel),
    prompt: buildPrompt(input, corrections, dropCustomPrompt),
    schema: isLanding(input) ? landingSchema : beatSchema,
    system: buildSystem(input.lang),
  });
  logTextGen("beat", attempt, Date.now() - startedAt, config.storyModel, usage);

  // Normalize the Zod array into the typed tuple shape.
  return {
    choices: object.choices ? [object.choices[0], object.choices[1]] : null,
    isFinal: object.isFinal,
    paragraphs: object.paragraphs,
    sceneHint: object.sceneHint,
    title: object.title,
  };
}

/**
 * Last-resort coercion of a beat the model didn't shape correctly, applied only
 * when the TEXT is SAFE (no scary/sad/stakes, hero named). Structural slips are
 * fixed server-side so the child gets a beat rather than an endless "On
 * réessaie ?". Returns null if the text is unsafe OR can't be made structurally
 * valid without fabricating content.
 *
 * - Forced-final (mustEnd) OR the model marked it final: drop any choices, mark
 *   final → a guaranteed warm ending.
 * - Non-final: keep it only if the model actually produced 2 usable, distinct
 *   short choices (just normalize isFinal=false). We never invent choices — a
 *   beat with missing/duplicate choices must retry/soft-fail instead.
 */
// Exported for the standalone assertion script (test:coherence) only.
export function coerceBeat(
  beat: DynamicBeat,
  heroName: string,
  mustEnd: boolean,
  lang: GenerateBeatInput["lang"] = "fr"
): DynamicBeat | null {
  if (mustEnd || beat.isFinal) {
    const coerced: DynamicBeat = {
      choices: null,
      isFinal: true,
      paragraphs: beat.paragraphs,
      sceneHint: beat.sceneHint,
      title: beat.title,
    };
    return safetyProblems(coerced, heroName, lang).length === 0
      ? coerced
      : null;
  }

  // Non-final: only salvageable if 2 real, distinct, short choices exist.
  const a = beat.choices?.[0]?.trim();
  const b = beat.choices?.[1]?.trim();
  if (
    a &&
    b &&
    a.toLowerCase() !== b.toLowerCase() &&
    a.length <= 60 &&
    b.length <= 60
  ) {
    const coerced: DynamicBeat = {
      choices: [a, b],
      isFinal: false,
      paragraphs: beat.paragraphs,
      sceneHint: beat.sceneHint,
      title: beat.title,
    };
    return safetyProblems(coerced, heroName, lang).length === 0
      ? coerced
      : null;
  }
  return null;
}

// ── Hidden story arc ("fil rouge") ──────────────────────────────────────────

// Exporté pour le script d'assertions (test:coherence) uniquement.
// biome-ignore assist/source/useSortedKeys: l'ordre des clés EST le schéma JSON envoyé au modèle — épinglé par test:coherence.
export const ARC_SCHEMA = z.object({
  arc: z
    .string()
    .min(1)
    .describe(
      "Le fil de l'histoire en 2 ou 3 phrases simples : l'envie ou le petit but du héros, comment l'élément surprise sert concrètement en chemin, et l'image de la fin (rassurante, le héros rentre ou se repose)."
    ),
  visualWorld: z
    .string()
    .min(1)
    .describe(
      "Le monde visuel de l'histoire, en UNE phrase concrète pour l'illustrateur : moment de la journée, saison, météo, ambiance lumineuse (ex. « fin d'après-midi d'été, lumière dorée, ciel dégagé »)."
    ),
  outfit: z
    .string()
    .min(1)
    .describe(
      "La tenue vestimentaire de TOUS les héros, en UNE phrase concrète : les vêtements de CHAQUE héros (couleur + type), la même du début à la fin. C'est la garde-robe FIXE de toutes les illustrations (ex. « Jules en pull bleu et pantalon beige ; Zoé en veste verte »)."
    ),
});
const arcSchema = ARC_SCHEMA;

/**
 * The shared over-blocking safety scan (same bias as `safetyProblems`):
 * substring match of the lowercased text against the forbidden + stakes term
 * lists. Returns the FIRST matched term (for logging) or null when clean. Used
 * to gate the creation-time author notes before they poison every prompt.
 */
export function scanForbidden(
  text: string,
  lang: GenerateBeatInput["lang"] = "fr"
): string | null {
  if (lang === "en") {
    return scanForbiddenEn(text);
  }
  const lower = text.toLowerCase();
  return (
    [...FORBIDDEN_TERMS, ...STAKES_TERMS].find((t) => lower.includes(t)) ?? null
  );
}

/**
 * Resolve the model's raw outfit text into a safe frozen value: null when empty
 * or when the over-blocking scan trips (drops ONLY the outfit line, never the
 * whole arc — outfit is the least-critical of the three notes). A billed extra
 * generation must never silently disable a feature, so a scan drop is logged.
 */
export function safeOutfitOrNull(
  outfit: string,
  lang: GenerateBeatInput["lang"] = "fr"
): string | null {
  const hit = scanForbidden(outfit, lang);
  if (hit) {
    console.warn(
      `[stories] story outfit dropped by the safety scan (matched « ${hit} »); illustrations keep prior clothing behavior.`
    );
    return null;
  }
  return outfit.length > 0 ? outfit : null;
}

/**
 * Generate the hidden story arc + the story's VISUAL WORLD once at story
 * creation — one LLM call, two frozen author notes. The arc (never shown to
 * the child) is injected into every beat prompt so the beats advance along one
 * thread and the surprise element pays off before the end — instead of the
 * greedy beat-by-beat drift that produced stories titled after a magic key
 * that was never used. The visual world (time of day, season, weather, light)
 * is injected into every IMAGE prompt as the story's default ambiance, so the
 * illustrations stop jumping from day to night between pages.
 *
 * BEST-EFFORT: returns null on any failure (generation error, unsafe text
 * after 2 attempts) — the story then generates arc-less, exactly as before.
 * Never throws: the arc must never block or delay a soft-fail into the child's
 * opening beat.
 */
export async function generateStoryArc(
  input: GenerateArcInput,
  config: ProviderConfig
): Promise<StoryArcResult | null> {
  if (!config.anthropicApiKey) {
    // Clé absente (ni ligne DB ni env) : AUCUN appel réseau — l'histoire
    // démarre sans fil rouge, comme tout autre soft-fail de l'arc.
    return null;
  }
  const anthropic = createAnthropic({ apiKey: config.anthropicApiKey });

  // The arc must be in the STORY's language: it is quoted verbatim inside every
  // beat prompt, and a French arc would steer a Russian story's wording.
  // lang === "en" → le corpus anglais entier (system, blocs, schéma).
  const arcLangLine =
    input.lang === "ru"
      ? "à l'enfant. Écris-le en russe, en 2 ou 3 phrases simples :"
      : "à l'enfant. Écris-le en français, en 2 ou 3 phrases simples :";
  const systemFr = [
    "Tu prépares EN SECRET le fil d'une histoire « dont tu es le héros » pour un",
    "enfant de 6–7 ans. Ce fil est une note interne pour l'auteur, jamais montrée",
    arcLangLine,
    "1) la petite envie ou découverte qui lance le héros,",
    "2) le rôle CONCRET de l'élément surprise en chemin (il sert, il ouvre, il",
    "   révèle quelque chose),",
    "3) l'image de la fin, rassurante (le héros rentre, se repose, garde un joli",
    "   souvenir).",
    "Tu donnes AUSSI le monde visuel de l'histoire (visualWorld) : moment de la",
    "journée, saison, météo, ambiance lumineuse — UNE phrase concrète pour",
    "l'illustrateur, valable du début à la fin de l'histoire.",
    "Tu donnes ENFIN la tenue des personnages (outfit) : les vêtements de CHAQUE",
    "héros, nommé (« Jules : … ; Zoé : … »), UNE phrase — la garde-robe FIXE",
    "que l'illustrateur garde identique sur toutes les images de l'histoire.",
    "REPRENDS MOT POUR MOT les vêtements déjà décrits dans les « Repères visuels",
    "déjà fixés » ci-dessus ; n'invente des vêtements que pour un héros qui n'en",
    "a aucun. N'inclus pas le doudou, sauf s'il porte lui-même un vêtement.",
    "Aucun danger, aucune peur, aucun méchant, aucun enjeu ni épreuve : une",
    "promenade merveilleuse et calme. L'histoire tiendra en 6 courts bouts.",
    "Évite les mots « doux », « douce », « doucement » (ils déteignent sur le",
    "texte final) : dis calme, paisible, tendre, tranquille.",
  ].join("\n");
  const system = input.lang === "en" ? ARC_SYSTEM_EN : systemFr;

  const linesFr = [
    heroesUserBlock(input.heroes),
    // Give the wardrobe generator each hero's fixed imageHint so it REUSES any
    // clothing already pinned there instead of inventing a contradictory one.
    heroesVisualAnchorBlock(input.heroes),
    input.place.promptHint
      ? `Lieu : l'histoire se passe ${input.place.promptHint}.`
      : "",
    elementsUserBlock(input.elements),
    doudouUserBlock(input.doudous),
    customPromptUserBlock(input.customPrompt),
    "",
    "Écris le fil de cette histoire.",
  ];
  const linesEn = [
    heroesUserBlockEn(input.heroes),
    heroesVisualAnchorBlockEn(input.heroes),
    input.place.promptHint
      ? `Setting: the story takes place ${input.place.promptHint}.`
      : "",
    elementsUserBlockEn(input.elements),
    doudouUserBlockEn(input.doudous),
    customPromptUserBlockEn(input.customPrompt),
    "",
    "Write the thread of this story.",
  ];
  const lines = (input.lang === "en" ? linesEn : linesFr).filter(Boolean);

  // Why the arc was ultimately dropped — an unsafe-text DROP is very different
  // from a generation FAILURE when reading logs (a substring false positive on
  // the safety scan silently disables the feature; it must be visible).
  let dropReason = "generation never produced an arc";
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const startedAt = Date.now();
    try {
      // biome-ignore lint/performance/noAwaitInLoops: retries correctifs SÉQUENTIELS par design — chaque tentative dépend des problèmes de la précédente.
      const { object, usage } = await generateObject({
        // The arc gates the child-facing opening beat: a hung call must never
        // hold the waiting screen. Per-attempt cap → worst case ~30s, then the
        // story simply starts arc-less (best-effort contract above).
        abortSignal: AbortSignal.timeout(15_000),
        model: anthropic(config.storyModel),
        prompt: lines.join("\n"),
        schema: input.lang === "en" ? ARC_SCHEMA_EN : arcSchema,
        system,
      });
      logTextGen(
        "arc",
        attempt + 1,
        Date.now() - startedAt,
        config.storyModel,
        usage
      );
      const arc = object.arc.trim();
      const visualWorld = object.visualWorld.trim();
      const outfit = object.outfit.trim();
      // arc + visualWorld are scanned TOGETHER: the arc poisons every BEAT
      // prompt, the visual world every IMAGE prompt — an unsafe word in either
      // drops the WHOLE result. Substring matching over-blocks by design (same
      // safety bias as safetyProblems): "charme" contains "arme" — an
      // over-block costs one retry then an arc-less story, never an unsafe one.
      const hit = scanForbidden(`${arc}\n${visualWorld}`, input.lang);
      if (!hit && arc.length > 0 && visualWorld.length > 0) {
        // The outfit is scanned SEPARATELY (see safeOutfitOrNull): a forbidden
        // word in the wardrobe drops only the outfit line, never the whole arc.
        return {
          arc,
          outfit: safeOutfitOrNull(outfit, input.lang),
          visualWorld,
        };
      }
      dropReason = hit
        ? `arc text dropped by the safety scan (matched « ${hit} »)`
        : "arc or visual-world text was empty";
    } catch (err) {
      dropReason = `generation error/timeout (${err instanceof Error ? err.name : "unknown"})`;
    }
  }
  console.warn(
    `[stories] story arc unavailable — ${dropReason}; starting without one.`
  );
  return null;
}

/**
 * Generate one story beat, conditioned on history — the app's SOLE text
 * generation entry point (a plain module function, imported by concrete name;
 * there is deliberately no provider interface — see the adapter-census note in
 * `types.ts`). Validates against the safety + structure contracts with up to 3
 * corrective attempts, then coerces or throws.
 */
export async function generateBeat(
  input: GenerateBeatInput,
  config: ProviderConfig
): Promise<DynamicBeat> {
  if (!config.anthropicApiKey) {
    // Clé absente (ni ligne DB ni env) : AUCUN appel réseau. L'appelant
    // transforme ce throw en soft-failure calme (« On réessaie ? ») ;
    // le statut « clé non configurée » vit côté /parents (app-config).
    throw new Error("Clé Anthropic non configurée.");
  }

  // Named-hero safety contract applies to the PRIMARY hero only (codex #2/#5).
  const heroName = primaryHeroName(input.heroes);
  // Several corrective attempts for EVERY beat. A soft-fail is worst at the
  // very start of a story (beat 0) for an anxious child, so opening/regular
  // beats get the same robustness as the forced-final beat.
  const maxAttempts = 3;

  let last: DynamicBeat | null = null;
  let lastProblems: string[] = [];
  // Whether the LAST failure was a SAFETY one. Only then is the child's saveur
  // dropped on the next attempt (it may be the cause); a structure/readability
  // -only retry keeps the flavour. A transient parse error keeps it too (the
  // flavour is not the cause of a schema mismatch).
  let lastSafetyFailed = false;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    if (attempt > 0) {
      // Corrective retry — say WHY, so a billed extra call is never silent.
      console.warn(
        `[stories] beat corrective retry ${attempt + 1}/${maxAttempts}` +
          ` (safety=${lastSafetyFailed}): ${lastProblems.join(" | ")}`
      );
    }
    let beat: DynamicBeat;
    try {
      // biome-ignore lint/performance/noAwaitInLoops: retries correctifs SÉQUENTIELS par design — chaque tentative dépend des problèmes de la précédente.
      beat = await generateOnce(
        input,
        attempt + 1,
        config,
        attempt === 0 ? undefined : lastProblems,
        lastSafetyFailed
      );
    } catch (genErr) {
      // A transient generation/parse failure (e.g. generateObject "response
      // did not match schema") on ONE attempt must not abort the whole beat —
      // retry. Record it so a final hard-fail explains what happened.
      lastProblems = [
        genErr instanceof Error ? genErr.message : "génération échouée",
      ];
      lastSafetyFailed = false;
      continue;
    }
    const problems = validateBeat(
      beat,
      heroName,
      input.mustEnd,
      isLanding(input),
      input.lang
    );
    if (problems.length === 0) {
      return beat;
    }
    last = beat;
    lastProblems = problems;
    lastSafetyFailed = safetyProblems(beat, heroName, input.lang).length > 0;
  }

  // Robust fallback (any beat): if the remaining problems are only STRUCTURAL
  // but the TEXT is SAFE, coerce into a valid beat rather than soft-failing.
  // Guarantees the child almost never sees "On réessaie ?" — especially on
  // beat 0 — while the safety guard-rail stays absolute.
  if (last) {
    const coerced = coerceBeat(last, heroName, input.mustEnd, input.lang);
    if (coerced) {
      // Server-side diagnostic (TanStack swallows thrown errors client-side).
      console.warn(
        `[stories] beat coerced after ${maxAttempts} attempts (mustEnd=${input.mustEnd}); text was safe. Problems: ${lastProblems.join("; ")}`
      );
      return coerced;
    }
  }

  // Text itself is unsafe (or choices were unsalvageable) — log and throw;
  // the caller turns this into the gentle "On réessaie ?" soft-fail that
  // retries the current beat without losing prior segments.
  // Server-side diagnostic (TanStack swallows thrown errors client-side).
  console.error(
    `[stories] beat generation failed after ${maxAttempts} attempts (mustEnd=${input.mustEnd}). Problems: ${lastProblems.join("; ")}`
  );
  throw new Error(
    `Le bout généré ne respecte pas les règles : ${lastProblems.join(" ")}`
  );
}
