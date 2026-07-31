/**
 * Le pictogramme de chaque section de l'espace /parents — de la PRÉSENTATION,
 * gardée hors du registre pur (`lib/parents/sections.ts`, sans dépendance) :
 * ce module importe lucide, les goldens ne l'importent pas. Une seule
 * iconographie parent : le panneau latéral ET la palette ⌘K lisent cette
 * table (la palette y ajoute ses deux entrées propres, accueil et
 * espaceParent).
 * NB : Biome trie les clés du Record par ordre alphabétique — l'ORDRE de
 * rendu vient du registre (`SECTIONS_PARENTS`), jamais d'ici.
 */

import {
  Grid3x3,
  type LucideIcon,
  MapPin,
  Palette,
  Rabbit,
  Sparkles,
  Users,
  Wrench,
} from "lucide-react";

import type { SectionParentsId } from "~/lib/parents/sections";

export const PICTOGRAMMES_SECTIONS: Record<SectionParentsId, LucideIcon> = {
  calcul: Grid3x3,
  doudous: Rabbit,
  elements: Sparkles,
  heroes: Users,
  imageModel: Palette,
  lieux: MapPin,
  reglages: Wrench,
};
