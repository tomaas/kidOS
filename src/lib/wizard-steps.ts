/**
 * The shared step model for the story-setup wizard, used by the dynamic
 * (`/aventure`) parcours and by the visual `Stepper`. Keeping it in one place
 * means the flow + the indicator can never drift apart.
 *
 * The wizard has FIVE setup steps; `writing`/`oops` are terminal generation
 * states that are NOT part of the stepper.
 */

export type WizardStep = "hero" | "place" | "element" | "doudou" | "extra";

export interface WizardStepMeta {
  emoji: string;
  /** Required steps gate forward jumps; optional ones (doudou, extra) never do
   * and are shown visually lighter with a "facultatif" hint. The short label
   * shown under the emoji lives in the i18n catalog, keyed by `step`
   * (m.aventure.etapes[step]) — this module stays pure and language-free. */
  required: boolean;
  step: WizardStep;
}

/** Ordered setup steps (the order the child walks through). */
export const WIZARD_STEPS: WizardStepMeta[] = [
  { emoji: "🦸", required: true, step: "hero" },
  { emoji: "📍", required: true, step: "place" },
  { emoji: "✨", required: true, step: "element" },
  { emoji: "🧸", required: false, step: "doudou" },
  { emoji: "✏️", required: false, step: "extra" },
];

/** The picks made so far, used to decide which steps are reachable + complete.
 * Heroes always have ≥1 (default hero), so the gate is really place+element. */
export interface WizardProgress {
  elementIds: string[];
  heroIds: string[];
  placeId?: string;
}

const ORDER: WizardStep[] = WIZARD_STEPS.map((s) => s.step);

export function stepIndex(step: WizardStep): number {
  return ORDER.indexOf(step);
}

/** The step before `step` in the wizard order, or null on the first step. */
export function previousStep(step: WizardStep): WizardStep | null {
  const i = stepIndex(step);
  return i > 0 ? ORDER[i - 1] : null;
}

/**
 * Whether a REQUIRED step's own pick is satisfied. Heroes always have a default
 * so they're satisfied; place needs a placeId; element needs ≥1 pick. Optional
 * steps are always "satisfied" (they never block).
 */
function isStepSatisfied(step: WizardStep, p: WizardProgress): boolean {
  switch (step) {
    case "hero":
      return p.heroIds.length > 0;
    case "place":
      return Boolean(p.placeId);
    case "element":
      return p.elementIds.length > 0;
    default:
      return true; // doudou, extra — optional, never block
  }
}

/**
 * Can the child jump straight to `target` from anywhere?
 *  - Backward / same step: always (free editing of earlier picks).
 *  - Forward: only if EVERY required step strictly before `target` is satisfied
 *    (can't skip to element if place isn't chosen). The target itself need not
 *    be satisfied — that's the step you're going to fill in.
 */
export function canJumpTo(
  target: WizardStep,
  current: WizardStep,
  p: WizardProgress
): boolean {
  const ti = stepIndex(target);
  if (ti <= stepIndex(current)) {
    return true;
  }
  for (let i = 0; i < ti; i += 1) {
    const meta = WIZARD_STEPS[i];
    if (meta.required && !isStepSatisfied(meta.step, p)) {
      return false;
    }
  }
  return true;
}

/**
 * A step is "completed" (shows a ✓) when it sits BEFORE the current step and its
 * own pick is satisfied. The current step is highlighted, not checked; later
 * steps are upcoming.
 */
export function isStepCompleted(
  step: WizardStep,
  current: WizardStep,
  p: WizardProgress
): boolean {
  return stepIndex(step) < stepIndex(current) && isStepSatisfied(step, p);
}
