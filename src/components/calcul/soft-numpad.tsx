import { useDraggable } from "@dnd-kit/core";
import { Delete } from "lucide-react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/cn";
import { useMessages } from "~/lib/i18n";

/**
 * Shared visual identity of a digit tile — the numpad key and the DragOverlay
 * ghost must always look like the same object.
 */
export const DIGIT_TILE_CLASSES = "size-14 rounded-2xl text-2xl sm:size-16";

/**
 * Soft on-screen numpad for the atelier — big rounded keys, no sounds, no
 * flourish. The only "special" key is a gentle erase (a pencil has one too).
 *
 * Each digit key works two ways: tap (writes into the selected cell) or drag
 * onto a grid cell directly. `touch-none` on the keys lets the pointer sensor
 * own the gesture on tablets instead of fighting the page scroll.
 */
export function SoftNumpad({
  onDigit,
  onErase,
}: {
  onDigit: (digit: string) => void;
  onErase: () => void;
}) {
  const m = useMessages();
  const digits = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];
  return (
    <div className="grid w-fit grid-cols-5 gap-2">
      {digits.map((d) => (
        <DigitKey digit={d} key={d} onDigit={onDigit} />
      ))}
      <Button
        aria-label={m.calcul.ariaEffacer}
        className="col-span-2 h-14 rounded-2xl sm:h-16"
        onClick={onErase}
        variant="ghost"
      >
        <Delete className="size-6" />
      </Button>
    </div>
  );
}

function DigitKey({
  digit,
  onDigit,
}: {
  digit: string;
  onDigit: (digit: string) => void;
}) {
  // dnd-kit's `attributes` are deliberately NOT spread: they announce an
  // English keyboard drag affordance ("press space to pick up…") that no
  // KeyboardSensor backs — assistive tech should hear a plain digit button
  // (the tap path), not a promise the app can't keep, in the wrong language.
  const { isDragging, listeners, setNodeRef } = useDraggable({
    data: { digit },
    id: `digit-${digit}`,
  });
  return (
    <Button
      className={cn(
        DIGIT_TILE_CLASSES,
        "touch-none",
        isDragging && "opacity-40"
      )}
      onClick={() => onDigit(digit)}
      ref={setNodeRef}
      variant="outline"
      {...listeners}
    >
      {digit}
    </Button>
  );
}
