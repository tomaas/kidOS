/**
 * Le registre PUR des sections de l'espace /parents — même idée que
 * `lib/palette/entrees.ts` : une seule liste, dont l'`id` est AUSSI la clé
 * du libellé dans le catalogue i18n (`parents.index.sections[id]`). Aucune
 * dépendance (ni React, ni lucide) : les goldens peuvent l'importer, et le
 * hub comme la future sidebar lisent la MÊME liste — renommer ou réordonner
 * une section ne peut pas les désynchroniser.
 */

import type { CheminPalette, EntreePaletteId } from "~/lib/palette/entrees";

/**
 * L'id d'une section = la clé de son libellé dans le catalogue, ET l'id de
 * l'entrée correspondante de la palette ⌘K (le sous-ensemble « sections » de
 * `EntreePaletteId` — ni `accueil`, ni `espaceParent`).
 */
export type SectionParentsId = Exclude<
  EntreePaletteId,
  "accueil" | "espaceParent"
>;

/**
 * Les chemins des sections — dérivés de `CheminPalette` (import de type
 * seulement, le module reste sans dépendance) : une seule liste de littéraux,
 * vérifiée contre l'arbre du router côté palette.
 */
export type CheminSectionParents = Exclude<CheminPalette, "/" | "/parents">;

export interface SectionParents {
  readonly id: SectionParentsId;
  readonly to: CheminSectionParents;
}

/** Les sections, dans l'ordre canonique du hub. */
export const SECTIONS_PARENTS: readonly SectionParents[] = [
  { id: "heroes", to: "/parents/heroes" },
  { id: "lieux", to: "/parents/lieux" },
  { id: "elements", to: "/parents/elements" },
  { id: "doudous", to: "/parents/doudous" },
  { id: "calcul", to: "/parents/calcul" },
  { id: "imageModel", to: "/parents/image-model" },
  { id: "reglages", to: "/parents/reglages" },
];
