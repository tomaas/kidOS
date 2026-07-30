import { Cloud } from "lucide-react";
import { useMessages } from "~/lib/i18n";
import { MultiPickStep } from "./multi-pick-step";
import type { PickerItem } from "./picker-grid";

interface DoudouMultiStepProps {
  items: PickerItem[];
  /** Advance to the next step with the current selection (may be empty). */
  onContinue: () => void;
  /** Pick one or a couple at random ("au hasard"). */
  onRandom: () => void;
  /** Clear the whole selection AND advance ("sans doudou" — one definitive tap). */
  onSkip: () => void;
  /** Toggle one doudou in/out of the selection. */
  onToggle: (id: string) => void;
  /** The doudous picked so far (ids). Empty = "sans doudou". */
  selectedIds: string[];
}

/**
 * The doudou step — a thin wrapper over the shared `MultiPickStep`. The child
 * can bring SEVERAL comforting companions (or none): the doudou step is OPTIONAL,
 * so it exposes a "sans doudou" skip and never gates "suite". Title + skip copy
 * are the only doudou-specifics; the multi-select UX is shared with heroes/elements.
 */
export function DoudouMultiStep({
  items,
  selectedIds,
  onToggle,
  onContinue,
  onSkip,
  onRandom,
}: DoudouMultiStepProps) {
  const m = useMessages();
  return (
    <MultiPickStep
      items={items}
      onContinue={onContinue}
      onRandom={onRandom}
      onSkip={onSkip}
      onToggle={onToggle}
      selectedIds={selectedIds}
      skipIcon={<Cloud className="size-5" />}
      skipLabel={m.aventure.sansDoudou}
      title={m.aventure.titreDoudous}
    />
  );
}
