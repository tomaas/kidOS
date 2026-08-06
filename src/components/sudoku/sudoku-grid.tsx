import { useDroppable } from "@dnd-kit/core";
import { cn } from "~/lib/cn";
import { formatMessage, useMessages } from "~/lib/i18n";
import type { Grille, GrilleStateLike } from "~/lib/sudoku";
import { isGivenCell, REGIONS, type Taille } from "~/lib/sudoku";

/**
 * La grille de sudoku à l'écran — même philosophie d'« écriture libre » que
 * la ColumnGrid du calcul posé : chaque chiffre s'encre comme au crayon, la
 * grille ne juge JAMAIS un chiffre (pas de rouge, pas de message, pas de
 * marquage — AE1). La vérification est un geste de comparaison, côté route.
 *
 * R5 : les cases données sont visuellement distinctes (semibold) et INERTES —
 * un tap ne sélectionne pas, un drop n'y dépose rien (writeCell garde déjà ;
 * la case donnée n'est même pas une cible dnd, donc aucun flash visuel).
 * R6 : les bordures épaisses des régions sont la SEULE aide dessinée —
 * dérivées de la géométrie REGIONS (bord droit toutes les boxCols colonnes,
 * bord bas toutes les boxRows rangées), cadre extérieur le plus épais.
 * R4 : la sélection reste en place après l'écriture (gérée par la route).
 */

/** Une case adressable de la grille, telle qu'elle traverse dnd-kit. */
export interface SudokuCellRef {
  col: number;
  row: number;
}

/** The droppable payload crosses dnd-kit untyped — validate, never cast. */
export function isSudokuCellRef(value: unknown): value is SudokuCellRef {
  const cell = value as SudokuCellRef | null;
  return (
    typeof cell === "object" &&
    cell !== null &&
    typeof cell.row === "number" &&
    typeof cell.col === "number"
  );
}

/**
 * Tailles de case par taille de grille — la 9×9 se comprime (clamp) pour que
 * grille + pavé tiennent dans une hauteur de téléphone sans défilement.
 * Littéraux Tailwind obligatoires (le scanner JIT ne voit pas une
 * interpolation).
 */
const CELL_SIZE_CLASS: Record<Taille, string> = {
  4: "size-14 text-2xl sm:size-16 sm:text-3xl",
  6: "size-11 text-xl sm:size-14 sm:text-2xl",
  9: "size-8 text-base sm:size-11 sm:text-xl",
};

// Littéraux Tailwind par taille (même règle JIT que CELL_SIZE_CLASS).
const GRID_TEMPLATE_CLASS: Record<Taille, string> = {
  4: "grid-cols-4",
  6: "grid-cols-6",
  9: "grid-cols-9",
};

/** Bordures fines intérieures — encre douce, jamais un signal. */
const THIN_BORDER = "border-muted-foreground/30";
/** Bordures épaisses des régions — la seule aide (R6). */
const THICK_BORDER = "border-foreground/60";

function cellBorders(taille: Taille, row: number, col: number): string {
  const { cols: boxCols, rows: boxRows } = REGIONS[taille];
  const lastCol = col === taille - 1;
  const lastRow = row === taille - 1;
  return cn(
    // Bord droit/bas de chaque case (le cadre du conteneur ferme la grille).
    !lastCol &&
      ((col + 1) % boxCols === 0
        ? `border-r-2 ${THICK_BORDER}`
        : `border-r ${THIN_BORDER}`),
    !lastRow &&
      ((row + 1) % boxRows === 0
        ? `border-b-2 ${THICK_BORDER}`
        : `border-b ${THIN_BORDER}`)
  );
}

function buildCellBorders(taille: Taille): readonly string[] {
  return Array.from({ length: taille * taille }, (_, index) =>
    cellBorders(taille, Math.floor(index / taille), index % taille)
  );
}

// Bordures figées au niveau module : elles ne dépendent que de la taille,
// mais chaque frappe re-rend la grille entière (writeCell change l'identité
// de l'état) — jusqu'à 81 chaînes par rendu sans ce gel.
const CELL_BORDERS: Record<Taille, readonly string[]> = {
  4: buildCellBorders(4),
  6: buildCellBorders(6),
  9: buildCellBorders(9),
};

/**
 * Gabarit d'aria par état de case : donnée (inerte), remplie par l'enfant
 * (le chiffre écrit s'annonce — {chiffre}) ou encore à compléter. Les
 * gabarits eux-mêmes vivent dans le catalogue (parité fr↔en épinglée).
 */
function ariaCelluleTemplate(
  aria: { donnee: string; remplie: string; vide: string },
  given: boolean,
  digit: number | null
): string {
  if (given) {
    return aria.donnee;
  }
  return digit === null ? aria.vide : aria.remplie;
}

/**
 * Variantes de rendu :
 * - "libre"    : la grille de travail — cases à compléter tapables ET cibles
 *                de drop, cases données inertes.
 * - "lecture"  : la grille de l'enfant relue dans la comparaison — mêmes
 *                encres, aucune interaction, RIEN de marqué (AE1).
 * - "solution" : la grille terminée — encre en retrait, comme la variante
 *                solution de la ColumnGrid du calcul.
 */
export function SudokuGrid({
  state,
  givens,
  selected,
  onSelect,
  variant,
}: {
  state: GrilleStateLike;
  /** Les chiffres donnés (0 = à compléter) — ou la solution en "solution". */
  givens: Grille;
  selected?: number | null;
  onSelect?: (index: number) => void;
  variant: "libre" | "lecture" | "solution";
}) {
  const m = useMessages();
  const { taille } = state;
  const sizeClass = CELL_SIZE_CLASS[taille];
  const cellBorderList = CELL_BORDERS[taille];
  return (
    <div
      className={cn(
        "grid w-fit overflow-hidden rounded-xl border-2 bg-card",
        THICK_BORDER,
        GRID_TEMPLATE_CLASS[taille],
        variant === "solution" && "opacity-80"
      )}
    >
      {cellBorderList.map((borders, index) => {
        const row = Math.floor(index / taille);
        const col = index % taille;
        if (variant === "solution") {
          return (
            <span
              className={cn(
                sizeClass,
                borders,
                "flex items-center justify-center text-muted-foreground"
              )}
              key={index}
            >
              {givens[index] || ""}
            </span>
          );
        }
        const given = isGivenCell(state, index);
        const digit = given ? givens[index] : state.entries[index];
        const ariaLabel = formatMessage(
          ariaCelluleTemplate(m.sudoku.ariaCellule, given, digit),
          {
            chiffre: digit === null ? "" : String(digit),
            colonne: String(col + 1),
            ligne: String(row + 1),
          }
        );
        if (variant === "lecture" || given) {
          // Case donnée (inerte, R5) ou grille relue en comparaison : le
          // chiffre s'annonce, rien ne se touche.
          return (
            <span
              aria-label={ariaLabel}
              className={cn(
                sizeClass,
                borders,
                "flex items-center justify-center",
                given && "font-semibold text-foreground"
              )}
              key={index}
              role="img"
            >
              {digit ?? ""}
            </span>
          );
        }
        return (
          <LibreCell
            ariaLabel={ariaLabel}
            className={cn(sizeClass, borders)}
            col={col}
            index={index}
            key={index}
            onSelect={onSelect}
            row={row}
            selected={selected === index}
            value={state.entries[index]}
          />
        );
      })}
    </div>
  );
}

/**
 * Une case à compléter : tap-à-sélectionner ET cible de drop d'un chiffre.
 * Le survol de drop réutilise l'emphase de sélection — poser un chiffre et
 * choisir une case sont le même geste doux, jamais un nouveau signal.
 */
function LibreCell({
  ariaLabel,
  className,
  col,
  index,
  onSelect,
  row,
  selected,
  value,
}: {
  ariaLabel: string;
  className: string;
  col: number;
  index: number;
  onSelect?: (index: number) => void;
  row: number;
  selected: boolean;
  value: number | null;
}) {
  const { isOver, setNodeRef } = useDroppable({
    data: { cell: { col, row } satisfies SudokuCellRef },
    id: `drop-cell-${row}-${col}`,
  });
  return (
    <button
      aria-label={ariaLabel}
      className={cn(
        className,
        "flex items-center justify-center focus-visible:outline-2 focus-visible:outline-primary/60",
        (selected || isOver) && "bg-primary/10 ring-2 ring-primary ring-inset"
      )}
      onClick={() => onSelect?.(index)}
      ref={setNodeRef}
      type="button"
    >
      {value ?? ""}
    </button>
  );
}
