import { createFileRoute } from "@tanstack/react-router";
import { useMessages } from "~/lib/i18n";
import { getSudokuSettingsFn } from "~/server/sudoku-functions";

/**
 * Parent-only page for the sudoku mini-app — minimal shell (unit U7 lays out
 * the per-size cards, mirroring /parents/calcul): the route exists so the
 * sidebar/palette links (`/parents/sudoku`, typed against the route tree)
 * compile, with the real settings loader already wired.
 * CONTRAT parents/ : jamais d'option `ssr` ici (épinglé par test:routes).
 */
export const Route = createFileRoute("/parents/sudoku")({
  component: ParentsSudokuPage,
  loader: async () => ({
    // Same resilience as /parents/calcul: a DB hiccup shows the calm
    // "settings unavailable" shell, never an editable form full of defaults.
    settings: await getSudokuSettingsFn().catch(() => null),
  }),
});

function ParentsSudokuPage() {
  const m = useMessages();
  const { settings } = Route.useLoaderData();

  if (!settings) {
    return <SettingsUnavailable />;
  }

  return (
    <div className="space-y-2">
      <h1 className="font-bold text-3xl">{m.parents.sudoku.titre}</h1>
      <p className="text-muted-foreground">{m.parents.sudoku.intro}</p>
    </div>
  );
}

function SettingsUnavailable() {
  const m = useMessages();
  return (
    <>
      <h1 className="font-bold text-3xl">{m.parents.sudoku.titre}</h1>
      <p className="text-muted-foreground">
        {m.parents.sudoku.reglagesIndisponibles}
      </p>
    </>
  );
}
