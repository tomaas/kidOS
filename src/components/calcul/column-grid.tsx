import { useDroppable } from "@dnd-kit/core";
import { cn } from "~/lib/cn";
import type {
  CellRef,
  OperationLayout,
  SerieEntriesLike,
} from "~/lib/operations";

/**
 * On-screen posed operation — the same geometry as the printed A5 sheet
 * (both consume layoutOperation, eng-review decision 3A).
 *
 * "Écriture libre" mode (eng-review T3-C): every digit the child writes is
 * inked immediately, like a pencil — the grid NEVER judges a digit (no gray
 * gate, no red, no message). Verification happens by comparison: at the end
 * of the operation the same grid is rendered in `solution` variant next to
 * the child's, and the child compares line by line.
 *
 * Cells are tap-to-select (large touch targets); digits come from the soft
 * numpad, tapped into the selected cell or dragged straight onto a cell
 * (each writable cell is a dnd-kit drop target). Carry cells are optional
 * scratch space, exactly like the little pencil "1" on paper.
 */

export function ColumnGrid({
  layout,
  entries,
  selected,
  onSelect,
  variant,
}: {
  layout: OperationLayout;
  entries?: SerieEntriesLike;
  selected?: CellRef | null;
  onSelect?: (cell: CellRef) => void;
  variant: "libre" | "solution";
}) {
  const isSolution = variant === "solution";
  const cellBase =
    "flex size-12 items-center justify-center rounded-xl text-2xl sm:size-14 sm:text-3xl";
  const isSelected = (cell: CellRef) =>
    selected?.row === cell.row && selected?.col === cell.col;

  return (
    <div
      className={cn(
        "inline-flex flex-col items-center gap-1 rounded-3xl border bg-card p-5",
        isSolution && "opacity-80"
      )}
    >
      {/* Carry scratch row — small, optional, never required. */}
      <div className="flex gap-1.5">
        <span aria-hidden="true" className="size-12 sm:size-14" />
        {layout.carrySlots.map((slot, col) => (
          <span
            className="flex size-12 items-start justify-center sm:size-14"
            key={`carry-${col}-${layout.expectedDigits.length}`}
          >
            {slot && !isSolution ? (
              <CarryCell
                col={col}
                onSelect={onSelect}
                selected={isSelected({ col, row: "carry" })}
                value={entries?.carries[col] ?? ""}
              />
            ) : null}
          </span>
        ))}
      </div>

      {/* Operand rows — printed ink, nothing to touch. */}
      <div className="flex gap-1.5">
        <span aria-hidden="true" className={cellBase} />
        {layout.operandRows[0].map((digit, col) => (
          <span className={cellBase} key={`a-${col}-${digit}`}>
            {digit}
          </span>
        ))}
      </div>
      <div className="flex gap-1.5">
        <span className={cn(cellBase, "text-muted-foreground")}>
          {layout.sign}
        </span>
        {layout.operandRows[1].map((digit, col) => (
          <span className={cellBase} key={`b-${col}-${digit}`}>
            {digit}
          </span>
        ))}
      </div>

      <div className="my-1 h-0.5 w-full rounded bg-foreground/60" />

      {/* Result row — the child's line (or the solution's, muted). */}
      <div className="flex gap-1.5">
        <span aria-hidden="true" className={cellBase} />
        {layout.expectedDigits.map((expectedDigit, col) =>
          isSolution ? (
            <span
              className={cn(cellBase, "text-muted-foreground")}
              key={`sol-${col}-${expectedDigit}`}
            >
              {expectedDigit}
            </span>
          ) : (
            <ResultCell
              cellBase={cellBase}
              col={col}
              key={`res-${col}-${expectedDigit}`}
              onSelect={onSelect}
              selected={isSelected({ col, row: "result" })}
              value={entries?.result[col] ?? ""}
            />
          )
        )}
      </div>
    </div>
  );
}

/**
 * A writable result cell: tap-to-select AND drop target for a dragged digit.
 * The isOver highlight reuses the selection style — landing a digit and
 * choosing a cell are the same gentle emphasis, never a new signal.
 */
function ResultCell({
  cellBase,
  col,
  onSelect,
  selected,
  value,
}: {
  cellBase: string;
  col: number;
  onSelect?: (cell: CellRef) => void;
  selected: boolean;
  value: string;
}) {
  const { isOver, setNodeRef } = useDroppable({
    data: { cell: { col, row: "result" } satisfies CellRef },
    id: `drop-result-${col}`,
  });
  return (
    <button
      className={cn(
        cellBase,
        "border border-muted-foreground/40 focus-visible:outline-2 focus-visible:outline-primary/60",
        (selected || isOver) && "border-2 border-primary bg-primary/5"
      )}
      onClick={() => onSelect?.({ col, row: "result" })}
      ref={setNodeRef}
      type="button"
    >
      {value}
    </button>
  );
}

function CarryCell({
  col,
  onSelect,
  selected,
  value,
}: {
  col: number;
  onSelect?: (cell: CellRef) => void;
  selected: boolean;
  value: string;
}) {
  const { isOver, setNodeRef } = useDroppable({
    data: { cell: { col, row: "carry" } satisfies CellRef },
    id: `drop-carry-${col}`,
  });
  return (
    // Touch target ≥ 44px for small fingers: 28px box + 2×8px vertical slop
    // = 44px tall, 52px wide (negative margins keep the visual layout). The
    // slop also enlarges the droppable rect registered via setNodeRef.
    <button
      className="-mx-2 -my-2 px-2 py-2"
      onClick={() => onSelect?.({ col, row: "carry" })}
      ref={setNodeRef}
      type="button"
    >
      {/* Empty = discreet dashed scratch box; once a carry is posed the digit
          inks (foreground, semibold) on a softly highlighted background —
          like a highlighter stroke — so the child keeps seeing it while
          working down the column. */}
      <span
        className={cn(
          "flex h-7 w-9 items-center justify-center rounded-lg border border-muted-foreground/30 border-dashed text-base",
          value
            ? "bg-primary/10 font-semibold text-foreground"
            : "text-muted-foreground",
          (selected || isOver) && "border-2 border-primary border-solid"
        )}
      >
        {value}
      </span>
    </button>
  );
}
