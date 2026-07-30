import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { Home, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { PlaceForm } from "~/components/place-form";
import { Button } from "~/components/ui/button";
import { formatMessage, useMessages } from "~/lib/i18n";
import type { DbPlace } from "~/server/db/schema";
import {
  createPlaceFn,
  deletePlaceFn,
  listPlacesFn,
  updatePlaceFn,
} from "~/server/places-functions";

export const Route = createFileRoute("/parents/lieux")({
  component: ParentsLieuxPage,
  loader: () => listPlacesFn(),
});

/**
 * Parent-only page (URL-only, NOT linked from the child flow) to manage the
 * places offered in the "où se passe l'histoire ?" picker. Add / edit /
 * soft-delete. Deliberately utilitarian — denser than the child screens, but
 * calm: no stakes, no counters. Image upload is out of scope (emoji + optional
 * manual path only).
 *
 * History safety: editing or deleting a place NEVER changes an already-created
 * story (each story froze its place label + hint at creation).
 */
function ParentsLieuxPage() {
  const m = useMessages();
  const router = useRouter();
  const places = Route.useLoaderData();
  // null = no form open; "new" = add form; a place = editing it.
  const [editing, setEditing] = useState<DbPlace | "new" | null>(null);

  async function refresh() {
    await router.invalidate();
  }

  async function handleDelete(id: string) {
    if (
      // biome-ignore lint/suspicious/noAlert: confirm() volontairement minimal — garde anti-tap accidentel, pas d'UI modale à maintenir.
      !window.confirm(m.parents.entites.lieux.confirmRetrait)
    ) {
      return;
    }
    await deletePlaceFn({ data: { id } });
    await refresh();
  }

  async function handleSubmit(values: {
    label: string;
    emoji?: string;
    imagePath?: string;
    promptHint: string;
  }) {
    if (editing === "new") {
      await createPlaceFn({ data: values });
    } else if (editing) {
      await updatePlaceFn({ data: { id: editing.id, ...values } });
    }
    setEditing(null);
    await refresh();
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8">
      <div>
        <Button
          className="gap-2 text-lg text-muted-foreground"
          nativeButton={false}
          render={<Link to="/" />}
          variant="ghost"
        >
          <Home className="size-5" />
          {m.commun.accueil}
        </Button>
      </div>

      <div className="space-y-2">
        <h1 className="font-bold text-3xl">{m.parents.entites.lieux.titre}</h1>
        <p className="text-muted-foreground">{m.parents.entites.lieux.intro}</p>
      </div>

      {editing ? (
        <PlaceForm
          initial={editing === "new" ? undefined : editing}
          onCancel={() => setEditing(null)}
          onSubmit={handleSubmit}
        />
      ) : (
        <Button
          className="gap-2"
          onClick={() => setEditing("new")}
          type="button"
        >
          <Plus className="size-5" />
          {m.parents.entites.lieux.ajouter}
        </Button>
      )}

      <ul className="space-y-3">
        {places.map((place) => (
          <li
            className="flex items-start gap-4 rounded-2xl border bg-card p-4"
            key={place.id}
          >
            <span aria-hidden="true" className="text-3xl leading-none">
              {place.emoji || "📍"}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-lg">{place.label}</p>
              <p className="truncate text-muted-foreground text-sm">
                {place.promptHint}
              </p>
            </div>
            <div className="flex shrink-0 gap-1">
              <Button
                aria-label={formatMessage(m.parents.entites.ariaModifier, {
                  label: place.label,
                })}
                onClick={() => setEditing(place)}
                size="icon"
                type="button"
                variant="ghost"
              >
                <Pencil className="size-4" />
              </Button>
              <Button
                aria-label={formatMessage(m.parents.entites.ariaSupprimer, {
                  label: place.label,
                })}
                onClick={() => handleDelete(place.id)}
                size="icon"
                type="button"
                variant="ghost"
              >
                <Trash2 className="size-4" />
              </Button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
