/**
 * shadcn/ui `use-mobile` — recopié depuis le registre `base-nova` puis
 * RÉÉCRIT pour l'idiome SSR du projet :
 *  - `useState(undefined)` + `useEffect` (le registre) → `useSyncExternalStore`
 *    avec un `getServerSnapshot` qui renvoie `false` — pas de lecture de
 *    `window` pendant le rendu (même idiome D17-A que `useEstDesktop` dans
 *    `src/components/bureau/fenetre.tsx`) ;
 *  - placé dans `src/lib/` (le projet n'a pas de dossier hooks/), l'alias
 *    `hooks` de components.json pointe sur `~/lib`.
 * Le seuil (768px) et le nom exporté `useIsMobile` restent ceux du registre :
 * `sidebar.tsx` les importe tels quels.
 */

import { useSyncExternalStore } from "react";

const MOBILE_BREAKPOINT = 768;

const MOBILE_QUERY = `(max-width: ${MOBILE_BREAKPOINT - 1}px)`;

// Une seule MediaQueryList partagée : `getSnapshot` est rappelé à CHAQUE
// rendu sous le SidebarProvider, et `window.matchMedia` construirait un
// objet neuf à chaque fois (différent de celui qui porte l'écouteur).
let mediaQuery: MediaQueryList | null = null;

function lireMediaQuery(): MediaQueryList {
  mediaQuery ??= window.matchMedia(MOBILE_QUERY);
  return mediaQuery;
}

function subscribeMobile(onChange: () => void) {
  const media = lireMediaQuery();
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

export function useIsMobile(): boolean {
  return useSyncExternalStore(
    subscribeMobile,
    () => lireMediaQuery().matches,
    // SSR : pas de lecture de window pendant le rendu (D17-A) — `false`
    // rend la variante desktop, corrigée au premier snapshot client.
    () => false
  );
}
