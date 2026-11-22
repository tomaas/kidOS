import { createRouter } from "@tanstack/react-router";

import { routeTree } from "./routeTree.gen";

export function getRouter() {
  return createRouter({
    routeTree,
    scrollRestoration: true,
    // Le scroll vit DANS la fenêtre du bureau (.bureau-fenetre-contenu), plus
    // dans window : sans ce sélecteur, une navigation intra-fenêtre
    // (bibliothèque défilée → histoire) garderait l'offset de la page
    // précédente — l'enfant ouvrirait une histoire au milieu.
    scrollToTopSelectors: [".bureau-fenetre-contenu"],
  });
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
