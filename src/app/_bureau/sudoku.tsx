import { createFileRoute } from "@tanstack/react-router";

/**
 * La mini-app sudoku — coquille minimale (l'unité U4 pose l'étagère de
 * plateaux et la grille) : ce fichier inscrit /sudoku dans l'arbre des routes,
 * contre lequel l'icône du bureau (`navigate({ to: app.to })`) est typée.
 * CONTRAT _bureau : jamais d'option `ssr` ici (épinglé par test:routes).
 */
export const Route = createFileRoute("/_bureau/sudoku")({
  component: SudokuPage,
});

function SudokuPage() {
  return <div className="mx-auto w-full max-w-4xl" />;
}
