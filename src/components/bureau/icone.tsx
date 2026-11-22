/**
 * L'icône de bureau — la première grammaire de l'OS réel (prémisse 4) :
 * simple clic = sélection (l'étiquette se surligne en sauge), double-clic =
 * ouvre via l'événement NATIF `dblclick` (le délai du système, jamais un
 * seuil maison : c'est le geste de l'OS réel qui doit transférer). Entrée =
 * ouvre.
 *
 * REVIREMENT (décision utilisateur 2026-07-22) : le rattrapage « Ouvrir »
 * en emplacement réservé (T5) est SUPPRIMÉ — le double-clic est le seul
 * geste d'ouverture au pointeur, comme sur le vrai OS. Si l'observation
 * d'Arsène (The Assignment) montre qu'il n'y arrive pas, le rattrapage se
 * remet en un commit (la machine à états n'a pas bougé : `selectionnee`
 * existe toujours, seul le bouton a disparu).
 *
 * Look OS réel : une TUILE d'application teintée (chaque app a sa couleur de
 * la palette calme) + l'étiquette SOUS la tuile, qui se surligne en sauge à
 * la sélection — exactement ce que fait un vrai bureau avec le nom d'une
 * icône sélectionnée. Cible ≥ 96 px. Les transitions passent par la machine
 * à états PURE de lib/bureau/icone.ts (eng-review D19-A).
 */

import type { LucideIcon } from "lucide-react";

import type { EvenementIcone } from "~/lib/bureau/icone";
import { cn } from "~/lib/cn";

export interface TeinteIcone {
  /** Classes de couleur du glyphe (in-palette, jamais criard). */
  glyphe: string;
  /** Classes de fond/bord de la tuile d'application. */
  tuile: string;
}

export interface IconeBureauProps {
  icone: LucideIcon;
  libelle: string;
  onEvenement: (evenement: EvenementIcone) => void;
  selectionnee: boolean;
  teinte: TeinteIcone;
}

export function IconeBureau({
  icone: Icone,
  libelle,
  onEvenement,
  selectionnee,
  teinte,
}: IconeBureauProps) {
  return (
    // data-icone-bureau : le « clic ailleurs » du bureau ignore l'icône.
    <div className="flex w-44 flex-col items-center" data-icone-bureau>
      <button
        className="group flex cursor-pointer flex-col items-center gap-2.5 rounded-2xl p-3 outline-none focus-visible:ring-4 focus-visible:ring-ring"
        onClick={() => {
          onEvenement("click");
        }}
        onDoubleClick={() => {
          onEvenement("dblclick");
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            // Sans preventDefault, le navigateur synthétise un click derrière
            // Entrée — l'icône se contenterait de se sélectionner.
            event.preventDefault();
            onEvenement("enter");
          }
        }}
        type="button"
      >
        <span
          className={cn(
            "flex size-24 items-center justify-center rounded-[1.75rem] border shadow-sm transition-transform duration-150 motion-reduce:transition-none",
            teinte.tuile,
            selectionnee
              ? "scale-[1.04] ring-4 ring-accent-foreground/25"
              : "group-hover:scale-[1.04]"
          )}
        >
          <Icone aria-hidden="true" className={cn("size-12", teinte.glyphe)} />
        </span>
        {/* L'étiquette se surligne comme sur un vrai bureau — le nom de
            l'icône sélectionnée porte un cartouche sauge. */}
        <span
          className={cn(
            "rounded-lg px-2.5 py-0.5 text-xl leading-tight font-semibold",
            selectionnee && "bg-accent text-accent-foreground"
          )}
        >
          {libelle}
        </span>
      </button>
    </div>
  );
}
