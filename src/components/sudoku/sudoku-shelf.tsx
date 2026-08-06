/**
 * L'étagère de plateaux — le geste de choix de la mini-app sudoku, même
 * coquille que la TrayShelf du calcul posé (géométrie de plateau, décalage
 * « sorti », rangée qui ne wrappe jamais, empilement < sm).
 *
 * Composant PRÉSENTATIONNEL (les données viennent de la route) : un plateau
 * par taille ACTIVÉE (une taille non activée n'existe pas à l'écran — R2,
 * jamais de plateau grisé ni de cadenas), dans l'ordre canonique TAILLES.
 * La scène est un simple glyphe de mini-grille en aria-hidden — statique,
 * SANS chiffres, dans la palette de l'app (les variantes par jour du calcul
 * sont volontairement absentes ici — différé). Aucun mot de niveau : des
 * mots de TAILLE seulement (sudoku.tailles), et l'aria-label du plateau ne
 * change jamais à langue constante (« Prendre le plateau petite grille… » +
 * suffixe « grille en cours » quand une grille est sortie).
 */

import { palette } from "~/config/style";
import { cn } from "~/lib/cn";
import { formatMessage, useMessages } from "~/lib/i18n";
import { REGIONS, type Taille } from "~/lib/sudoku";

export interface SudokuTrayInfo {
  /** Grille en cours reprenable (prédicat complet, jamais « la clé existe »). */
  sorti: boolean;
  taille: Taille;
}

// Le décalage « sorti » : ces DEUX classes portent le même 18px — le plateau
// descend d'autant que la rangée réserve, la hauteur de l'étagère ne saute
// jamais selon l'état. (Littéraux Tailwind obligatoires : le scanner JIT ne
// voit pas une interpolation — modifier les deux ensemble.)
const SORTI_SHIFT_CLASS = "translate-y-[18px]";
const SORTI_RESERVE_CLASS = "pb-[18px]";

/**
 * Le glyphe de mini-grille d'une taille : la grille vide avec ses régions —
 * traits fins encre douce, régions marquées, AUCUN chiffre. C'est la densité
 * du quadrillage qui distingue les plateaux, comme la vraie grille derrière.
 */
function GrilleGlyph({ taille }: { taille: Taille }) {
  const { cols: boxCols, rows: boxRows } = REGIONS[taille];
  const size = 64;
  const step = size / taille;
  // Les traits intérieurs (1..taille-1) — verticaux puis horizontaux.
  const inner = Array.from({ length: taille - 1 }, (_, k) => k + 1);
  const lines = [
    ...inner.map((i) => {
      const thick = i % boxCols === 0;
      return (
        <line
          key={`v-${i}`}
          opacity={thick ? 0.55 : 0.25}
          stroke={palette.ink}
          strokeWidth={thick ? 2 : 1}
          x1={i * step}
          x2={i * step}
          y1={0}
          y2={size}
        />
      );
    }),
    ...inner.map((i) => {
      const thick = i % boxRows === 0;
      return (
        <line
          key={`h-${i}`}
          opacity={thick ? 0.55 : 0.25}
          stroke={palette.ink}
          strokeWidth={thick ? 2 : 1}
          x1={0}
          x2={size}
          y1={i * step}
          y2={i * step}
        />
      );
    }),
  ];
  return (
    <svg
      aria-hidden="true"
      className="h-16 w-full"
      role="presentation"
      viewBox="-4 -4 72 72"
    >
      <rect
        fill={palette.background}
        height={size}
        rx={6}
        stroke={palette.ink}
        strokeWidth={2.5}
        width={size}
        x={0}
        y={0}
      />
      {lines}
    </svg>
  );
}

/* -------------------------------- Étagère -------------------------------- */

export function SudokuShelf({
  trays,
  onTake,
}: {
  trays: SudokuTrayInfo[];
  onTake: (taille: Taille) => void;
}) {
  return (
    <div className="flex w-full flex-1 flex-col justify-center">
      {/* Rangée d'étagère (≥ sm) : plateaux compressibles, JAMAIS de wrap ;
          les 18px du décalage « sorti » sont réservés (pb) pour que la
          hauteur de la rangée ne saute pas selon l'état. */}
      <div
        className={cn(
          "flex w-full flex-nowrap items-end justify-center gap-6 max-sm:hidden",
          SORTI_RESERVE_CLASS
        )}
      >
        {trays.map((tray) => (
          <Tray key={tray.taille} onTake={onTake} tray={tray} />
        ))}
      </div>
      {/* Empilement (< sm) : mêmes plateaux, même réserve de décalage. */}
      <div className="flex w-full flex-col items-center gap-8 sm:hidden">
        {trays.map((tray) => (
          <div className={SORTI_RESERVE_CLASS} key={tray.taille}>
            <Tray onTake={onTake} tray={tray} />
          </div>
        ))}
      </div>
    </div>
  );
}

function Tray({
  tray,
  onTake,
}: {
  tray: SudokuTrayInfo;
  onTake: (taille: Taille) => void;
}) {
  const m = useMessages();
  return (
    <button
      aria-label={`${formatMessage(m.sudoku.prendrePlateau, { taille: m.sudoku.tailles[tray.taille] })}${tray.sorti ? m.sudoku.grilleEnCours : ""}`}
      className={cn(
        // Le plateau ENTIER est la cible, ≥160px de haut ; même grammaire que
        // les portes de l'accueil : crème, bord encre doux, rounded-2xl.
        "flex min-h-40 w-[clamp(160px,28vw,240px)] shrink flex-col items-center justify-between gap-2 rounded-2xl border bg-card px-4 py-4",
        "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        "hover:shadow-sm",
        "transition duration-300 motion-reduce:transition-none",
        // « Sorti » : décalage + ombre douce UNIQUEMENT.
        tray.sorti && cn(SORTI_SHIFT_CLASS, "shadow-md")
      )}
      onClick={() => onTake(tray.taille)}
      type="button"
    >
      {/* La scène ne se nomme pas à l'écran ; elle est muette pour ARIA. */}
      <span aria-hidden="true" className="w-full">
        <GrilleGlyph taille={tray.taille} />
      </span>
      <span aria-hidden="true" className="text-base text-muted-foreground">
        {m.sudoku.tailles[tray.taille]}
      </span>
    </button>
  );
}
