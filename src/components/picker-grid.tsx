import { cn } from "~/lib/cn";

export interface PickerItem {
  emoji: string;
  id: string;
  label: string;
}

interface PickerGridProps {
  items: PickerItem[];
  onSelect: (id: string) => void;
  // Single-select highlight (hero / place / element).
  selectedId?: string;
  // Multi-select highlight (the doudou step): several rings lit at once.
  selectedIds?: string[];
}

/**
 * Shared grid of big, friendly, tappable choices used for hero / place /
 * element / doudou. Large emoji + the word written underneath (the child reads).
 * No counters, no scores — just calm choices. Highlights a single pick
 * (`selectedId`) or, for the multi-select doudou step, every pick in
 * `selectedIds`.
 */
export function PickerGrid({
  items,
  selectedId,
  selectedIds,
  onSelect,
}: PickerGridProps) {
  const isSelected = (id: string) =>
    id === selectedId || (selectedIds?.includes(id) ?? false);
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
      {items.map((item) => (
        <button
          className={cn(
            "relative flex flex-col items-center justify-center gap-3 rounded-3xl border-2 bg-card p-6 text-center transition-all",
            "hover:-translate-y-0.5 hover:border-primary/50",
            isSelected(item.id)
              ? "border-primary bg-primary/5 shadow-sm"
              : "border-border"
          )}
          key={item.id}
          onClick={() => onSelect(item.id)}
          type="button"
        >
          {/* A small check ribbon on a selected tile so multi-select reads
              clearly (the ring alone is subtle when several are lit). */}
          {selectedIds && isSelected(item.id) ? (
            <span
              aria-hidden="true"
              className="absolute -top-2 -right-2 flex size-7 items-center justify-center rounded-full bg-primary text-sm text-primary-foreground shadow-sm"
            >
              ✓
            </span>
          ) : null}
          <span aria-hidden="true" className="text-6xl">
            {item.emoji}
          </span>
          <span className="text-2xl leading-tight font-semibold">
            {item.label}
          </span>
        </button>
      ))}
    </div>
  );
}
