/**
 * Selectable "strange elements" that spark the story. `promptHint` is injected
 * into the story prompt; `label` and `emoji` drive the picker button.
 */
export interface StoryElement {
  emoji: string;
  id: string;
  label: string;
  promptHint: string;
}

export const elements: StoryElement[] = [
  {
    emoji: "🍣",
    id: "sushi-geant",
    label: "un sushi géant",
    promptHint: "un sushi géant et rigolo",
  },
  {
    emoji: "🗝️",
    id: "cle-magique",
    label: "une clé magique",
    promptHint:
      "une clé magique qui ouvre des portes surprenantes vers des endroits merveilleux",
  },
  {
    emoji: "🐦",
    id: "animal-parle",
    label: "un animal qui parle",
    promptHint: "un petit animal qui parle gentiment",
  },
  {
    emoji: "⚙️",
    id: "machine-bizarre",
    label: "une machine bizarre",
    promptHint: "une machine bizarre et amusante, pleine de boutons rigolos",
  },
  {
    emoji: "⭐",
    id: "etoile-tombee",
    label: "une étoile tombée du ciel",
    promptHint: "une étoile tombée du ciel, toute brillante et amicale",
  },
  {
    emoji: "💎",
    id: "tresor",
    label: "un trésor",
    promptHint: "un trésor scintillant caché tout près",
  },
];

export function findElement(id: string): StoryElement | undefined {
  return elements.find((e) => e.id === id);
}

/**
 * Elements mapped to the DB `elements` table shape (`label`/`promptHint`),
 * REUSING each config id. The config already uses those field names, so this is
 * a straight projection. IMMUTABLE legacy fallback (like `src/config/places.ts`
 * for places): the DB `elements` table is seeded from it idempotently, and a
 * story's frozen snapshot falls back to it by id so editing/deleting an element
 * never alters an already-created story.
 */
export const legacyElements: {
  id: string;
  label: string;
  emoji: string;
  promptHint: string;
}[] = elements.map((e) => ({
  emoji: e.emoji,
  id: e.id,
  label: e.label,
  promptHint: e.promptHint,
}));

/** Legacy element (DB shape) by id, for the frozen-context config fallback. */
export function findLegacyElement(id: string) {
  return legacyElements.find((e) => e.id === id);
}
