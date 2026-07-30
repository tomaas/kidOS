import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { Home, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { ElementForm } from "~/components/element-form";
import { Button } from "~/components/ui/button";
import { formatMessage, useMessages } from "~/lib/i18n";
import type { DbElement } from "~/server/db/schema";
import {
  createElementFn,
  deleteElementFn,
  listElementsFn,
  updateElementFn,
} from "~/server/elements-functions";

export const Route = createFileRoute("/parents/elements")({
  component: ParentsElementsPage,
  loader: () => listElementsFn(),
});

/**
 * Parent-only page (URL-only, NOT linked from the child flow) to manage the
 * surprise elements offered in the "et avec quoi ?" picker. Add / edit /
 * soft-delete. Mirrors /parents/lieux exactly (no image-hint field).
 *
 * History safety: editing or deleting an element NEVER changes an
 * already-created story (each story froze its element label + hint at creation).
 */
function ParentsElementsPage() {
  const m = useMessages();
  const router = useRouter();
  const elements = Route.useLoaderData();
  // null = no form open; "new" = add form; an element = editing it.
  const [editing, setEditing] = useState<DbElement | "new" | null>(null);

  async function refresh() {
    await router.invalidate();
  }

  async function handleDelete(id: string) {
    if (
      // biome-ignore lint/suspicious/noAlert: confirm() volontairement minimal — garde anti-tap accidentel, pas d'UI modale à maintenir.
      !window.confirm(m.parents.entites.elements.confirmRetrait)
    ) {
      return;
    }
    await deleteElementFn({ data: { id } });
    await refresh();
  }

  async function handleSubmit(values: {
    label: string;
    emoji?: string;
    imagePath?: string;
    promptHint: string;
  }) {
    if (editing === "new") {
      await createElementFn({ data: values });
    } else if (editing) {
      await updateElementFn({ data: { id: editing.id, ...values } });
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
        <h1 className="font-bold text-3xl">
          {m.parents.entites.elements.titre}
        </h1>
        <p className="text-muted-foreground">
          {m.parents.entites.elements.intro}
        </p>
      </div>

      {editing ? (
        <ElementForm
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
          {m.parents.entites.elements.ajouter}
        </Button>
      )}

      <ul className="space-y-3">
        {elements.map((element) => (
          <li
            className="flex items-start gap-4 rounded-2xl border bg-card p-4"
            key={element.id}
          >
            <span aria-hidden="true" className="text-3xl leading-none">
              {element.emoji || "✨"}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-lg">{element.label}</p>
              <p className="truncate text-muted-foreground text-sm">
                {element.promptHint}
              </p>
            </div>
            <div className="flex shrink-0 gap-1">
              <Button
                aria-label={formatMessage(m.parents.entites.ariaModifier, {
                  label: element.label,
                })}
                onClick={() => setEditing(element)}
                size="icon"
                type="button"
                variant="ghost"
              >
                <Pencil className="size-4" />
              </Button>
              <Button
                aria-label={formatMessage(m.parents.entites.ariaRetirer, {
                  label: element.label,
                })}
                onClick={() => handleDelete(element.id)}
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
