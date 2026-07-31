import { useNavigate } from "@tanstack/react-router";
import {
  Grid3x3,
  Home,
  LayoutGrid,
  type LucideIcon,
  MapPin,
  Palette,
  Rabbit,
  Sparkles,
  Users,
  Wrench,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "~/components/ui/command";
import { type Messages, useMessages } from "~/lib/i18n";
import {
  type EntreePalette,
  type EntreePaletteId,
  entreesDuGroupe,
} from "~/lib/palette/entrees";

/**
 * La palette ⌘K — la porte clavier du PARENT vers l'espace parent (et le
 * retour au bureau). Montée dans __root, donc disponible partout, mais
 * DÉLIBÉRÉMENT sans déclencheur visible dans la couche enfant : elle prolonge
 * la règle de /parents (« atteignable par URL, jamais dessinée dans la
 * grammaire enfant ») au lieu de la contredire — l'enfant, sur sa tablette,
 * n'a ni ⌘ ni Ctrl. Le rappel du raccourci vit sur /parents, côté parent.
 *
 * Composant shadcn/ui `command`, variante base (voir components/ui/command.tsx).
 * La palette n'est montée QUE ouverte : rien dans le DOM (pas même le titre
 * sr-only du dialogue) quand elle est fermée, et la recherche repart donc
 * vierge à chaque ouverture.
 *
 * Contrainte calme : c'est de la NAVIGATION, jamais une action — aucune
 * commande qui modifie quoi que ce soit ne vit ici (un enregistrement se fait
 * sur sa page, avec son contexte).
 */

/**
 * Le pictogramme de chaque entrée — de la présentation, gardée hors du registre
 * pur (`lib/palette/entrees.ts`). Les glyphes reprennent les emojis des cartes
 * de /parents, et `Grid3x3` est celui de l'app Calculs du bureau.
 */
const PICTOGRAMMES: Record<EntreePaletteId, LucideIcon> = {
  accueil: Home,
  calcul: Grid3x3,
  doudous: Rabbit,
  elements: Sparkles,
  espaceParent: LayoutGrid,
  heroes: Users,
  imageModel: Palette,
  lieux: MapPin,
  reglages: Wrench,
};

/**
 * Le libellé d'une entrée, lu dans le catalogue à la MÊME clé que la carte
 * correspondante de /parents (voir le commentaire de `EntreePaletteId`).
 */
function libellePalette(m: Messages, id: EntreePaletteId): string {
  if (id === "accueil") {
    return m.commun.accueil;
  }
  if (id === "espaceParent") {
    return m.parents.espaceParent;
  }
  return m.parents.index.sections[id].titre;
}

/** Le raccourci d'ouverture : ⌘K sur Mac, Ctrl+K ailleurs. */
function estRaccourciPalette(evenement: KeyboardEvent): boolean {
  return (
    (evenement.metaKey || evenement.ctrlKey) &&
    !evenement.altKey &&
    evenement.key.toLowerCase() === "k"
  );
}

export function PaletteParent() {
  const m = useMessages();
  const navigate = useNavigate();
  const [ouverte, setOuverte] = useState(false);

  useEffect(() => {
    function surTouche(evenement: KeyboardEvent) {
      if (estRaccourciPalette(evenement)) {
        // preventDefault : ⌘K/Ctrl+K est aussi le raccourci de recherche du
        // navigateur — sans ça, la barre d'adresse prendrait le focus.
        evenement.preventDefault();
        setOuverte((precedent) => !precedent);
      }
    }
    document.addEventListener("keydown", surTouche);
    return () => document.removeEventListener("keydown", surTouche);
  }, []);

  if (!ouverte) {
    return null;
  }

  return (
    <CommandDialog
      description={m.palette.description}
      onOpenChange={setOuverte}
      open
      title={m.palette.titre}
    >
      <Command>
        <CommandInput autoFocus placeholder={m.palette.placeholder} />
        {/* Un peu plus haut que le défaut du composant (max-h-72) : les neuf
            entrées tiennent SANS défilement — rien de caché sous le pli. */}
        <CommandList className="max-h-[24rem]">
          <CommandEmpty>{m.palette.aucuneEntree}</CommandEmpty>
          <CommandGroup heading={m.palette.groupeParent}>
            {entreesDuGroupe("parent").map((entree) => (
              <EntreeDeLaPalette
                entree={entree}
                key={entree.id}
                onChoisie={() => {
                  setOuverte(false);
                  navigate({ to: entree.to });
                }}
              />
            ))}
          </CommandGroup>
          <CommandSeparator />
          <CommandGroup heading={m.palette.groupeAtelier}>
            {entreesDuGroupe("atelier").map((entree) => (
              <EntreeDeLaPalette
                entree={entree}
                key={entree.id}
                onChoisie={() => {
                  setOuverte(false);
                  navigate({ to: entree.to });
                }}
              />
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </CommandDialog>
  );
}

function EntreeDeLaPalette({
  entree,
  onChoisie,
}: Readonly<{ entree: EntreePalette; onChoisie: () => void }>) {
  const m = useMessages();
  const Pictogramme = PICTOGRAMMES[entree.id];
  return (
    <CommandItem
      keywords={[...entree.motsCles]}
      onSelect={onChoisie}
      value={entree.id}
    >
      <Pictogramme />
      <span>{libellePalette(m, entree.id)}</span>
    </CommandItem>
  );
}
