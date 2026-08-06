import { Colophon } from "~/components/printable-story";
import { useLocale, useMessages } from "~/lib/i18n";
import { type Grille, REGIONS, type Taille } from "~/lib/sudoku";

/**
 * Print-only A5 sheet of the currently open sudoku — the paper side of the
 * mini-app (R12/AE3). The sheet is composed from the GIVENS ARRAY only
 * (KTD6) : the prop shape carries neither the child's entries nor the
 * solution, so printing from the grid or the comparison view can never leak
 * them — by construction, not by filtering.
 *
 * Calm by construction: no instructions, no URL, no header noise — just the
 * catalog title, the blank grid to fill in pencil, and the discreet colophon
 * (same idiom as PrintableOperationsSheet / PrintableStory).
 *
 * One geometry source: the thick region borders derive from the SAME REGIONS
 * table as the on-screen grid (sudoku-grid.tsx) — right border every boxCols
 * columns, bottom border every boxRows rows, outer frame on the container.
 */

/** Cell sides per taille — the sheet fits A5 portrait (usable width ~116mm
    inside the 18mm/16mm booklet margins): 9×9 → 108mm, 6×6 → 84mm,
    4×4 → 64mm. */
const CELL_MM: Record<Taille, number> = { 4: 16, 6: 14, 9: 12 };

/** Given-digit size follows the cell so the ink keeps the same presence. */
const DIGIT_PT: Record<Taille, string> = { 4: "20pt", 6: "18pt", 9: "16pt" };

/** Region/outer borders — the only drawn aid, same weights as the fiche de
    calcul (1.2pt #444); thin inner lines stay light pencil guides. */
const THICK_BORDER = "1.2pt solid #444";
const THIN_BORDER = "0.4pt solid #999";

export function PrintableSudoku({
  givens,
  taille,
}: {
  /** Les chiffres donnés (0 = case à compléter, imprimée vide). */
  givens: Grille;
  taille: Taille;
}) {
  // La fiche s'imprime dans la langue de l'atelier au moment de l'impression
  // (le papier n'a pas de langue figée) — le colophon suit la même langue.
  const m = useMessages();
  const locale = useLocale();
  const { cols: boxCols, rows: boxRows } = REGIONS[taille];
  const cellMm = CELL_MM[taille];
  const indices = Array.from({ length: taille * taille }, (_, i) => i);
  return (
    <article className="printable-story hidden">
      <h1
        className="mb-12 text-center font-bold"
        style={{ fontSize: "24pt", lineHeight: 1.3 }}
      >
        {m.sudoku.titreFiche}
      </h1>
      <div
        style={{
          breakInside: "avoid",
          display: "flex",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            border: THICK_BORDER,
            display: "grid",
            gridTemplateColumns: `repeat(${taille}, ${cellMm}mm)`,
          }}
        >
          {indices.map((index) => {
            const row = Math.floor(index / taille);
            const col = index % taille;
            const style: React.CSSProperties = {
              alignItems: "center",
              display: "flex",
              fontSize: DIGIT_PT[taille],
              height: `${cellMm}mm`,
              justifyContent: "center",
              lineHeight: 1,
              width: `${cellMm}mm`,
            };
            // Le cadre du conteneur ferme la grille — chaque case ne dessine
            // que son bord droit/bas, épais à la frontière d'une région
            // (même dérivation que cellBorders côté écran).
            if (col < taille - 1) {
              style.borderRight =
                (col + 1) % boxCols === 0 ? THICK_BORDER : THIN_BORDER;
            }
            if (row < taille - 1) {
              style.borderBottom =
                (row + 1) % boxRows === 0 ? THICK_BORDER : THIN_BORDER;
            }
            return (
              <span key={index} style={style}>
                {givens[index] || ""}
              </span>
            );
          })}
        </div>
      </div>
      <Colophon lang={locale} />
    </article>
  );
}
