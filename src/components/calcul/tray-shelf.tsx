/**
 * L'étagère de plateaux — le geste de choix de la mini-app calcul.
 *
 * Composant PRÉSENTATIONNEL (les données viennent de la route) :
 * un plateau par famille ACTIVÉE (une famille non activée n'existe pas à
 * l'écran — prémisse 3, jamais de plateau grisé ni de cadenas), dans l'ordre
 * canonique FAMILLES. Chaque plateau montre sa scène (objets dominants →
 * signe en médaillon → phrase en sous-titre), SANS nombres, à compte gelé.
 * D-1A révisé (UX 2026-07-23) : la scène n'est plus figée à vie — chaque
 * famille a un petit jeu de variantes (scène + phrase appariées) et la
 * variante tourne PAR JOUR (varianteDuJour, pure et golden-testée) :
 * l'étagère est préparée pendant la nuit, jamais sous les yeux de l'enfant,
 * et la constance reste entière DANS la journée — à config d'entités
 * constante (une DB injoignable à l'ouverture replie doudouName sur null,
 * ce qui peut replier la variante doudou sur la boîte : dégradation calme
 * assumée, jamais une erreur). L'aria-label du plateau ne
 * change jamais À LANGUE CONSTANTE (« Prendre le plateau des additions » /
 * « Take the addition tray ») — l'identité au lecteur d'écran est stable
 * même quand la scène varie ; seule la bascule de langue par le parent le
 * re-libelle. Le plateau « sorti »
 * (série en cours) est décalé de 18px avec une ombre douce, RIEN d'autre
 * (même taille, même luminosité — au-delà ce serait une suggestion, D-3
 * bornée).
 *
 * Écran ⇄ classe : la règle « le plateau ne se nomme pas » est VISUELLE ;
 * pour un lecteur d'écran chaque plateau est un bouton qui se nomme
 * (« Prendre le plateau des additions — série en cours »), scène en
 * aria-hidden (D-7A/F15).
 *
 * Responsive (D-7A/F14) : les plateaux se compriment (clamp) et ne passent
 * JAMAIS à la ligne — une seule rangée, comme une étagère ; sous ~480px
 * l'étagère s'empile verticalement. Les 18px du décalage « sorti » sont
 * réservés dans la hauteur. (La planche dessinée a été retirée — UX
 * 2026-07-23 : elle se lisait comme un séparateur superflu, pas comme une
 * étagère.)
 */

import { useState } from "react";
import { palette } from "~/config/style";
import { cn } from "~/lib/cn";
import { formatMessage, type Locale, useLocale, useMessages } from "~/lib/i18n";
import { type Operation, varianteDuJour } from "~/lib/operations";

export interface TrayInfo {
  op: Operation;
  /** Série en cours reprenable (prédicat complet, jamais « la clé existe »). */
  sorti: boolean;
}

// Le décalage « sorti » : ces DEUX classes portent le même 18px — le plateau
// descend d'autant que la rangée réserve, la hauteur de l'étagère ne saute
// jamais selon l'état. (Littéraux Tailwind obligatoires : le scanner JIT ne
// voit pas une interpolation — modifier les deux ensemble.)
const SORTI_SHIFT_CLASS = "translate-y-[18px]";
const SORTI_RESERVE_CLASS = "pb-[18px]";

const SIGNES: Record<Operation, string> = {
  addition: "+",
  multiplication: "×",
  soustraction: "−",
};

/**
 * Les variantes de plateau — scène et phrase APPARIÉES (jamais une phrase
 * « pommes » sur une scène de marrons), sans nombres (D-3A/F8). La variante
 * qui met en scène le doudou n'est proposée que s'il existe (needsDoudou) —
 * le repli « boîte » couvre la famille sans doudou.
 *
 * BILINGUE : chaque variante porte SES deux phrases (une par locale) — un
 * seul pool par famille, donc les comptes sont identiques par construction
 * et varianteDuJour tire la MÊME variante dans les deux langues (la scène ne
 * change pas quand le parent bascule la langue).
 */
interface VariantePlateau {
  needsDoudou?: true;
  phrase: Record<Locale, (hero: string, doudou: string | null) => string>;
  Scene: () => React.ReactNode;
}

function varianteDuPlateau(
  op: Operation,
  jourKey: string,
  hasDoudou: boolean
): VariantePlateau {
  // INVARIANT d'édition : chaque famille garde AU MOINS une variante sans
  // needsDoudou. Le repli ?? borde quand même un pool filtré vide (une
  // future édition de VARIANTES ne peut jamais faire crasher l'étagère).
  const pool = VARIANTES[op].filter((v) => !v.needsDoudou || hasDoudou);
  return pool[varianteDuJour(op, jourKey, pool.length)] ?? VARIANTES[op][0];
}

/** Clé de jour LOCALE (l'étagère change à minuit chez la famille, pas UTC). */
function jourKeyLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

/* --------------------------- Scènes SVG maison --------------------------- */
/* Dessinées dans la palette de l'app (D-5A : pas d'OpenMoji — formes douces,
   traits encre, aucun contour noir), comptes d'objets GELÉS (D-1A/F19) par
   scène : 4 marrons, 4 feuilles, 4 fleurs, 1 doudou, 1 boîte, 2 paniers,
   2 bols, 2 sacs. */

function MarronsScene() {
  // 4 marrons — compte gelé.
  const marron = (cx: number, cy: number, r: number) => (
    <g key={`${cx}-${cy}`}>
      <circle cx={cx} cy={cy} fill={palette.primary} r={r} />
      <circle
        cx={cx}
        cy={cy}
        fill="none"
        opacity={0.45}
        r={r}
        stroke={palette.ink}
        strokeWidth={1.5}
      />
      <path
        d={`M ${cx - r * 0.5} ${cy - r * 0.55} Q ${cx} ${cy - r * 1.1} ${cx + r * 0.5} ${cy - r * 0.55}`}
        fill={palette.background}
        opacity={0.8}
      />
    </g>
  );
  return (
    <svg
      aria-hidden="true"
      className="h-16 w-full"
      role="presentation"
      viewBox="0 0 120 64"
    >
      {marron(28, 42, 13)}
      {marron(58, 34, 15)}
      {marron(88, 44, 12)}
      {marron(60, 52, 10)}
    </svg>
  );
}

function DoudouScene() {
  // 1 doudou — compte gelé.
  return (
    <svg
      aria-hidden="true"
      className="h-16 w-full"
      role="presentation"
      viewBox="0 0 120 64"
    >
      <g opacity={0.9}>
        {/* oreilles */}
        <circle cx={46} cy={18} fill={palette.primary} r={7} />
        <circle cx={74} cy={18} fill={palette.primary} r={7} />
        {/* tête */}
        <circle cx={60} cy={28} fill={palette.primary} r={14} />
        <circle cx={55} cy={26} fill={palette.ink} opacity={0.6} r={1.6} />
        <circle cx={65} cy={26} fill={palette.ink} opacity={0.6} r={1.6} />
        <path
          d="M 56 33 Q 60 36 64 33"
          fill="none"
          opacity={0.6}
          stroke={palette.ink}
          strokeLinecap="round"
          strokeWidth={1.5}
        />
        {/* corps */}
        <ellipse cx={60} cy={50} fill={palette.primary} rx={16} ry={12} />
        <ellipse
          cx={60}
          cy={52}
          fill={palette.background}
          opacity={0.7}
          rx={8}
          ry={6}
        />
      </g>
    </svg>
  );
}

function PaniersScene() {
  // 2 paniers — compte gelé.
  const panier = (cx: number) => (
    <g key={cx}>
      <path
        d={`M ${cx - 18} 34 L ${cx + 18} 34 L ${cx + 13} 52 Q ${cx} 56 ${cx - 13} 52 Z`}
        fill={palette.accent}
      />
      <path
        d={`M ${cx - 18} 34 L ${cx + 18} 34 L ${cx + 13} 52 Q ${cx} 56 ${cx - 13} 52 Z`}
        fill="none"
        opacity={0.5}
        stroke={palette.ink}
        strokeWidth={1.5}
      />
      <path
        d={`M ${cx - 10} 34 Q ${cx} 20 ${cx + 10} 34`}
        fill="none"
        opacity={0.6}
        stroke={palette.ink}
        strokeWidth={2}
      />
    </g>
  );
  return (
    <svg
      aria-hidden="true"
      className="h-16 w-full"
      role="presentation"
      viewBox="0 0 120 64"
    >
      {panier(38)}
      {panier(82)}
    </svg>
  );
}

function FeuillesScene() {
  // 4 feuilles — compte gelé.
  const feuille = (cx: number, cy: number, rot: number) => (
    <g key={`${cx}-${cy}`} transform={`rotate(${rot} ${cx} ${cy})`}>
      <ellipse cx={cx} cy={cy} fill={palette.accent} rx={11} ry={5.5} />
      <ellipse
        cx={cx}
        cy={cy}
        fill="none"
        opacity={0.45}
        rx={11}
        ry={5.5}
        stroke={palette.ink}
        strokeWidth={1.5}
      />
      <path
        d={`M ${cx - 8} ${cy} L ${cx + 8} ${cy}`}
        fill="none"
        opacity={0.5}
        stroke={palette.ink}
        strokeWidth={1.2}
      />
    </g>
  );
  return (
    <svg
      aria-hidden="true"
      className="h-16 w-full"
      role="presentation"
      viewBox="0 0 120 64"
    >
      {feuille(30, 40, -20)}
      {feuille(58, 32, 12)}
      {feuille(86, 42, -8)}
      {feuille(60, 52, 28)}
    </svg>
  );
}

function FleursScene() {
  // 4 fleurs — compte gelé. Pétales posés par angle (clé = degré, stable).
  const fleur = (cx: number, cy: number, r: number) => (
    <g key={`${cx}-${cy}`}>
      {[270, 342, 54, 126, 198].map((deg) => {
        const angle = (deg * Math.PI) / 180;
        return (
          <circle
            cx={cx + Math.cos(angle) * r}
            cy={cy + Math.sin(angle) * r}
            fill={palette.primary}
            key={deg}
            opacity={0.9}
            r={r * 0.62}
          />
        );
      })}
      <circle cx={cx} cy={cy} fill={palette.accent} r={r * 0.55} />
      <circle
        cx={cx}
        cy={cy}
        fill="none"
        opacity={0.45}
        r={r * 0.55}
        stroke={palette.ink}
        strokeWidth={1.5}
      />
    </g>
  );
  return (
    <svg
      aria-hidden="true"
      className="h-16 w-full"
      role="presentation"
      viewBox="0 0 120 64"
    >
      {fleur(30, 40, 8)}
      {fleur(58, 31, 9)}
      {fleur(86, 42, 8)}
      {fleur(60, 52, 6.5)}
    </svg>
  );
}

function BoiteScene() {
  // 1 boîte — compte gelé.
  return (
    <svg
      aria-hidden="true"
      className="h-16 w-full"
      role="presentation"
      viewBox="0 0 120 64"
    >
      <g>
        {/* couvercle entrouvert */}
        <g transform="rotate(-6 60 24)">
          <rect
            fill={palette.primary}
            height={8}
            rx={3}
            width={52}
            x={34}
            y={20}
          />
          <rect
            fill="none"
            height={8}
            opacity={0.45}
            rx={3}
            stroke={palette.ink}
            strokeWidth={1.5}
            width={52}
            x={34}
            y={20}
          />
        </g>
        {/* corps */}
        <rect
          fill={palette.primary}
          height={24}
          rx={4}
          width={44}
          x={38}
          y={31}
        />
        <rect
          fill="none"
          height={24}
          opacity={0.45}
          rx={4}
          stroke={palette.ink}
          strokeWidth={1.5}
          width={44}
          x={38}
          y={31}
        />
        <rect
          fill={palette.background}
          height={5}
          opacity={0.6}
          rx={2.5}
          width={28}
          x={46}
          y={36}
        />
      </g>
    </svg>
  );
}

function BolsScene() {
  // 2 bols — compte gelé. Gabarit rehaussé (bord à y=30) pour un poids
  // visuel comparable aux paniers/sacs voisins sur la même étagère.
  const bol = (cx: number) => {
    const coupe = `M ${cx - 18} 30 Q ${cx} 58 ${cx + 18} 30 Z`;
    return (
      <g key={cx}>
        <path d={coupe} fill={palette.primary} />
        <path
          d={coupe}
          fill="none"
          opacity={0.5}
          stroke={palette.ink}
          strokeWidth={1.5}
        />
        <ellipse
          cx={cx}
          cy={30}
          fill={palette.background}
          opacity={0.85}
          rx={18}
          ry={4.5}
        />
        <ellipse
          cx={cx}
          cy={30}
          fill="none"
          opacity={0.5}
          rx={18}
          ry={4.5}
          stroke={palette.ink}
          strokeWidth={1.5}
        />
      </g>
    );
  };
  return (
    <svg
      aria-hidden="true"
      className="h-16 w-full"
      role="presentation"
      viewBox="0 0 120 64"
    >
      {bol(38)}
      {bol(82)}
    </svg>
  );
}

function SacsScene() {
  // 2 sacs — compte gelé.
  const sac = (cx: number) => {
    const toile = `M ${cx - 12} 30 Q ${cx - 17} 52 ${cx - 9} 55 L ${cx + 9} 55 Q ${cx + 17} 52 ${cx + 12} 30 Q ${cx} 25 ${cx - 12} 30 Z`;
    return (
      <g key={cx}>
        <path d={toile} fill={palette.accent} />
        <path
          d={toile}
          fill="none"
          opacity={0.5}
          stroke={palette.ink}
          strokeWidth={1.5}
        />
        <path
          d={`M ${cx - 12} 30 Q ${cx} 35 ${cx + 12} 30`}
          fill="none"
          opacity={0.5}
          stroke={palette.ink}
          strokeWidth={1.5}
        />
      </g>
    );
  };
  return (
    <svg
      aria-hidden="true"
      className="h-16 w-full"
      role="presentation"
      viewBox="0 0 120 64"
    >
      {sac(38)}
      {sac(82)}
    </svg>
  );
}

const VARIANTES: Record<Operation, readonly VariantePlateau[]> = {
  addition: [
    {
      phrase: {
        en: (h) => `${h} puts away some chestnuts`,
        fr: (h) => `${h} range des marrons`,
      },
      Scene: MarronsScene,
    },
    {
      phrase: {
        en: (h) => `${h} gathers some leaves`,
        fr: (h) => `${h} ramasse des feuilles`,
      },
      Scene: FeuillesScene,
    },
    {
      phrase: {
        en: (h) => `${h} picks some flowers`,
        fr: (h) => `${h} cueille des fleurs`,
      },
      Scene: FleursScene,
    },
  ],
  multiplication: [
    {
      phrase: {
        en: (h) => `${h} fills some baskets`,
        fr: (h) => `${h} remplit des paniers`,
      },
      Scene: PaniersScene,
    },
    {
      phrase: {
        en: (h) => `${h} fills some bowls`,
        fr: (h) => `${h} remplit des bols`,
      },
      Scene: BolsScene,
    },
    {
      phrase: {
        en: (h) => `${h} fills some bags`,
        fr: (h) => `${h} remplit des sacs`,
      },
      Scene: SacsScene,
    },
  ],
  soustraction: [
    {
      needsDoudou: true,
      // Repli défensif : la variante est filtrée sans doudou (needsDoudou),
      // mais la phrase ne peut JAMAIS imprimer « à null » pour autant.
      phrase: {
        en: (h, d) =>
          d ? `${h} gives some to ${d}` : `${h} puts some away in the box`,
        fr: (h, d) =>
          d ? `${h} en donne à ${d}` : `${h} en range dans sa boîte`,
      },
      Scene: DoudouScene,
    },
    {
      phrase: {
        en: (h) => `${h} puts some away in the box`,
        fr: (h) => `${h} en range dans sa boîte`,
      },
      Scene: BoiteScene,
    },
  ],
};

/* -------------------------------- Étagère -------------------------------- */

export function TrayShelf({
  trays,
  heroName,
  doudouName,
  onTake,
}: {
  trays: TrayInfo[];
  heroName: string | null;
  doudouName: string | null;
  onTake: (op: Operation) => void;
}) {
  // Rendu 100% client (la route ne monte l'étagère qu'après résolution des
  // réglages) — la date locale est donc hydration-safe ici. FIGÉE au montage :
  // un re-rendu après minuit (fenêtre restée ouverte) n'échange jamais une
  // scène sous les yeux de l'enfant — la nouvelle variante attend la
  // prochaine ouverture de l'étagère.
  const [jourKey] = useState(jourKeyLocal);
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
          <Tray
            doudouName={doudouName}
            heroName={heroName}
            jourKey={jourKey}
            key={tray.op}
            onTake={onTake}
            tray={tray}
          />
        ))}
      </div>
      {/* Empilement (< sm) : mêmes plateaux, même réserve de décalage. */}
      <div className="flex w-full flex-col items-center gap-8 sm:hidden">
        {trays.map((tray) => (
          <div className={SORTI_RESERVE_CLASS} key={tray.op}>
            <Tray
              doudouName={doudouName}
              heroName={heroName}
              jourKey={jourKey}
              onTake={onTake}
              tray={tray}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

function Tray({
  tray,
  heroName,
  doudouName,
  jourKey,
  onTake,
}: {
  tray: TrayInfo;
  heroName: string | null;
  doudouName: string | null;
  jourKey: string;
  onTake: (op: Operation) => void;
}) {
  const locale = useLocale();
  const m = useMessages();
  // Truthiness (pas !== null) : un label vide d'une ligne DB éditée à la
  // main compte comme « pas de doudou » — même règle que enonceFor, jamais
  // une scène doudou avec la phrase boîte.
  const variante = varianteDuPlateau(tray.op, jourKey, Boolean(doudouName));
  const { Scene } = variante;
  return (
    <button
      aria-label={`${formatMessage(m.calcul.prendrePlateau, { familles: m.calcul.familles[tray.op] })}${tray.sorti ? m.calcul.serieEnCours : ""}`}
      className={cn(
        // Le plateau ENTIER est la cible (D-7A/F18), ≥160px de haut ; même
        // grammaire que les portes de l'accueil : crème, bord encre doux,
        // rounded-2xl, focus ring existant.
        "flex min-h-40 w-[clamp(160px,28vw,240px)] shrink flex-col items-center justify-between gap-2 rounded-2xl border bg-card px-4 py-4",
        "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        // Retour au pointeur (design review : la seule surface interactive
        // sans hover de l'app) — une ombre douce, pas une suggestion.
        "hover:shadow-sm",
        "transition duration-300 motion-reduce:transition-none",
        // « Sorti » : décalage + ombre douce UNIQUEMENT (D-1A/F3).
        tray.sorti && cn(SORTI_SHIFT_CLASS, "shadow-md")
      )}
      onClick={() => onTake(tray.op)}
      type="button"
    >
      {/* La scène ne se nomme pas à l'écran ; elle est muette pour ARIA. */}
      <span aria-hidden="true" className="w-full">
        <Scene />
      </span>
      {heroName ? (
        <span aria-hidden="true" className="text-base text-muted-foreground">
          {variante.phrase[locale](heroName, doudouName)}
        </span>
      ) : null}
      <span
        aria-hidden="true"
        className="flex size-11 items-center justify-center rounded-full border border-primary border-dashed text-2xl text-primary"
      >
        {SIGNES[tray.op]}
      </span>
    </button>
  );
}
