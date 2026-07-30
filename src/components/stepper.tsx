import { Check } from "lucide-react";
import { cn } from "~/lib/cn";
import { useMessages } from "~/lib/i18n";
import {
  canJumpTo,
  isStepCompleted,
  WIZARD_STEPS,
  type WizardProgress,
  type WizardStep,
} from "~/lib/wizard-steps";

interface StepperProps {
  current: WizardStep;
  /** Jump straight to a reachable step (the component only calls this for steps
   * that pass `canJumpTo`). */
  onJump: (step: WizardStep) => void;
  progress: WizardProgress;
}

/** The pill's surface style by state (avoids a nested ternary in the JSX). */
function pillTone(isCurrent: boolean, completed: boolean): string {
  if (isCurrent) {
    return "border-primary bg-primary/10 shadow-sm";
  }
  if (completed) {
    return "border-primary/40 bg-primary/5";
  }
  return "border-border bg-card";
}

/**
 * The friendly story-setup stepper, rendered above the step content in both the
 * classic and dynamic parcours. Five soft pills (🦸 Héros · 📍 Lieu · ✨ Élément
 * · 🧸 Doudou · ✏️ Touche perso): the current one is highlighted (aria-current),
 * completed ones show a ✓ and are tappable to go back and edit, optional ones
 * (doudou + extra) read lighter with a "facultatif" hint, and steps not yet
 * reachable are muted + disabled (you can't skip ahead past a required pick).
 *
 * Deliberately NOT a progress bar / percentage / counter — this is a calm tool,
 * not a game. It only answers "where am I and can I go back?", never "how far /
 * how much left".
 */
export function Stepper({ current, progress, onJump }: StepperProps) {
  const m = useMessages();
  return (
    <nav aria-label={m.aventure.etapesAria} className="no-print">
      {/* Horizontal scroll on small screens so the 5 pills never squash; they
          fit comfortably on a normal screen. */}
      <ol className="flex items-stretch gap-2 overflow-x-auto pb-1 sm:justify-center">
        {WIZARD_STEPS.map((meta) => {
          const isCurrent = meta.step === current;
          const completed = isStepCompleted(meta.step, current, progress);
          const reachable = canJumpTo(meta.step, current, progress);
          const tappable = reachable && !isCurrent;
          const label = m.aventure.etapes[meta.step];
          return (
            <li className="shrink-0" key={meta.step}>
              <button
                aria-current={isCurrent ? "step" : undefined}
                aria-label={`${label}${meta.required ? "" : m.aventure.etapeAriaFacultatif}${
                  completed ? m.aventure.etapeAriaTermine : ""
                }`}
                className={cn(
                  "flex min-w-[5rem] flex-col items-center gap-1 rounded-2xl border-2 px-3 py-2 text-center transition-all",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                  pillTone(isCurrent, completed),
                  tappable
                    ? "cursor-pointer hover:-translate-y-0.5 hover:border-primary/50"
                    : "cursor-default",
                  !(reachable || isCurrent) && "opacity-40"
                )}
                disabled={!tappable}
                onClick={() => tappable && onJump(meta.step)}
                type="button"
              >
                <span aria-hidden="true" className="relative">
                  <span className="text-3xl leading-none">{meta.emoji}</span>
                  {completed ? (
                    <span className="absolute -top-1 -right-2 flex size-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-sm">
                      <Check className="size-3" />
                    </span>
                  ) : null}
                </span>
                <span
                  className={cn(
                    "font-semibold text-sm leading-tight",
                    isCurrent ? "text-foreground" : "text-muted-foreground"
                  )}
                >
                  {label}
                </span>
                {meta.required ? null : (
                  <span className="text-[0.65rem] text-muted-foreground/70 leading-none">
                    {m.aventure.facultatif}
                  </span>
                )}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
