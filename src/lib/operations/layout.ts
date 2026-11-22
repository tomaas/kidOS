/**
 * layoutOperation — la seule vérité géométrique de l'opération posée
 * (décision eng-review 3A). Consommée par la grille écran ET le gabarit
 * A5 imprimé : Arsène voit exactement la même forme au doigt et au crayon.
 *
 * Grille abstraite, sans unité ni pixel : des colonnes numériques alignées
 * à droite (au plus 4 — jusqu'aux milliers), une rangée de cases de retenue,
 * les rangées d'opérandes (le signe accroché à la dernière), un trait, la
 * rangée de résultat. Le rendu (React ou print) ne décide de rien.
 */

import type { GeneratedOperation, Operation } from "~/lib/operations/types";

export interface OperationLayout {
  /**
   * Cases de retenue au-dessus des colonnes, indexées de gauche à droite.
   * true = une retenue/un emprunt peut s'écrire là (jamais sur les unités).
   */
  carrySlots: boolean[];
  /** Nombre de colonnes numériques (celles du résultat, les plus larges). */
  columnCount: number;
  /** Chiffres attendus du résultat, alignés sur columnCount ("" à gauche). */
  expectedDigits: string[];
  op: Operation;
  /** Rangées d'opérandes : chiffres alignés à droite, "" pour case vide. */
  operandRows: string[][];
  sign: "+" | "−" | "×";
}

function padLeft(digits: string, width: number): string[] {
  return [
    ...Array.from({ length: width - digits.length }, () => ""),
    ...digits.split(""),
  ];
}

const SIGNS: Record<Operation, "+" | "−" | "×"> = {
  addition: "+",
  multiplication: "×",
  soustraction: "−",
};

export function layoutOperation(op: GeneratedOperation): OperationLayout {
  const expectedStr = String(op.expected);
  const columnCount = Math.max(
    expectedStr.length,
    String(op.a).length,
    String(op.b).length
  );
  // Une retenue peut s'écrire au-dessus de toute colonne sauf celle des
  // unités (colonne la plus à droite) ; l'emprunt se note pareil, en haut.
  const carrySlots = Array.from(
    { length: columnCount },
    (_, i) => i < columnCount - 1
  );
  return {
    carrySlots,
    columnCount,
    expectedDigits: padLeft(expectedStr, columnCount),
    op: op.op,
    operandRows: [
      padLeft(String(op.a), columnCount),
      padLeft(String(op.b), columnCount),
    ],
    sign: SIGNS[op.op],
  };
}
