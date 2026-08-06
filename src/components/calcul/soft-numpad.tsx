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

/** The historical pad of the calcul workshop — 1..9 then 0, phone order. */
const DEFAULT_DIGITS = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];

// Tailwind JIT only sees literal class names — the column count and the
// erase span are looked up, never interpolated. (KTD9: the 10-digit default
// must keep rendering the exact historical classes; smaller digit lists —
// sudoku's 4/6/9 — get clean rows with the erase key in place.)
const GRID_COLS_CLASS: Record<number, string> = {
  1: "grid-cols-1",
  2: "grid-cols-2",
  3: "grid-cols-3",
  4: "grid-cols-4",
  5: "grid-cols-5",
};

/** ≤5 digits sit on one row; beyond, two balanced rows capped at 5 columns. */
function columnCount(digitCount: number): number {
  return digitCount <= 5
    ? Math.max(digitCount, 1)
    : Math.min(5, Math.ceil(digitCount / 2));
}

/**
 * The erase key fills the row's leftover slots (capped at 2 — never a bar);
 * on a fresh row it keeps the historical 2-column width of the calcul pad.
 */
function eraseSpanClass(digitCount: number, cols: number): string {
  const remainder = digitCount % cols;
  const span = remainder === 0 ? 2 : Math.min(2, cols - remainder);
  return span === 2 ? "col-span-2" : "";
}

/**
 * Soft on-screen numpad for the atelier — big rounded keys, no sounds, no
 * flourish. The only "special" key is a gentle erase (a pencil has one too).
 *
 * Each digit key works two ways: tap (writes into the selected cell) or drag
 * onto a grid cell directly. `touch-none` on the keys lets the pointer sensor
 * own the gesture on tablets instead of fighting the page scroll.
 *
 * KTD9: `digits`/`ariaErase` are optional — the defaults keep the calcul
 * workshop's rendering byte-identical; the sudoku mini-app passes 1..N for
 * the open grid size and its own erase label.
 */
export function SoftNumpad({
  ariaErase,
  digits = DEFAULT_DIGITS,
  onDigit,
  onErase,
}: {
  ariaErase?: string;
  digits?: string[];
  onDigit: (digit: string) => void;
  onErase: () => void;
}) {
  const m = useMessages();
  const cols = columnCount(digits.length);
  return (
    <div className={cn("grid w-fit", GRID_COLS_CLASS[cols], "gap-2")}>
      {digits.map((d) => (
        <DigitKey digit={d} key={d} onDigit={onDigit} />
      ))}
      <Button
        aria-label={ariaErase ?? m.calcul.ariaEffacer}
        className={cn(
          eraseSpanClass(digits.length, cols),
          "h-14 rounded-2xl sm:h-16"
        )}
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
