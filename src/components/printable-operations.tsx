import { useLocale } from "~/lib/i18n";
import {
  type EnonceEntities,
  enonceFor,
  layoutOperation,
} from "~/lib/operations";
import type { GeneratedOperation } from "~/lib/operations/types";
import { Colophon } from "./printable-story";

/**
 * Print-only A5 sheet of posed operations to complete in pencil — the paper
 * side of the mini-app (design decision T1-A: paper ships first, the screen
 * gesture waits for the school's answer). The grid geometry comes from the
 * SAME layoutOperation as the on-screen grid (decision 3A) so Arsène sees
 * one single shape, on glass and on paper.
 *
 * Calm by construction: no instructions, no numbering pressure, no score
 * line — just the énoncé (optional), the posed operation with empty result
 * boxes and empty carry slots, and the discreet colophon.
 */

const CELL_MM = 11;

function GridCell({
  children,
  variant,
}: {
  children?: string;
  variant: "digit" | "carry" | "result" | "blank";
}) {
  const base: React.CSSProperties = {
    alignItems: "center",
    display: "flex",
    fontSize: variant === "carry" ? "10pt" : "20pt",
    height: variant === "carry" ? `${CELL_MM * 0.6}mm` : `${CELL_MM}mm`,
    justifyContent: "center",
    lineHeight: 1,
    width: `${CELL_MM}mm`,
  };
  if (variant === "carry") {
    return (
      <span
        style={{ ...base, border: "0.3pt dashed #bbb", borderRadius: "1.5mm" }}
      >
        {children}
      </span>
    );
  }
  if (variant === "result") {
    return (
      <span
        style={{ ...base, border: "0.4pt solid #999", borderRadius: "1.5mm" }}
      >
        {children}
      </span>
    );
  }
  return <span style={base}>{children}</span>;
}

function CarrySpacer() {
  return (
    <span style={{ height: `${CELL_MM * 0.6}mm`, width: `${CELL_MM}mm` }} />
  );
}

function PrintedOperation({
  operation,
  entities,
}: {
  operation: GeneratedOperation;
  entities?: EnonceEntities;
}) {
  // La fiche s'imprime dans la langue de l'atelier au moment de l'impression
  // (le papier n'a pas de langue figée — c'est le parent qui imprime).
  const locale = useLocale();
  const layout = layoutOperation(operation);
  const rowStyle: React.CSSProperties = {
    display: "flex",
    gap: "1.5mm",
    justifyContent: "center",
  };
  return (
    <div style={{ breakInside: "avoid" }}>
      {entities ? (
        <p
          className="mb-4 text-center"
          style={{ fontSize: "13pt", lineHeight: 1.6 }}
        >
          {enonceFor(operation, entities, locale)}
        </p>
      ) : null}
      <div className="space-y-1">
        {/* Carry slots: empty dashed boxes, to write the little "1" in pencil. */}
        <div style={rowStyle}>
          <CarrySpacer />
          {layout.carrySlots.map((slot, i) =>
            slot ? (
              <GridCell key={`c-${operation.seed}-${i}`} variant="carry" />
            ) : (
              <CarrySpacer key={`c-${operation.seed}-${i}`} />
            )
          )}
        </div>
        <div style={rowStyle}>
          <GridCell variant="blank" />
          {layout.operandRows[0].map((d, i) => (
            <GridCell key={`a-${operation.seed}-${i}`} variant="digit">
              {d}
            </GridCell>
          ))}
        </div>
        <div style={rowStyle}>
          <GridCell variant="digit">{layout.sign}</GridCell>
          {layout.operandRows[1].map((d, i) => (
            <GridCell key={`b-${operation.seed}-${i}`} variant="digit">
              {d}
            </GridCell>
          ))}
        </div>
        <div
          style={{
            borderTop: "1.2pt solid #444",
            margin: "1mm auto 1.5mm",
            // n+1 cells have only n gaps — no 1.5mm overhang on the sheet.
            width: `${(layout.columnCount + 1) * CELL_MM + layout.columnCount * 1.5}mm`,
          }}
        />
        <div style={rowStyle}>
          <GridCell variant="blank" />
          {layout.expectedDigits.map((_, i) => (
            <GridCell key={`r-${operation.seed}-${i}`} variant="result" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function PrintableOperationsSheet({
  title,
  operations,
  entities,
}: {
  title: string;
  operations: GeneratedOperation[];
  entities?: EnonceEntities;
}) {
  // La fiche s'imprime dans la langue de l'ATELIER (locale UI) — le colophon
  // suit la même langue.
  const locale = useLocale();
  return (
    <article className="printable-story hidden">
      <h1
        className="mb-12 text-center font-bold"
        style={{ fontSize: "24pt", lineHeight: 1.3 }}
      >
        {title}
      </h1>
      <div className="space-y-14">
        {operations.map((operation) => (
          <PrintedOperation
            entities={entities}
            key={`print-op-${operation.seed}`}
            operation={operation}
          />
        ))}
      </div>
      <Colophon lang={locale} />
    </article>
  );
}
