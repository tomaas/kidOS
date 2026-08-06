import { Printer } from "lucide-react";
import { SudokuGrid } from "~/components/sudoku/sudoku-grid";
import { Button } from "~/components/ui/button";
import { useMessages } from "~/lib/i18n";
import type { GrilleStateLike, Puzzle } from "~/lib/sudoku";

/**
 * La comparaison (R7/AE1) : la grille de l'enfant et la grille terminée,
 * côte à côte (≥ lg) ou empilées (< lg) — RIEN n'est marqué, aucune case
 * n'est comparée pour lui (aucun style par case, aucun diff) : c'est
 * l'enfant qui regarde, ligne par ligne s'il veut, comme au calcul posé.
 *
 * Trois affordances calmes et DISTINCTES : revenir à sa grille (l'amender
 * reste permis — l'état de comparaison n'est jamais persisté), la ranger
 * (le geste de fin, jamais un verdict), ou imprimer la grille vierge
 * (R12 — la fiche papier vient des seuls givens, voir printable-sudoku).
 */
export function Comparaison({
  state,
  puzzle,
  onRetourGrille,
  onRanger,
}: {
  state: GrilleStateLike;
  puzzle: Puzzle;
  onRetourGrille: () => void;
  onRanger: () => void;
}) {
  const m = useMessages();
  return (
    <div className="flex w-full flex-col items-center gap-8">
      <div className="flex flex-col items-center justify-center gap-6 lg:flex-row lg:items-start">
        <SudokuGrid givens={puzzle.givens} state={state} variant="lecture" />
        <SudokuGrid givens={puzzle.solution} state={state} variant="solution" />
      </div>
      {/* Rangée d'actions. L'impression (R12/AE3) sort la grille VIERGE :
          la fiche montée par la route est composée des seuls givens (KTD6)
          et cet écran-ci porte no-print — rien de ce qui est affiché ici
          (entrées, solution) ne peut atteindre le papier. */}
      <div className="flex flex-wrap items-center justify-center gap-4">
        <Button
          className="gap-2 text-muted-foreground text-xl"
          onClick={onRetourGrille}
          variant="ghost"
        >
          {m.sudoku.retourGrille}
        </Button>
        <Button
          className="gap-2 text-muted-foreground text-xl"
          onClick={onRanger}
          variant="ghost"
        >
          {m.sudoku.ranger}
        </Button>
        <Button
          className="gap-2 text-muted-foreground text-xl"
          onClick={() => window.print()}
          type="button"
          variant="ghost"
        >
          <Printer className="size-5" />
          {m.sudoku.imprimer}
        </Button>
      </div>
    </div>
  );
}
