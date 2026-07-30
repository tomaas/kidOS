import { ArrowRight, Dices } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "~/components/ui/button";
import { useMessages } from "~/lib/i18n";
import { PickerGrid, type PickerItem } from "./picker-grid";

interface MultiPickStepProps {
  items: PickerItem[];
  /** When true (REQUIRED steps), "suite" is disabled until ≥1 is picked, so the
   * child can't advance with an empty required selection. Stays calm — the
   * button is simply not yet active, no error, no nudge. */
  minOne?: boolean;
  /** Advance to the next step with the current selection. */
  onContinue: () => void;
  /** Pick one (or a couple) at random ("au hasard"). */
  onRandom: () => void;
  /** Optional "skip" path (e.g. "sans doudou"): clears the selection AND
   * advances in one tap. Omitted for REQUIRED steps (heroes/elements). */
  onSkip?: () => void;
  /** Toggle one item in/out of the selection. */
  onToggle: (id: string) => void;
  /** The items picked so far (ids). */
  selectedIds: string[];
  skipIcon?: ReactNode;
  skipLabel?: string;
  title: string;
}

/**
 * A multi-select parcours step: a gentle title, the shared toggle grid (several
 * rings lit at once), an "au hasard", a calm "suite →", and an optional skip.
 * Generalizes the original doudou step so heroes / elements / doudous all share
 * one UX. Everything stays pressure-free: no counter, no "pick at least N" copy.
 *
 * - Doudou step: OPTIONAL → pass `onSkip` ("sans doudou"), no `minOne`.
 * - Hero / element steps: REQUIRED → pass `minOne`, no `onSkip` (the default hero / a
 *   default keeps the selection non-empty, so "suite" is normally active).
 */
export function MultiPickStep({
  title,
  items,
  selectedIds,
  onToggle,
  onContinue,
  onRandom,
  onSkip,
  skipLabel,
  skipIcon,
  minOne,
}: MultiPickStepProps) {
  const m = useMessages();
  const continueDisabled = minOne === true && selectedIds.length === 0;
  return (
    <div className="space-y-8">
      <h1 className="text-center font-bold text-4xl leading-tight">{title}</h1>

      <PickerGrid items={items} onSelect={onToggle} selectedIds={selectedIds} />

      <div className="flex flex-col items-center gap-3 pt-2">
        {/* The calm advance. Soft, same scale as the other steps — never styled
            as pressure. Disabled only for a required step with nothing picked. */}
        <Button
          className="h-16 gap-2 rounded-2xl px-10 text-xl"
          disabled={continueDisabled}
          onClick={onContinue}
          size="lg"
          type="button"
        >
          {m.aventure.suite}
          <ArrowRight className="size-5" />
        </Button>

        <Button
          className="h-16 gap-2 rounded-2xl px-8 text-lg"
          onClick={onRandom}
          type="button"
          variant="ghost"
        >
          <Dices className="size-5" />
          {m.aventure.auHasard}
        </Button>

        {/* Equal-weight skip (optional steps only): clears the selection and
            advances in one tap. Same ghost/size/color + a leading icon so it
            balances "au hasard" exactly — no choice is lesser. */}
        {onSkip ? (
          <Button
            className="h-16 gap-2 rounded-2xl px-8 text-lg"
            onClick={onSkip}
            type="button"
            variant="ghost"
          >
            {skipIcon}
            {skipLabel ?? m.aventure.passer}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
