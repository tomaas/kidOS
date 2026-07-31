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

function subscribeMobile(onChange: () => void) {
  const media = window.matchMedia(MOBILE_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

export function useIsMobile(): boolean {
  return useSyncExternalStore(
    subscribeMobile,
    () => window.matchMedia(MOBILE_QUERY).matches,
    // SSR : pas de lecture de window pendant le rendu (D17-A) — `false`
    // rend la variante desktop, corrigée au premier snapshot client.
    () => false
  );
}
