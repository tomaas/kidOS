/**
 * Énoncés à gabarits (décision eng-review D11-C) — le monde d'Arsène dans
 * les nombres, SANS LLM : des phrases déterministes assemblées depuis des
 * gabarits fixes + les entités de la famille (héros, doudou), seedées.
 *
 * Garde-fou de sobriété : UNE phrase courte au-dessus de l'opération,
 * jamais de mini-histoire. Les mots sont calmes par construction (ranger,
 * apporter, cueillir…) — aucun terme de forbidden-terms.ts ne peut
 * apparaître puisque rien n'est généré librement.
 *
 * Variété (UX 2026-07-23) : chaque famille tire dans PLUSIEURS gabarits et
 * la multiplication dans plusieurs contenants — plus de « toujours des
 * paniers ». Le tirage reste seedé par l'opération : une série interrompue
 * régénère mot pour mot les mêmes énoncés — à VERSION DE CODE et CONFIG
 * D'ENTITÉS constantes (un déploiement qui change les pools, lui, re-mot
 * les énoncés d'une série en vol ; les opérations, elles, ne bougent pas).
 * Le module héberge aussi
 * varianteDuJour, le tirage jour-par-jour des variantes de l'ÉTAGÈRE
 * (consommé par tray-shelf.tsx) — même monde, même exigence de pureté.
 *
 * BILINGUE (plan multilangue, phase 2) : deux packs de gabarits, FR et EN,
 * choisis par le paramètre `locale` (défaut "fr" — les goldens historiques
 * appellent sans locale et restent byte-identiques). CONTRAT PRNG : les
 * pools des deux langues ont EXACTEMENT les mêmes longueurs, alignés par
 * index (marrons↔chestnuts) — la longueur d'un pool fait partie du contrat
 * du tirage (pick indexe par rand()*length) : à seed égale, l'énoncé EN est
 * LA TRADUCTION de l'énoncé FR. Le fingerprint de reprise étant digits-only,
 * changer la langue re-libelle une série en vol sans jamais l'invalider.
 * L'ordre des tirages (objet → pièce → [contenant] → gabarit) est LE MÊME
 * dans les deux langues — ne jamais le réordonner.
 *
 * Pur : les noms d'entités sont PASSÉS en argument (jamais lus en DB ici).
 */

import type { Locale } from "~/lib/i18n/locale";
import { mulberry32 } from "~/lib/operations/generator";
import type { GeneratedOperation } from "~/lib/operations/types";

export interface EnonceEntities {
  /** Nom du doudou, s'il existe. */
  doudou?: string;
  /** Prénom du héros (obligatoire — l'enfant de la famille). */
  hero: string;
}

/** Objets calmes et dénombrables, au pluriel (on en manipule toujours ≥ 2).
    Exporté pour que le golden dérive son normaliseur de gabarits d'ICI —
    un objet ajouté ne peut pas faire dériver le test silencieusement. */
export const OBJETS = [
  "marrons",
  "billes",
  "coquillages",
  "feuilles",
  "cailloux",
  "pommes",
  "fleurs",
  "plumes",
  "noisettes",
  "boutons",
] as const;

/** Le pool EN, aligné INDEX PAR INDEX sur OBJETS (contrat PRNG ci-dessus) —
    même longueur épinglée par le golden. Exporté pour le normaliseur EN. */
export const OBJETS_EN = [
  "chestnuts",
  "marbles",
  "seashells",
  "leaves",
  "pebbles",
  "apples",
  "flowers",
  "feathers",
  "hazelnuts",
  "buttons",
] as const;

/** Contenants calmes pour la multiplication, au pluriel (toujours ≥ 2). */
const CONTENANTS = ["paniers", "boîtes", "corbeilles", "sacs", "bols"] as const;

/** EN, aligné sur CONTENANTS (« tubs » pour corbeilles — jamais « trays » :
    le mot est réservé au plateau de l'étagère). */
const CONTENANTS_EN = ["baskets", "boxes", "tubs", "bags", "bowls"] as const;

function pick<T>(rand: () => number, items: readonly T[]): T {
  return items[Math.floor(rand() * items.length)];
}

/** Le contexte d'un gabarit — l'opération et les mots déjà tirés. */
interface EnonceContexte {
  a: number;
  b: number;
  compagnon: string;
  contenant: string;
  hero: string;
  objet: string;
}

type Gabarit = (c: EnonceContexte) => string;

/**
 * Un pack de gabarits par langue. INVARIANT (épinglé par le golden) : les
 * deux packs ont le même nombre de gabarits par branche — le tirage seedé
 * choisit le même index dans les deux langues.
 */
interface EnoncePack {
  additionDuo: readonly Gabarit[];
  additionSolo: readonly Gabarit[];
  contenants: readonly string[];
  multiplication: readonly Gabarit[];
  objets: readonly string[];
  soustractionDuo: readonly Gabarit[];
  soustractionSolo: readonly Gabarit[];
}

// Les littéraux FR sont les octets HISTORIQUES (épinglés par le golden) —
// un déplacement, jamais une réécriture.
const PACK_FR: EnoncePack = {
  additionDuo: [
    (c) =>
      `${c.hero} range ${c.a} ${c.objet}, ${c.compagnon} en apporte ${c.b}.`,
    (c) =>
      `${c.hero} pose ${c.a} ${c.objet}, ${c.compagnon} en pose ${c.b} à côté.`,
  ],
  additionSolo: [
    (c) => `${c.hero} a ${c.a} ${c.objet} et en trouve encore ${c.b}.`,
    (c) => `${c.hero} ramasse ${c.a} ${c.objet}, puis encore ${c.b}.`,
    (c) => `${c.hero} range ${c.a} ${c.objet} et encore ${c.b}.`,
  ],
  contenants: CONTENANTS,
  multiplication: [
    (c) => `${c.hero} remplit ${c.b} ${c.contenant} de ${c.a} ${c.objet}.`,
    (c) => `${c.hero} prépare ${c.b} ${c.contenant} de ${c.a} ${c.objet}.`,
  ],
  objets: OBJETS,
  soustractionDuo: [
    (c) => `${c.hero} a ${c.a} ${c.objet} et en donne ${c.b} à ${c.compagnon}.`,
    (c) => `${c.hero} a ${c.a} ${c.objet} et en offre ${c.b} à ${c.compagnon}.`,
    (c) => `${c.hero} a ${c.a} ${c.objet} et en prête ${c.b} à ${c.compagnon}.`,
  ],
  soustractionSolo: [
    (c) =>
      `${c.hero} a cueilli ${c.a} ${c.objet} et en range ${c.b} dans sa boîte.`,
    (c) => `${c.hero} a ${c.a} ${c.objet} et en pose ${c.b} sur l'étagère.`,
    (c) => `${c.hero} a ${c.a} ${c.objet} et en rapporte ${c.b} à la maison.`,
  ],
};

// Même sémantique, mêmes comptes par branche, même sobriété (1 phrase,
// < 90 caractères) — et le scan calme du golden s'applique aussi ici
// (jamais well done/won/hurry/wrong…).
const PACK_EN: EnoncePack = {
  additionDuo: [
    (c) =>
      `${c.hero} puts away ${c.a} ${c.objet}, ${c.compagnon} brings ${c.b} more.`,
    (c) =>
      `${c.hero} lays out ${c.a} ${c.objet}, ${c.compagnon} adds ${c.b} beside them.`,
  ],
  additionSolo: [
    (c) => `${c.hero} has ${c.a} ${c.objet} and finds ${c.b} more.`,
    (c) => `${c.hero} gathers ${c.a} ${c.objet}, then ${c.b} more.`,
    (c) => `${c.hero} puts away ${c.a} ${c.objet} and ${c.b} more.`,
  ],
  contenants: CONTENANTS_EN,
  multiplication: [
    (c) => `${c.hero} fills ${c.b} ${c.contenant} with ${c.a} ${c.objet} each.`,
    (c) =>
      `${c.hero} gets ${c.b} ${c.contenant} ready with ${c.a} ${c.objet} each.`,
  ],
  objets: OBJETS_EN,
  soustractionDuo: [
    (c) =>
      `${c.hero} has ${c.a} ${c.objet} and gives ${c.b} to ${c.compagnon}.`,
    (c) =>
      `${c.hero} has ${c.a} ${c.objet} and offers ${c.b} to ${c.compagnon}.`,
    (c) =>
      `${c.hero} has ${c.a} ${c.objet} and lends ${c.b} to ${c.compagnon}.`,
  ],
  soustractionSolo: [
    (c) =>
      `${c.hero} picked ${c.a} ${c.objet} and puts ${c.b} away in the box.`,
    (c) => `${c.hero} has ${c.a} ${c.objet} and lays ${c.b} on the shelf.`,
    (c) => `${c.hero} has ${c.a} ${c.objet} and brings ${c.b} back home.`,
  ],
};

const PACKS: Record<Locale, EnoncePack> = { en: PACK_EN, fr: PACK_FR };

/**
 * Une phrase d'habillage pour l'opération, déterministe (op.seed).
 * Le compagnon (doudou) n'apparaît que s'il est fourni.
 */
/** Décorrèle le PRNG des énoncés du flux du générateur (même seed d'op). */
const ENONCE_SEED_SALT = 0x5f_37_59_df;

export function enonceFor(
  op: GeneratedOperation,
  entities: EnonceEntities,
  locale: Locale = "fr"
): string {
  const pack = PACKS[locale];
  const rand = mulberry32(op.seed ^ ENONCE_SEED_SALT);
  const objet = pick(rand, pack.objets);
  const { hero, doudou } = entities;
  // Tirage de branche TOUJOURS consommé, doudou ou pas : la présence du
  // compagnon ne décale jamais le flux PRNG — le libellé des variantes solo
  // est invariant à la config d'entités (red-team 2026-07-23).
  const coin = rand();

  const contexte: EnonceContexte = {
    a: op.a,
    b: op.b,
    compagnon: doudou ?? "",
    contenant: "",
    hero,
    objet,
  };

  if (op.op === "addition") {
    if (doudou && coin < 0.5) {
      return pick(rand, pack.additionDuo)(contexte);
    }
    return pick(rand, pack.additionSolo)(contexte);
  }

  if (op.op === "soustraction") {
    if (doudou && coin < 0.5) {
      return pick(rand, pack.soustractionDuo)(contexte);
    }
    return pick(rand, pack.soustractionSolo)(contexte);
  }

  // multiplication — le contenant varie aussi (jamais « toujours des paniers »).
  // Ordre des tirages inchangé : contenant AVANT gabarit (contrat PRNG).
  contexte.contenant = pick(rand, pack.contenants);
  return pick(rand, pack.multiplication)(contexte);
}

/**
 * Variante « du jour » d'un plateau de l'étagère (UX 2026-07-23) : les scènes
 * ne sont plus figées à vie — la variante change avec le JOUR (l'étagère est
 * préparée pendant la nuit, comme les plateaux d'une classe), jamais sous les
 * yeux de l'enfant : même jour → même étagère, aucun flicker, un rendu
 * déterministe et testable. `jourKey` est une clé de jour locale
 * (ex. « 2026-7-23 ») fournie par l'appelant — la lib reste pure.
 */
export function varianteDuJour(
  famille: string,
  jourKey: string,
  count: number
): number {
  if (count <= 1) {
    return 0;
  }
  const graine = `${famille}:${jourKey}`;
  let h = 0;
  for (let i = 0; i < graine.length; i += 1) {
    // Petit hachage polynomial sans bitwise (h reste < 2^32, exact en double).
    h = (h * 31 + graine.charCodeAt(i)) % 4_294_967_296;
  }
  return h % count;
}
