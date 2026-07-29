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
import { ColumnGrid } from "~/components/calcul/column-grid";
import {
  DIGIT_TILE_CLASSES,
  SoftNumpad,
} from "~/components/calcul/soft-numpad";
import { type TrayInfo, TrayShelf } from "~/components/calcul/tray-shelf";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/cn";
import { useLocale, useMessages } from "~/lib/i18n";
import {
  advanceSerie,
  browserSerieStorage,
  type CellRef,
  clearSerie,
  enonceFor,
  type FamilySettings,
  finishCurrent,
  isCellRef,
  isSerieFinished,
  layoutOperation,
  loadSession,
  type Operation,
  pencilAdvance,
  resolvePalierForFamille,
  type SerieStateLike,
  safeGenerateSerie,
  saveSerie,
  shelfTrays,
  takeTray,
  writeCell,
} from "~/lib/operations";
import { listDoudousFn } from "~/server/doudous-functions";
import { listHeroesFn } from "~/server/heroes-functions";
import { getMathSettingsFn } from "~/server/math-functions";

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

export const Route = createFileRoute("/_bureau/calcul/")({
  component: CalculWorkshopPage,
  // Network resilience (eng-review 2A): a DB outage or hang NEVER blocks the
  // child — the loader swallows failures AND bounds waits with a short
  // timeout; the component falls back to the palier cached on this device.
  // The generator and grids are 100% local.
  loader: async () => {
    const [settings, heroes, doudous] = await Promise.all([
      withTimeout(getMathSettingsFn(), null),
      withTimeout(listHeroesFn(), []),
      withTimeout(listDoudousFn(), []),
    ]);
    return {
      doudouName: doudous[0]?.label ?? null,
      heroName: heroes[0]?.label ?? null,
      settings,
    };
  },
});

// Toute la vie de la série hors rendu (clés localStorage, pont legacy, purge
// authoritative, reprise/empreinte, gestes d'écriture) vit dans le module pur
// serie-session (golden-testé) ; la route ne fait que le rendu et le dnd.
// L'adaptateur ne touche window qu'à l'appel — sûr au niveau module.
const storage = browserSerieStorage();

// Durée du moment « rangé » (D-2A) : 🌿 respire, puis fondu vers l'étagère —
// appariée au fondu de 300 ms de FadeIn, jamais un écran-destination.
const TIDIED_MOMENT_MS = 1600;

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
 * Les trois temps de l'atelier : l'étagère (le choix), la série (le travail),
 * le moment « rangé » (la transition de fin, D-2A — jamais une destination).
 * Phase en état local, pas de route : le back matériel sort de l'atelier
 * (écart assumé D-8B), la flèche in-app fait le trajet fin.
 */
type Phase =
  | { kind: "shelf" }
  | { kind: "serie"; famille: Operation }
  | { kind: "tidied"; famille: Operation };

/**
 * L'atelier des opérations posées — "la série qui se range" (eng-review T4-A).
 *
 * One opening = one short series of operations (parent-set size). The last
 * one finished, the workshop tidies itself: the page breathes, nothing new
 * arrives on its own. Reopening a series is a deliberate child gesture.
 *
 * V1 is the "écriture libre" mode (T3-C): the child writes freely like on
 * paper — nothing is judged while writing; at the end the solved operation
 * appears alongside for the child to compare. The stamp-game manipulation
 * (tranche 5) arrives after the school confirms the material.
 */
function CalculWorkshopPage() {
  const locale = useLocale();
  const m = useMessages();
  const { settings: dbSettings, heroName, doudouName } = Route.useLoaderData();
  const [settings, setSettings] = useState<FamilySettings | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "shelf" });
  const [serie, setSerie] = useState<SerieStateLike | null>(null);
  const [selected, setSelected] = useState<CellRef | null>(null);
  // Digit currently being dragged from the numpad (drives the DragOverlay).
  const [dragDigit, setDragDigit] = useState<string | null>(null);
  // On touch, implicit pointer capture retargets the post-drag click onto the
  // numpad key — this one-shot flag swallows that ghost click so a drag never
  // ALSO writes into the selected cell. Consumed by the first suppressed
  // click; the fallback timer covers pointers that never emit one (a mouse
  // released away from the key).
  const dragJustEndedRef = useRef(false);
  // The operation index a drag started on: a drop landing after the tray
  // advanced (multi-touch) must never ink the NEXT operation's grid.
  const dragOpIndexRef = useRef<number | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, POINTER_ACTIVATION));

  // Ouverture de session (loadSession, module pur golden-testé) : pont de
  // clé legacy (une seule fois), réglages DB → cache appareil → défauts,
  // normalisés quelle que soit la source, cache + purge des clés orphelines
  // SEULEMENT sur réglages authoritatifs (D-3A/F9, red-team RT1).
  useEffect(() => {
    setSettings(loadSession(storage, dbSettings));
  }, [dbSettings]);

  // Persistance : chaque frappe est sauvegardée sous la clé de SA famille —
  // reposer le plateau ou fermer l'onglet ne perd jamais rien.
  useEffect(() => {
    if (serie) {
      saveSerie(storage, serie);
    }
  }, [serie]);

  // Fin de série (D-2A) : le moment « rangé » est une TRANSITION vers
  // l'étagère (où le plateau est visiblement rangé), pas une destination.
  // Une série VIDE (palier cassé, cas théorique) compte comme finie — même
  // chemin calme, jamais un écran bloqué.
  const finished =
    phase.kind === "serie" && serie !== null && isSerieFinished(serie);
  useEffect(() => {
    if (finished && serie) {
      setPhase({ famille: serie.famille, kind: "tidied" });
    }
  }, [finished, serie]);
  useEffect(() => {
    if (phase.kind !== "tidied") {
      return;
    }
    const timer = setTimeout(() => {
      clearSerie(storage, phase.famille);
      setSerie(null);
      setPhase({ kind: "shelf" });
    }, TIDIED_MOMENT_MS);
    return () => clearTimeout(timer);
  }, [phase]);

  const palier = serie
    ? resolvePalierForFamille(serie.famille, serie.palierId)
    : resolvePalierForFamille("addition", null);
  // Deps = the values that drive generation only (seed/size/palier) — the
  // serie OBJECT changes identity on every digit tap and must not retrigger
  // the rejection sampling.
  const serieSeed = serie?.seed;
  const serieSize = serie?.serieSize;
  const operations = useMemo(
    () =>
      serieSeed !== undefined && serieSize !== undefined
        ? safeGenerateSerie(palier, serieSeed, serieSize)
        : [],
    [serieSeed, serieSize, palier]
  );

  // L'état « sorti » des plateaux : lecture localStorage + vérification
  // d'empreinte (régénération seedée) bornées à UNE entrée d'étagère — memo
  // sur (settings, phase), jamais à chaque rendu (D-3A/F5 ; la purge d'une
  // clé non reprenable y vit aussi, idempotente).
  const trays = useMemo<TrayInfo[]>(
    () =>
      settings && phase.kind === "shelf" ? shelfTrays(storage, settings) : [],
    [settings, phase]
  );

  /** Prendre un plateau (takeTray, module pur) : reprise exacte si la série
      est reprenable, sinon série fraîche au palier parental de CETTE famille. */
  function prendrePlateau(op: Operation) {
    if (!settings) {
      return;
    }
    setSelected(null);
    setSerie(takeTray(storage, settings, op));
    setPhase({ famille: op, kind: "serie" });
  }

  /** « Reposer le plateau » (T2/D-4A) : retour à l'étagère, sans perte —
      la série est sauvegardée à chaque frappe. */
  function reposerPlateau() {
    setSelected(null);
    setSerie(null);
    setPhase({ kind: "shelf" });
  }

  if (!settings) {
    // First client render (hydration-safe): the calm background, nothing else.
    // L'étagère n'apparaît qu'une fois settings + localStorage résolus côté
    // client, en fondu d'ensemble — jamais de plateau qui saute (D-3A/F6).
    return <div className="min-h-[80vh]" />;
  }

  if (phase.kind === "shelf") {
    return (
      <WorkshopShell>
        <FadeIn>
          <TrayShelf
            doudouName={doudouName}
            heroName={heroName}
            onTake={prendrePlateau}
            trays={trays}
          />
        </FadeIn>
      </WorkshopShell>
    );
  }

  // Le moment « rangé », partagé par les trois chemins qui y mènent (phase
  // tidied, série absente, série finie/vide en attente de l'effet).
  const tidiedScreen = (
    <WorkshopShell>
      <TidiedMoment />
    </WorkshopShell>
  );

  if (phase.kind === "tidied" || !serie) {
    return tidiedScreen;
  }

  const operation = finished ? null : operations[serie.index];
  const layout = operation ? layoutOperation(operation) : null;
  const current = finished ? null : serie.perOp[serie.index];

  function setCell(cell: CellRef, value: string | null) {
    // Everything derives from prev INSIDE the updater (never the render-time
    // closure); writeCell (module pur) is bounds/done-guarded: a late drop or
    // a second write in the same event can never clobber state or ink a
    // frozen answer.
    setSerie((prev) => (prev ? writeCell(prev, cell, value) : prev));
  }

  function writeDigit(digit: string) {
    if (dragJustEndedRef.current) {
      // The ghost click after a drag — swallow it and re-arm for real taps.
      dragJustEndedRef.current = false;
      return;
    }
    if (!selected) {
      return;
    }
    setCell(selected, digit);
    setSelected(pencilAdvance(selected));
  }

  function endDrag() {
    setDragDigit(null);
    dragOpIndexRef.current = null;
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
    dragOpIndexRef.current = serie?.index ?? null;
    // Single-pencil metaphor: the lifted tile IS the pencil now — the old
    // selection halo goes out so only the hovered cell glows during the drag.
    setSelected(null);
  }

  function handleDragEnd(event: DragEndEvent) {
    const dragOpIndex = dragOpIndexRef.current;
    endDrag();
    const digit = event.active.data.current?.digit;
    const cell = event.over?.data.current?.cell;
    if (typeof digit !== "string" || !isCellRef(cell)) {
      return;
    }
    // A drop only counts on the operation it started on, and only while that
    // operation is still being written — a drag surviving a "J'ai fini" or a
    // tray change (second finger) lands as a calm no-op.
    if (dragOpIndex === null || dragOpIndex !== serie?.index) {
      return;
    }
    if (!current || current.done) {
      return;
    }
    setCell(cell, digit);
    // Same pencil flow as a tap: the dropped cell becomes "where the pencil
    // is", stepping leftwards on the result line.
    setSelected(pencilAdvance(cell));
  }

  function erase() {
    if (!selected) {
      return;
    }
    setCell(selected, null);
  }

  function nextTray() {
    setSelected(null);
    setSerie((prev) => (prev ? advanceSerie(prev) : prev));
  }

  if (finished || !(operation && layout && current)) {
    // Fin de série (ou série vide sur palier cassé — dégradation calme) :
    // le moment « rangé », puis l'effet ci-dessus ramène à l'étagère.
    return tidiedScreen;
  }

  return (
    <WorkshopShell onReposer={reposerPlateau}>
      {/* No tray/progress row (review decision 3B): the series is bounded but
          never counted in front of the child — the end simply arrives, like
          the end of a story. */}
      <DndContext
        collisionDetection={forgivingCollision}
        onDragCancel={endDrag}
        onDragEnd={handleDragEnd}
        onDragStart={handleDragStart}
        sensors={sensors}
      >
        {heroName ? (
          <p className="max-w-md text-center text-muted-foreground text-xl leading-relaxed">
            {enonceFor(
              operation,
              {
                doudou: doudouName ?? undefined,
                hero: heroName,
              },
              locale
            )}
          </p>
        ) : null}

        <div className="flex flex-wrap items-start justify-center gap-6">
          <ColumnGrid
            entries={current.entries}
            layout={layout}
            onSelect={setSelected}
            selected={selected}
            variant="libre"
          />
          {current.done ? (
            <ColumnGrid layout={layout} variant="solution" />
          ) : null}
        </div>

        {current.done ? (
          <Button
            className="gap-2 text-muted-foreground text-xl"
            onClick={nextTray}
            variant="ghost"
          >
            {serie.index + 1 < serie.serieSize
              ? m.calcul.plateauSuivant
              : m.calcul.rangerAtelier}
          </Button>
        ) : (
          <>
            <SoftNumpad onDigit={writeDigit} onErase={erase} />
            <Button
              className="gap-2 text-muted-foreground text-xl"
              disabled={current.entries.result.every((d) => d === null)}
              onClick={() => {
                setSerie((prev) => (prev ? finishCurrent(prev) : prev));
                setSelected(null);
              }}
              variant="ghost"
            >
              {m.calcul.jaiFiniJeCompare}
            </Button>
          </>
        )}
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
 * Common frame — la flèche n'existe qu'en série (« Reposer le plateau »,
 * T2/D-4A révisé UX 2026-07-23) : sur l'étagère (et le moment « rangé »),
 * la croix de la fenêtre fait déjà le retour à l'accueil — une flèche en
 * doublon brouillait le geste. Zone tactile ≥44px.
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
            aria-label={m.calcul.ariaReposerPlateau}
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
 * Le moment « rangé » (T4-A, révisé D-2A) : une TRANSITION, pas une
 * destination — 🌿 respire un instant, puis l'effet ramène à l'étagère où le
 * plateau est visiblement rangé. Aucun bouton : rien ne presse, rien ne
 * court-circuite le geste de choix.
 */
function TidiedMoment() {
  const m = useMessages();
  return (
    <FadeIn>
      <div className="flex flex-1 flex-col items-center justify-center gap-10 text-center">
        <p aria-hidden="true" className="text-6xl">
          🌿
        </p>
        <p className="text-2xl text-muted-foreground">
          {m.calcul.atelierRange}
        </p>
      </div>
    </FadeIn>
  );
}

/**
 * Apparition en fondu d'ensemble (D-3A/F6) — dégrade en apparition
 * instantanée sous prefers-reduced-motion (jamais un écran resté invisible).
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
