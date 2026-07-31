import { createFileRoute, redirect } from "@tanstack/react-router";

/**
 * L'ancien hub /parents, retiré : le panneau latéral (route layout
 * `src/app/parents/route.tsx`) porte désormais toute la navigation de
 * l'espace parent. La route reste — les vieux liens et l'entrée
 * `espaceParent` de la palette ⌘K continuent d'atterrir ici — mais elle
 * redirige vers les réglages, la première page utile de l'espace.
 * Le réglage de langue (🌍) a déménagé sur /parents/reglages.
 */
export const Route = createFileRoute("/parents/")({
  beforeLoad: () => {
    throw redirect({ to: "/parents/reglages" });
  },
});
