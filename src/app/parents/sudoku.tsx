import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import { cn } from "~/lib/cn";
import { useMessages } from "~/lib/i18n";
import {
  GENEROSITES,
  type Generosite,
  TAILLES,
  type Taille,
} from "~/lib/sudoku";
import {
  getSudokuSettingsFn,
  saveSudokuSettingsFn,
} from "~/server/sudoku-functions";

/**
 * Parent-only page for the sudoku mini-app — same grammar as /parents/calcul
 * (THE template, mirrored deliberately): the parent prepares the child's
 * SHELF — one card per grid size (activated + that size's generosity, the
 * calm "ouverture" of the grid) — the child picks a tray and never sees any
 * of this. No automatic progression, no evaluation (R13).
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

/** Réglage local d'une carte : activée + générosité (toujours valide). */
type CardState = Record<Taille, { active: boolean; generosite: Generosite }>;

function cardStateFrom(
  tailles: { active: boolean; generosite: Generosite; taille: Taille }[]
): CardState {
  const state = {} as CardState;
  for (const taille of TAILLES) {
    const saved = tailles.find((t) => t.taille === taille);
    state[taille] = {
      active: saved?.active ?? false,
      generosite: saved?.generosite ?? 1,
    };
  }
  return state;
}

function ParentsSudokuPage() {
  const router = useRouter();
  const { settings } = Route.useLoaderData();

  if (!settings) {
    // Miroir de /parents/calcul (red-team RT2 / R14) : un échec de chargement
    // ne doit JAMAIS se présenter comme un formulaire éditable (toutes
    // tailles décochées) — un parent qui « répare » écraserait les vrais
    // réglages avec des défauts.
    return <SettingsUnavailable />;
  }

  return (
    <ParentsSudokuForm
      onSaved={() => router.invalidate()}
      settings={settings}
    />
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

function ParentsSudokuForm({
  settings,
  onSaved,
}: {
  settings: NonNullable<ReturnType<typeof Route.useLoaderData>["settings"]>;
  onSaved: () => Promise<void>;
}) {
  const m = useMessages();
  const [cards, setCards] = useState<CardState>(() =>
    cardStateFrom(settings.tailles)
  );
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const savedCards = cardStateFrom(settings.tailles);
  // La générosité d'une taille DÉSACTIVÉE ne compte pas (idiome calcul) : elle
  // ne part pas dans la sauvegarde, elle ne peut pas rendre le formulaire sale.
  const dirty = TAILLES.some(
    (taille) =>
      cards[taille].active !== savedCards[taille].active ||
      (cards[taille].active &&
        cards[taille].generosite !== savedCards[taille].generosite)
  );

  const activeCount = TAILLES.filter((taille) => cards[taille].active).length;

  function setCard(taille: Taille, update: Partial<CardState[Taille]>) {
    setCards((prev) => ({
      ...prev,
      [taille]: { ...prev[taille], ...update },
    }));
  }

  async function save() {
    setSaving(true);
    setSaveError(null);
    let saved = false;
    try {
      const result = await saveSudokuSettingsFn({
        data: {
          tailles: TAILLES.filter((taille) => cards[taille].active).map(
            (taille) => ({
              generosite: cards[taille].generosite,
              taille,
            })
          ),
        },
      });
      if (!result.success) {
        // Le serveur renvoie un CODE ; le libellé vient du catalogue (D7).
        setSaveError(m.parents.enregistrementImpossible);
        return;
      }
      saved = true;
      // Hors du try/catch d'enregistrement (idiome calcul) : un re-load qui
      // échoue APRÈS un save réussi ne doit pas prétendre que rien n'a été
      // enregistré.
      await onSaved();
    } catch {
      setSaveError(
        saved
          ? m.parents.sudoku.rechargementEchoue
          : m.parents.enregistrementImpossible
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="space-y-2">
        <h1 className="font-bold text-3xl">{m.parents.sudoku.titre}</h1>
        <p className="text-muted-foreground">{m.parents.sudoku.intro}</p>
      </div>

      <ul className="space-y-4">
        {TAILLES.map((taille) => {
          const card = cards[taille];
          // Miroir client du .min(1) serveur (R13) : la dernière taille
          // active garde son interrupteur bloqué, avec la ligne qui explique.
          const lastActive = card.active && activeCount === 1;
          return (
            <li
              className="space-y-3 rounded-2xl border bg-card p-4"
              key={taille}
            >
              <label
                className={cn(
                  // Toute la rangée est la cible (≥44px, design review) ;
                  // le curseur ne promet un clic que si le contrôle répond.
                  "flex min-h-11 items-center gap-3",
                  !lastActive && "cursor-pointer"
                )}
              >
                <input
                  checked={card.active}
                  className="size-4 accent-primary"
                  disabled={lastActive}
                  onChange={(e) =>
                    setCard(taille, { active: e.target.checked })
                  }
                  type="checkbox"
                />
                <span className="font-semibold text-lg">
                  {m.parents.sudoku.tailles[taille]}
                </span>
              </label>
              {lastActive ? (
                <p className="text-muted-foreground text-sm">
                  {m.parents.sudoku.derniereTaille}
                </p>
              ) : null}
              {card.active ? (
                <div className="space-y-2">
                  <p className="font-medium">{m.parents.sudoku.generosite}</p>
                  <ul className="space-y-2">
                    {GENEROSITES.map((generosite) => (
                      <li key={generosite}>
                        <label className="flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors has-checked:border-primary">
                          <input
                            checked={card.generosite === generosite}
                            className="size-4 accent-primary"
                            name={`generosite-${taille}`}
                            onChange={() => setCard(taille, { generosite })}
                            type="radio"
                          />
                          <span>
                            {m.parents.sudoku.generosites[generosite]}
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                  {/* Même transparence que pour le palier du calcul : la
                      conséquence est dite AVANT le geste. */}
                  <p className="text-muted-foreground text-sm">
                    {m.parents.sudoku.changerGenerosite}
                  </p>
                </div>
              ) : (
                <p className="text-muted-foreground text-sm">
                  {m.parents.sudoku.nApparaitPas}
                </p>
              )}
            </li>
          );
        })}
      </ul>

      <div className="flex flex-wrap items-center gap-4">
        <Button disabled={!dirty || saving} onClick={save}>
          {saving
            ? m.parents.sudoku.enregistrement
            : m.parents.sudoku.enregistrer}
        </Button>
        {saveError ? (
          // Distinct des textes d'aide passifs (convention calcul) : un échec
          // d'enregistrement doit se voir — calme, mais pas camouflé.
          <p className="font-medium text-foreground text-sm">{saveError}</p>
        ) : null}
      </div>
    </>
  );
}
