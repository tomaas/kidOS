/**
 * La fenêtre du bureau — le CADRE, pas le contenu (prémisse 6).
 *
 * Une vraie grammaire de fenêtre à taille d'enfant : barre de titre (seule
 * zone de drag), grande croix douce ≥ 48 px toujours visible (jamais rouge —
 * la croix a la sémantique de navigation EXISTANTE : un Link vers `/`), ni
 * resize, ni minimize, ni maximize, ni z-order — une seule fenêtre à la fois.
 *
 * Géométrie (eng-review D23-A) : ~85 % du viewport — à ~92 % la course de
 * drag n'était que quelques dizaines de pixels, un « déplacer la fenêtre »
 * symbolique mé-enseigne. À chaque ouverture la fenêtre repart CENTRÉE
 * (ceo-review D9-A) : le matériel revient toujours à sa place — aucune
 * position persistée, la récupération d'une fenêtre « perdue » est la
 * réouverture. Le centrage par défaut est 100 % CSS (inset 7.5vw/7.5vh) :
 * aucune lecture de `window` pendant le rendu, SSR-safe (contrat D17-A).
 *
 * La position committée n'est JAMAIS un transform CSS (eng-review D24-A) :
 * transform pendant le drag seulement, commit en `left/top` — un transform
 * persistant ferait du cadre le containing block des descendants
 * `position: fixed`, et le DragOverlay du pavé de /calcul rendrait décalé
 * d'exactement la translation de la fenêtre. Même raison : pas de
 * `will-change`/`filter` sur le cadre.
 *
 * Sous le point de rupture lg, la fenêtre rend PLEIN ÉCRAN sans drag, croix
 * conservée (ceo-review D14-A) : les mini-apps ne sont jamais comprimées, la
 * grammaire OS s'efface quand la place manque.
 *
 * Les capteurs du DndContext sont activés par la SEULE zone de titre (T5) :
 * il ne peut jamais interférer avec le DndContext du pavé de /calcul qui vit
 * à l'intérieur. À l'impression, le positionnement est neutralisé
 * (`.bureau-fenetre` dans globals.css) : le contenu s'imprime comme avant.
 */

import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  useDraggable,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { Link } from "@tanstack/react-router";
import { X } from "lucide-react";
import {
  type ReactNode,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Button } from "~/components/ui/button";
import {
  clampFenetrePosition,
  type Position,
  reclampCommitted,
  type Taille,
} from "~/lib/bureau/clamp";
import { cn } from "~/lib/cn";
import { useMessages } from "~/lib/i18n";

/** Hauteur de la barre de titre — appariée à la classe h-14 (56px) du cadre. */
export const FENETRE_TITLE_BAR_HEIGHT = 56;

// 4px of travel before a drag starts: a plain click on the title bar stays a
// click. Hoisted for a stable useSensor options identity (same idiom as
// /calcul's numpad sensor).
const POINTER_ACTIVATION = { activationConstraint: { distance: 4 } };

/** Le drag n'existe qu'au-dessus du breakpoint lg (D14-A). */
const DESKTOP_QUERY = "(min-width: 1024px)";

/** Le viewport au moment du commit — lu au même instant que le rect. */
function viewportActuel(): Taille {
  return { height: window.innerHeight, width: window.innerWidth };
}

function subscribeDesktop(onChange: () => void) {
  const media = window.matchMedia(DESKTOP_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function useEstDesktop(): boolean {
  return useSyncExternalStore(
    subscribeDesktop,
    () => window.matchMedia(DESKTOP_QUERY).matches,
    // SSR: pas de lecture de window pendant le rendu (D17-A) — le faux
    // n'active aucun style inline, la géométrie du premier paint est en CSS.
    () => false
  );
}

export interface FenetreProps {
  children: ReactNode;
  /** Le pictogramme de l'icône du bureau, repris dans la barre de titre. */
  icone: ReactNode;
  /** Le titre de la fenêtre = le libellé de l'icône (« Histoires »…). */
  titre: string;
}

export function Fenetre({ children, icone, titre }: FenetreProps) {
  const estDesktop = useEstDesktop();
  // null = centrée par le CSS (l'état de CHAQUE ouverture) ; un point après
  // le premier drag, committé en left/top.
  const [position, setPosition] = useState<Position | null>(null);
  const cadreRef = useRef<HTMLDivElement | null>(null);
  const origineDragRef = useRef<Position | null>(null);
  const sensors = useSensors(useSensor(PointerSensor, POINTER_ACTIVATION));

  // L'invariant « barre entièrement visible » tient aussi au REDIMENSIONNEMENT
  // du viewport (D11-A) : le même modifier pur re-borne la position committée.
  const aUnePosition = position !== null;
  useEffect(() => {
    if (!(aUnePosition && estDesktop)) {
      return;
    }
    function reclamp() {
      if (origineDragRef.current) {
        // Drag en vol : re-positionner sous le transform ferait sursauter la
        // fenêtre — dragEnd re-borne de toute façon.
        return;
      }
      const rect = cadreRef.current?.getBoundingClientRect();
      if (!rect) {
        return;
      }
      // null-passthrough + no-op même référence : dans le helper pur —
      // pas de re-rendu à chaque event resize loin des bords.
      setPosition((prev) =>
        reclampCommitted(prev, rect, viewportActuel(), FENETRE_TITLE_BAR_HEIGHT)
      );
    }
    // Re-borne aussi à l'ATTACHE : le viewport a pu changer pendant
    // l'interlude <lg (rotation, restore) où l'écouteur était détaché.
    reclamp();
    window.addEventListener("resize", reclamp);
    return () => window.removeEventListener("resize", reclamp);
  }, [aUnePosition, estDesktop]);

  function handleDragStart() {
    // Au départ du drag le transform est nul (jamais persisté) : le rect EST
    // la position réelle, qu'elle vienne du CSS centré ou d'un left/top.
    const rect = cadreRef.current?.getBoundingClientRect();
    origineDragRef.current = rect ? { x: rect.left, y: rect.top } : null;
  }

  function handleDragEnd(event: DragEndEvent) {
    const origine = origineDragRef.current;
    origineDragRef.current = null;
    const rect = cadreRef.current?.getBoundingClientRect();
    if (!(origine && rect)) {
      return;
    }
    setPosition(
      clampFenetrePosition(
        { x: origine.x + event.delta.x, y: origine.y + event.delta.y },
        rect,
        viewportActuel(),
        FENETRE_TITLE_BAR_HEIGHT
      )
    );
  }

  function handleDragCancel() {
    // dnd-kit ANNULE (jamais dragEnd) sur resize, Escape, pointercancel et
    // changement d'onglet : sans ce nettoyage, le garde « drag en vol » de
    // reclamp resterait armé pour toujours et l'invariant D23-A mourrait en
    // silence (relevé par les 3 passes adversariales, cross-model).
    origineDragRef.current = null;
    // Le resize qui vient d'annuler le drag doit re-borner tout de suite —
    // l'écouteur a vu le garde encore armé.
    const rect = cadreRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }
    setPosition((prev) =>
      reclampCommitted(prev, rect, viewportActuel(), FENETRE_TITLE_BAR_HEIGHT)
    );
  }

  return (
    <>
      {/* Le bureau respire derrière la fenêtre — même lavis que l'accueil. */}
      <div aria-hidden="true" className="bureau-fond no-print fixed inset-0" />
      {/* id STABLE obligatoire : ce DndContext rend au SSR (contrat D17-A) et
          l'id auto-généré de dnd-kit (compteur de module) diverge entre le
          serveur et le client → mismatch d'hydratation sur aria-describedby. */}
      <DndContext
        id="bureau-fenetre-dnd"
        onDragCancel={handleDragCancel}
        onDragEnd={handleDragEnd}
        onDragStart={handleDragStart}
        sensors={sensors}
      >
        <CadreFenetre
          cadreRef={cadreRef}
          dragActif={estDesktop}
          icone={icone}
          position={estDesktop ? position : null}
          titre={titre}
        >
          {children}
        </CadreFenetre>
      </DndContext>
    </>
  );
}

function CadreFenetre({
  cadreRef,
  children,
  dragActif,
  icone,
  position,
  titre,
}: {
  cadreRef: React.RefObject<HTMLDivElement | null>;
  children: ReactNode;
  dragActif: boolean;
  icone: ReactNode;
  position: Position | null;
  titre: string;
}) {
  const m = useMessages();
  // `attributes` de useDraggable est volontairement NON étalé sur la zone de
  // drag : il injecte role="button" + tabIndex=0 — un contrôle tabbable
  // invisible qui ne fait rien au clavier (le clavier est hors périmètre,
  // D24-A ; pas de KeyboardSensor). Les listeners pointeur suffisent.
  const { listeners, setNodeRef, transform } = useDraggable({
    disabled: !dragActif,
    id: "bureau-fenetre",
  });

  return (
    <div
      className={cn(
        // <lg : plein écran, la grammaire OS s'efface (D14-A). ≥lg : ~85 % du
        // viewport, centrage par défaut 100 % CSS — SSR-safe, et chaque
        // ouverture repart centrée (D9-A).
        "bureau-fenetre fixed inset-0 z-10 flex flex-col overflow-hidden bg-background",
        "lg:inset-auto lg:top-[7.5vh] lg:left-[7.5vw] lg:h-[85vh] lg:w-[85vw]",
        "lg:rounded-2xl lg:border lg:border-border lg:shadow-2xl"
      )}
      ref={cadreRef}
      style={{
        // Commit en left/top, jamais de transform persistant (D24-A). Le
        // transform n'existe que PENDANT le drag.
        ...(position ? { left: position.x, top: position.y } : {}),
        ...(transform
          ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
          : {}),
      }}
    >
      {/* Barre de titre à la grammaire des vrais OS : pictogramme à gauche,
          titre CENTRÉ sur toute la largeur de la barre, contrôle de fenêtre
          rond à droite (ocre doux, jamais rouge). La zone de drag couvre
          toute la barre SAUF la croix (posée au-dessus, z-10) : un doigt qui
          glisse sur la croix ne déplace rien. */}
      <div className="no-print relative flex h-14 shrink-0 items-center border-border border-b bg-card pr-2">
        <div
          className={cn(
            "absolute inset-0 flex touch-none select-none items-center pl-5",
            dragActif && "cursor-grab active:cursor-grabbing"
          )}
          ref={setNodeRef}
          {...listeners}
        >
          <span aria-hidden="true" className="text-muted-foreground">
            {icone}
          </span>
        </div>
        <span className="pointer-events-none absolute inset-x-16 truncate text-center font-semibold text-muted-foreground text-xl">
          {titre}
        </span>
        <Button
          aria-label={m.bureau.fermerFenetre}
          className="relative z-10 ml-auto size-12 shrink-0 rounded-full bg-primary/10 text-primary hover:bg-primary/20"
          nativeButton={false}
          render={<Link aria-label={m.bureau.fermerFenetre} to="/" />}
          variant="ghost"
        >
          <X className="size-6" />
        </Button>
      </div>
      <div className="bureau-fenetre-contenu min-h-0 flex-1 overflow-y-auto">
        {/* Le conteneur que __root offrait avant le plein-bleed : les
            mini-apps gardent leur largeur et leurs marges d'origine. */}
        <div className="mx-auto w-full max-w-5xl px-6 py-10">{children}</div>
      </div>
    </div>
  );
}
