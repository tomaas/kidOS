import { createFileRoute, useRouter } from "@tanstack/react-router";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { HeroForm } from "~/components/hero-form";
import { Button } from "~/components/ui/button";
import { formatMessage, useMessages } from "~/lib/i18n";
import type { DbHero } from "~/server/db/schema";
import {
  createHeroFn,
  deleteHeroFn,
  listHeroesFn,
  updateHeroFn,
} from "~/server/heroes-functions";

export const Route = createFileRoute("/parents/heroes")({
  component: ParentsHeroesPage,
  loader: () => listHeroesFn(),
});

/**
 * Parent-only page (URL-only, NOT linked from the child flow) to manage the
 * heroes offered in the "qui est le héros ?" picker. Add / edit / soft-delete.
 * Mirrors /parents/doudous exactly (heroes share the image-hint field).
 *
 * History safety: editing or deleting a hero NEVER changes an already-created
 * story (each story froze its hero label + hints at creation).
 */
function ParentsHeroesPage() {
  const m = useMessages();
  const router = useRouter();
  const heroes = Route.useLoaderData();
  // null = no form open; "new" = add form; a hero = editing it.
  const [editing, setEditing] = useState<DbHero | "new" | null>(null);

  async function refresh() {
    await router.invalidate();
  }

  async function handleDelete(id: string) {
    if (
      // biome-ignore lint/suspicious/noAlert: confirm() volontairement minimal — garde anti-tap accidentel, pas d'UI modale à maintenir.
      !window.confirm(m.parents.entites.heroes.confirmRetrait)
    ) {
      return;
    }
    await deleteHeroFn({ data: { id } });
    await refresh();
  }

  async function handleSubmit(values: {
    label: string;
    emoji?: string;
    imagePath?: string;
    promptHint: string;
    imageHint: string;
  }) {
    if (editing === "new") {
      await createHeroFn({ data: values });
    } else if (editing) {
      await updateHeroFn({ data: { id: editing.id, ...values } });
    }
    setEditing(null);
    await refresh();
  }

  return (
    <>
      <div className="space-y-2">
        <h1 className="font-bold text-3xl">{m.parents.entites.heroes.titre}</h1>
        <p className="text-muted-foreground">
          {m.parents.entites.heroes.intro}
        </p>
      </div>

      {editing ? (
        <HeroForm
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
          {m.parents.entites.heroes.ajouter}
        </Button>
      )}

      <ul className="space-y-3">
        {heroes.map((hero) => (
          <li
            className="flex items-start gap-4 rounded-2xl border bg-card p-4"
            key={hero.id}
          >
            <span aria-hidden="true" className="text-3xl leading-none">
              {hero.emoji || "🧒"}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-lg">{hero.label}</p>
              <p className="truncate text-muted-foreground text-sm">
                {hero.promptHint}
              </p>
            </div>
            <div className="flex shrink-0 gap-1">
              <Button
                aria-label={formatMessage(m.parents.entites.ariaModifier, {
                  label: hero.label,
                })}
                onClick={() => setEditing(hero)}
                size="icon"
                type="button"
                variant="ghost"
              >
                <Pencil className="size-4" />
              </Button>
              <Button
                aria-label={formatMessage(m.parents.entites.ariaRetirer, {
                  label: hero.label,
                })}
                onClick={() => handleDelete(hero.id)}
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
    </>
  );
}
