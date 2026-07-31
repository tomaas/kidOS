import {
  createFileRoute,
  Link,
  Outlet,
  useRouterState,
} from "@tanstack/react-router";
import {
  Grid3x3,
  Home,
  type LucideIcon,
  MapPin,
  Palette,
  Rabbit,
  Sparkles,
  Users,
  Wrench,
} from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
  useSidebar,
} from "~/components/ui/sidebar";
import { useMessages } from "~/lib/i18n";
import {
  SECTIONS_PARENTS,
  type SectionParentsId,
} from "~/lib/parents/sections";

/**
 * La route layout de l'espace /parents : le PANNEAU LATÉRAL partagé par les
 * huit pages parent — la première layout de la section, sur le modèle de
 * `src/app/_bureau/route.tsx`. Les URLs publiques ne changent pas ; seule la
 * navigation autour des pages change (les boutons « Accueil » par page
 * disparaissent au profit du pied du panneau).
 *
 * Contrat de la layout (même raison que _bureau) — NE PAS poser `ssr` ici :
 * la config Selective SSR de TanStack est héritée vers le bas et ne peut que
 * se restreindre. Le panneau rend SSR-safe : `useIsMobile` est un
 * useSyncExternalStore avec snapshot serveur `false` (variante desktop au
 * premier paint, idiome D17-A).
 *
 * Contrainte calme : de la NAVIGATION seulement — aucune entrée du panneau
 * n'est une action, aucun raccourci vers une mini-app du bureau (la palette
 * ⌘K garde la même règle). Le retour bureau vit dans le pied, avec le rappel
 * du raccourci ⌘K (`palette.indice`).
 */
export const Route = createFileRoute("/parents")({
  component: ParentsLayout,
});

/**
 * Le pictogramme de chaque section — de la présentation, gardée hors du
 * registre pur (`lib/parents/sections.ts`), comme `PICTOGRAMMES` dans
 * palette-parent.tsx (mêmes glyphes : une seule iconographie parent).
 * NB : Biome trie les clés du Record par ordre alphabétique — l'ORDRE de
 * rendu vient du registre (`SECTIONS_PARENTS`), jamais d'ici.
 */
const PICTOGRAMMES: Record<SectionParentsId, LucideIcon> = {
  calcul: Grid3x3,
  doudous: Rabbit,
  elements: Sparkles,
  heroes: Users,
  imageModel: Palette,
  lieux: MapPin,
  reglages: Wrench,
};

function ParentsLayout() {
  const m = useMessages();
  return (
    <SidebarProvider>
      <SidebarParents />
      <SidebarInset>
        {/* Le déclencheur (icône seule, d'où l'aria-label du catalogue) rend
            à TOUTES les largeurs : repli offcanvas au clavier (⌘B/Ctrl+B
            aussi) sur desktop, ouverture du tiroir mobile en dessous de
            768px. `no-print` : jamais sur une fiche A5. */}
        <header className="no-print flex items-center gap-2 px-4 pt-4">
          <SidebarTrigger aria-label={m.parents.barreLaterale.basculer} />
        </header>
        {/* La colonne de lecture — remplace À LA FOIS l'ancien conteneur
            max-w-5xl de __root et le wrapper max-w-3xl que chaque page
            portait elle-même. */}
        <div className="mx-auto w-full max-w-3xl space-y-8 px-6 py-10">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}

function SidebarParents() {
  const m = useMessages();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { isMobile, setOpenMobile } = useSidebar();

  // Sur mobile, une navigation referme le tiroir. Le retour de focus vers le
  // déclencheur est NATIF (Base UI Dialog / FloatingFocusManager :
  // `returnFocus` par défaut vise l'élément focalisé avant l'ouverture — le
  // déclencheur, toujours monté puisque la layout persiste) — vérifié dans la
  // source du paquet, rien à câbler ici.
  function surNavigation() {
    if (isMobile) {
      setOpenMobile(false);
    }
  }

  return (
    <Sidebar collapsible="offcanvas" variant="sidebar">
      <SidebarHeader>
        <p className="px-2 pt-2 font-semibold text-lg">
          {m.parents.espaceParent}
        </p>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {SECTIONS_PARENTS.map((section) => {
                const Pictogramme = PICTOGRAMMES[section.id];
                return (
                  <SidebarMenuItem key={section.id}>
                    <SidebarMenuButton
                      isActive={pathname.startsWith(section.to)}
                      render={<Link onClick={surNavigation} to={section.to} />}
                    >
                      <Pictogramme />
                      <span>{m.parents.index.sections[section.id].titre}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <Button
          className="justify-start gap-2 text-muted-foreground"
          nativeButton={false}
          onClick={surNavigation}
          render={<Link to="/" />}
          variant="ghost"
        >
          <Home className="size-4" />
          {m.commun.accueil}
        </Button>
        {/* Le rappel du raccourci ⌘K vit dans l'espace parent, jamais côté
            enfant — même règle que la palette elle-même. */}
        <p className="px-2 pb-1 text-muted-foreground text-sm">
          {m.palette.indice}
        </p>
      </SidebarFooter>
    </Sidebar>
  );
}
