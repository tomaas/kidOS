import { Dices } from "lucide-react";
import { Button } from "~/components/ui/button";
import { useMessages } from "~/lib/i18n";
import { PickerGrid, type PickerItem } from "./picker-grid";

interface PickerStepProps {
  items: PickerItem[];
  onPick: (id: string) => void;
  // When set, an OPTIONAL step: a quiet skip button below "au hasard" that
  // advances without picking anything (e.g. "sans doudou"). Zero pressure.
  onSkip?: () => void;
  selectedId?: string;
  skipLabel?: string;
  title: string;
}

/**
 * One step of the parcours: a gentle title, the shared grid, and a single
 * "au hasard 🎲" button for days without the energy to choose. Picking either
 * way advances immediately — minimal steps, minimal pressure. An optional step
 * also shows a quiet "passer" skip (when `onSkip` is provided).
 */
export function PickerStep({
  title,
  items,
  onPick,
  selectedId,
  onSkip,
  skipLabel,
}: PickerStepProps) {
  const m = useMessages();
  function pickRandom() {
    const item = items[Math.floor(Math.random() * items.length)];
    onPick(item.id);
  }

  return (
    <div className="space-y-8">
      <h1 className="text-center font-bold text-4xl leading-tight">{title}</h1>

      <PickerGrid items={items} onSelect={onPick} selectedId={selectedId} />

      <div className="flex flex-col items-center gap-3 pt-2">
        <Button
          className="h-16 gap-2 rounded-2xl px-8 text-lg"
          onClick={pickRandom}
          type="button"
          variant="ghost"
        >
          <Dices className="size-5" />
          {m.aventure.auHasard}
        </Button>
        {onSkip ? (
          <Button
            className="h-16 rounded-2xl px-8 text-lg"
            onClick={onSkip}
            type="button"
            variant="ghost"
          >
            {skipLabel ?? m.aventure.passer}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
