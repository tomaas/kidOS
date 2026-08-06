import {
  type CollisionDetection,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  pointerWithin,
  rectIntersection,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { createFileRoute } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  DIGIT_TILE_CLASSES,
  SoftNumpad,
} from "~/components/calcul/soft-numpad";
import { Comparaison } from "~/components/sudoku/comparaison";
import { isSudokuCellRef, SudokuGrid } from "~/components/sudoku/sudoku-grid";
import {
  SudokuShelf,
  type SudokuTrayInfo,
} from "~/components/sudoku/sudoku-shelf";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/cn";
import { useMessages } from "~/lib/i18n";
import { browserSerieStorage } from "~/lib/operations";
import {
  eraseCell,
  type GrilleStateLike,
  generateSudoku,
  isGivenCell,
  isGrilleComplete,
  loadSession,
  putAway,
  type SudokuSettings,
  saveGrille,
  shelfTrays,
  type Taille,
  takeTray,
  writeCell,
} from "~/lib/sudoku";
import { getSudokuSettingsFn } from "~/server/sudoku-functions";

/** 2A: a slow DB is treated like an unreachable one — short timeout, no error. */
function withTimeout<T>(
  promise: Promise<T>,
  fallback: T,
  ms = 3000
): Promise<T> {
  return Promise.race([
    promise.catch(() => fallback),
    new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms)),
  ]);
}

export const Route = createFileRoute("/_bureau/sudoku/")({
  component: SudokuWorkshopPage,
  // Network resilience (même règle que /calcul) : une DB en panne ou lente
  // ne bloque JAMAIS l'enfant — le loader avale l'échec ET borne l'attente ;
  // le composant retombe sur les réglages cachés sur l'appareil. La
  // génération et les grilles sont 100 % locales.
  loader: async () => ({
    settings: await withTimeout(getSudokuSettingsFn(), null),
  }),
});

// Toute la vie de la grille hors rendu (clé localStorage par taille, reprise
// sur empreinte, purge authoritative, gestes d'écriture) vit dans le module
// pur ~/lib/sudoku (golden-testé) ; la route ne fait que le rendu et le dnd.
// Même port de stockage que le calcul — l'adaptateur ne touche window qu'à
// l'appel, sûr au niveau module.
const storage = browserSerieStorage();

// Durée du moment « rangé » (miroir de TIDIED_MOMENT_MS côté calcul) :
// 🌿 respire, puis fondu vers l'étagère — jamais un écran-destination.
const RANGE_MOMENT_MS = 1600;

// 8px of travel before a drag starts: a plain tap stays a click. Hoisted so
// dnd-kit's useSensor memo keeps a stable options identity across renders.
const POINTER_ACTIVATION = { activationConstraint: { distance: 8 } };

/**
 * Forgiving drop detection for small fingers: precise when the fingertip is
 * inside a cell (pointerWithin), else the cell the tile overlaps most counts
 * (rectIntersection) — a near-miss inks the obvious cell instead of nothing.
 */
const forgivingCollision: CollisionDetection = (args) => {
  const within = pointerWithin(args);
  return within.length > 0 ? within : rectIntersection(args);
};

/**
 * Les quatre temps de l'atelier (KTD10) : l'étagère (le choix), la grille
 * (le travail), la comparaison (le geste calme de vérification — jamais
 * persistée : rouvrir reprend la grille pleine, modifiable) et le moment
 * « rangé » (la transition de fin, miroir de la phase tidied du calcul).
 * Phase en état local, pas de route.
 */
type Phase =
  | { kind: "etagere" }
  | { kind: "grille"; taille: Taille }
  | { kind: "comparaison"; taille: Taille }
  | { kind: "range"; taille: Taille };

/**
 * La mini-app sudoku — « la grille qui se range ».
 *
 * Mêmes gestes que le calcul posé : tap dans une case + pavé doux, ou la
 * tuile de chiffre glissée sur la case (R3/R4). Tout s'encre comme au
 * crayon, jamais de rouge, jamais de verdict (AE1) : quand la grille est
 * pleine, une affordance de COMPARAISON apparaît — rien d'automatique — et
 * l'enfant regarde les deux grilles côte à côte, amende ou range (R7).
 */
function SudokuWorkshopPage() {
  const m = useMessages();
  const { settings: dbSettings } = Route.useLoaderData();
  const [settings, setSettings] = useState<SudokuSettings | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "etagere" });
  const [grille, setGrille] = useState<GrilleStateLike | null>(null);
  // La case sélectionnée (index à plat) — le crayon posé. R4 : écrire laisse
  // la sélection EN PLACE (pas d'avance automatique, contrairement au calcul
  // où le crayon descend la colonne).
  const [selected, setSelected] = useState<number | null>(null);
  // Digit currently being dragged from the numpad (drives the DragOverlay).
  const [dragDigit, setDragDigit] = useState<string | null>(null);
  // On touch, implicit pointer capture retargets the post-drag click onto the
  // numpad key — this one-shot flag swallows that ghost click so a drag never
  // ALSO writes into the selected cell. Consumed by the first suppressed
  // click; the fallback timer covers pointers that never emit one (a mouse
  // released away from the key).
  const dragJustEndedRef = useRef(false);
  const sensors = useSensors(useSensor(PointerSensor, POINTER_ACTIVATION));

  // Ouverture de session (loadSession, module pur golden-testé) : réglages
  // DB → cache appareil → défauts, normalisés quelle que soit la source,
  // cache + purge des grilles orphelines SEULEMENT sur réglages
  // authoritatifs (KTD8).
  useEffect(() => {
    setSettings(loadSession(storage, dbSettings));
  }, [dbSettings]);

  // Persistance : chaque frappe est sauvegardée sous la clé de SA taille —
  // reposer le plateau ou fermer la fenêtre ne perd jamais rien.
  useEffect(() => {
    if (grille) {
      saveGrille(storage, grille);
    }
  }, [grille]);

  // Le moment « rangé » (KTD4) : putAway (la clé stockée s'efface) puis
  // retour à l'étagère — une TRANSITION, jamais une destination.
  useEffect(() => {
    if (phase.kind !== "range") {
      return;
    }
    const timer = setTimeout(() => {
      putAway(storage, phase.taille);
      setGrille(null);
      setPhase({ kind: "etagere" });
    }, RANGE_MOMENT_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  // La grille générée (givens + solution), régénérée déterministe depuis
  // (taille, generosite, seed) — KTD5. Deps = les seules valeurs qui pilotent
  // la génération : l'objet grille change d'identité à chaque frappe et ne
  // doit pas relancer le générateur.
  const grilleTaille = grille?.taille;
  const grilleGenerosite = grille?.generosite;
  const grilleSeed = grille?.seed;
  const puzzle = useMemo(() => {
    if (
      grilleTaille === undefined ||
      grilleGenerosite === undefined ||
      grilleSeed === undefined
    ) {
      return null;
    }
    try {
      return generateSudoku(grilleTaille, grilleGenerosite, grilleSeed);
    } catch {
      // KTD5 : un jet inattendu retombe sur l'étagère, en silence.
      return null;
    }
  }, [grilleTaille, grilleGenerosite, grilleSeed]);

  // Filet KTD5 : une grille sans puzzle (générateur qui a jeté) ne reste
  // jamais à l'écran — retour calme à l'étagère, jamais une erreur.
  useEffect(() => {
    if (grille && puzzle === null) {
      setGrille(null);
      setSelected(null);
      setPhase({ kind: "etagere" });
    }
  }, [grille, puzzle]);

  // L'état « sorti » des plateaux : lecture localStorage + vérification
  // d'empreinte bornées à UNE entrée d'étagère — memo sur (settings, phase),
  // jamais à chaque rendu.
  const trays = useMemo<SudokuTrayInfo[]>(
    () =>
      settings && phase.kind === "etagere" ? shelfTrays(storage, settings) : [],
    [settings, phase]
  );

  /** Prendre un plateau (takeTray, module pur) : reprise exacte si la grille
      est reprenable, sinon grille fraîche à la générosité parentale de CETTE
      taille. Un jet inattendu laisse l'enfant sur l'étagère, en silence. */
  function prendrePlateau(taille: Taille) {
    if (!settings) {
      return;
    }
    try {
      const state = takeTray(storage, settings, taille);
      setSelected(null);
      setGrille(state);
      setPhase({ kind: "grille", taille });
    } catch {
      // KTD5 : jamais une erreur devant l'enfant.
    }
  }

  /** « Reposer le plateau » (R9) : retour à l'étagère, sans perte — la
      grille est sauvegardée à chaque frappe. */
  function reposerPlateau() {
    setSelected(null);
    setGrille(null);
    setPhase({ kind: "etagere" });
  }

  if (!settings) {
    // First client render (hydration-safe): the calm background, nothing
    // else — l'étagère n'apparaît qu'une fois settings + localStorage
    // résolus côté client, en fondu d'ensemble.
    return <div className="min-h-[80vh]" />;
  }

  if (phase.kind === "etagere") {
    return (
      <WorkshopShell>
        <FadeIn>
          <SudokuShelf onTake={prendrePlateau} trays={trays} />
        </FadeIn>
      </WorkshopShell>
    );
  }

  if (phase.kind === "range") {
    return (
      <WorkshopShell>
        <RangeMoment />
      </WorkshopShell>
    );
  }

  if (!(grille && puzzle)) {
    // L'effet KTD5 ci-dessus ramène à l'étagère au prochain rendu.
    return <div className="min-h-[80vh]" />;
  }

  if (phase.kind === "comparaison") {
    return (
      <WorkshopShell onReposer={reposerPlateau}>
        <FadeIn>
          <Comparaison
            onRanger={() => setPhase({ kind: "range", taille: grille.taille })}
            onRetourGrille={() =>
              setPhase({ kind: "grille", taille: grille.taille })
            }
            puzzle={puzzle}
            state={grille}
          />
        </FadeIn>
      </WorkshopShell>
    );
  }

  const complete = isGrilleComplete(grille);
  const numpadDigits = Array.from({ length: grille.taille }, (_, i) =>
    String(i + 1)
  );

  function setCell(index: number, digit: number | null) {
    // Everything derives from prev INSIDE the updater (never the render-time
    // closure); writeCell/eraseCell (module pur) are bounds/given-guarded: a
    // late drop or a second write in the same event can never clobber state
    // or ink a given cell.
    setGrille((prev) => {
      if (!prev) {
        return prev;
      }
      return digit === null
        ? eraseCell(prev, index)
        : writeCell(prev, index, digit);
    });
  }

  function writeDigit(digit: string) {
    if (dragJustEndedRef.current) {
      // The ghost click after a drag — swallow it and re-arm for real taps.
      dragJustEndedRef.current = false;
      return;
    }
    if (selected === null) {
      return;
    }
    // R4 : la sélection reste en place — l'enfant peut réécrire ou gommer.
    setCell(selected, Number(digit));
  }

  function erase() {
    if (selected === null) {
      return;
    }
    setCell(selected, null);
  }

  function endDrag() {
    setDragDigit(null);
    dragJustEndedRef.current = true;
    // Browsers don't guarantee the ghost click lands before a 0ms timer, so
    // the flag is one-shot (see writeDigit) with a generous fallback window.
    setTimeout(() => {
      dragJustEndedRef.current = false;
    }, 300);
  }

  function handleDragStart(event: DragStartEvent) {
    const digit = event.active.data.current?.digit;
    setDragDigit(typeof digit === "string" ? digit : null);
    // Single-pencil metaphor: the lifted tile IS the pencil now — the old
    // selection halo goes out so only the hovered cell glows during the drag.
    setSelected(null);
  }

  function handleDragEnd(event: DragEndEvent) {
    endDrag();
    const digit = event.active.data.current?.digit;
    const cell = event.over?.data.current?.cell;
    if (typeof digit !== "string" || !isSudokuCellRef(cell) || !grille) {
      return;
    }
    const index = cell.row * grille.taille + cell.col;
    // writeCell garde tout (case donnée, index hors grille, chiffre hors
    // 1..N) en rendant l'état INCHANGÉ — un drop interdit est un no-op
    // calme, sans flash (les cases données ne sont même pas des cibles).
    setCell(index, Number(digit));
    if (!isGivenCell(grille, index)) {
      // Le crayon se pose là où la tuile a atterri (même geste qu'un tap).
      setSelected(index);
    }
  }

  return (
    <WorkshopShell onReposer={reposerPlateau}>
      <DndContext
        collisionDetection={forgivingCollision}
        id="sudoku-atelier-dnd"
        onDragCancel={endDrag}
        onDragEnd={handleDragEnd}
        onDragStart={handleDragStart}
        sensors={sensors}
      >
        <SudokuGrid
          givens={puzzle.givens}
          onSelect={(index) => setSelected(index)}
          selected={selected}
          state={grille}
          variant="libre"
        />

        <SoftNumpad
          ariaErase={m.sudoku.ariaEffacer}
          digits={numpadDigits}
          onDigit={writeDigit}
          onErase={erase}
        />

        {/* Rangée d'actions — U5 y ajoutera le bouton d'impression. La
            comparaison n'apparaît que grille PLEINE (R7), et rien ne se
            déclenche tout seul : c'est un geste de l'enfant. */}
        <div className="flex flex-wrap items-center justify-center gap-4">
          {complete ? (
            <Button
              className="gap-2 text-muted-foreground text-xl"
              onClick={() =>
                setPhase({ kind: "comparaison", taille: grille.taille })
              }
              variant="ghost"
            >
              {m.sudoku.comparer}
            </Button>
          ) : null}
        </div>

        {/* The dragged digit follows the finger as a tile — same ink as a key,
          a soft shadow, nothing else. No drop animation: the digit is simply
          inked in the cell, like a pencil lifting. */}
        <DragOverlay dropAnimation={null}>
          {dragDigit ? (
            <span
              className={cn(
                DIGIT_TILE_CLASSES,
                "flex items-center justify-center border bg-background shadow-md"
              )}
            >
              {dragDigit}
            </span>
          ) : null}
        </DragOverlay>
      </DndContext>
    </WorkshopShell>
  );
}

/**
 * Common frame — la flèche n'existe qu'en grille ou en comparaison (R9,
 * « Reposer le plateau ») : sur l'étagère (et le moment « rangé »), la croix
 * de la fenêtre fait déjà le retour à l'accueil. Zone tactile ≥44px.
 */
function WorkshopShell({
  onReposer,
  children,
}: {
  onReposer?: () => void;
  children: React.ReactNode;
}) {
  const m = useMessages();
  return (
    <div className="mx-auto flex min-h-[80vh] w-full max-w-3xl flex-col items-center gap-8 py-6">
      {onReposer ? (
        <div className="w-full">
          <Button
            aria-label={m.sudoku.ariaReposerPlateau}
            className="min-h-11 min-w-11 gap-2 text-lg text-muted-foreground"
            onClick={onReposer}
            variant="ghost"
          >
            <ArrowLeft className="size-5" />
          </Button>
        </div>
      ) : null}
      {children}
    </div>
  );
}

/**
 * Le moment « rangé » (KTD4) : une TRANSITION, pas une destination — 🌿
 * respire un instant, puis l'effet ramène à l'étagère où le plateau est
 * visiblement rangé. Aucun bouton : rien ne presse.
 */
function RangeMoment() {
  const m = useMessages();
  return (
    <FadeIn>
      <div className="flex flex-1 flex-col items-center justify-center gap-10 text-center">
        <p aria-hidden="true" className="text-6xl">
          🌿
        </p>
        <p className="text-2xl text-muted-foreground">{m.sudoku.rangeMoment}</p>
      </div>
    </FadeIn>
  );
}

/**
 * Apparition en fondu d'ensemble — dégrade en apparition instantanée sous
 * prefers-reduced-motion (jamais un écran resté invisible).
 */
function FadeIn({ children }: { children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    setVisible(true);
  }, []);
  return (
    <div
      className={cn(
        "flex w-full flex-1 flex-col transition-opacity duration-300 motion-reduce:transition-none",
        visible ? "opacity-100" : "opacity-0 motion-reduce:opacity-100"
      )}
    >
      {children}
    </div>
  );
}
