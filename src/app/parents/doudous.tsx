import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { Home, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { DoudouForm } from "~/components/doudou-form";
import { Button } from "~/components/ui/button";
import { formatMessage, useMessages } from "~/lib/i18n";
import type { DbDoudou } from "~/server/db/schema";
import {
  createDoudouFn,
  deleteDoudouFn,
  listDoudousFn,
  updateDoudouFn,
} from "~/server/doudous-functions";

export const Route = createFileRoute("/parents/doudous")({
  component: ParentsDoudousPage,
  loader: () => listDoudousFn(),
});

/**
 * Parent-only page (URL-only, NOT linked from the child flow) to manage the
 * doudous offered in the optional "avec quel doudou ?" picker. Add / edit /
 * soft-delete. Mirrors /parents/lieux exactly, plus the extra image-hint field.
 *
 * History safety: editing or deleting a doudou NEVER changes an already-created
 * story (each story froze its doudou label + hints at creation).
 */
function ParentsDoudousPage() {
  const m = useMessages();
  const router = useRouter();
  const doudous = Route.useLoaderData();
  // null = no form open; "new" = add form; a doudou = editing it.
  const [editing, setEditing] = useState<DbDoudou | "new" | null>(null);

  async function refresh() {
    await router.invalidate();
  }

  async function handleDelete(id: string) {
    if (
      // biome-ignore lint/suspicious/noAlert: confirm() volontairement minimal — garde anti-tap accidentel, pas d'UI modale à maintenir.
      !window.confirm(m.parents.entites.doudous.confirmRetrait)
    ) {
      return;
    }
    await deleteDoudouFn({ data: { id } });
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
      await createDoudouFn({ data: values });
    } else if (editing) {
      await updateDoudouFn({ data: { id: editing.id, ...values } });
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
          {m.parents.entites.doudous.titre}
        </h1>
        <p className="text-muted-foreground">
          {m.parents.entites.doudous.intro}
        </p>
      </div>

      {editing ? (
        <DoudouForm
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
          {m.parents.entites.doudous.ajouter}
        </Button>
      )}

      <ul className="space-y-3">
        {doudous.map((doudou) => (
          <li
            className="flex items-start gap-4 rounded-2xl border bg-card p-4"
            key={doudou.id}
          >
            <span aria-hidden="true" className="text-3xl leading-none">
              {doudou.emoji || "🧸"}
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-lg">{doudou.label}</p>
              <p className="truncate text-muted-foreground text-sm">
                {doudou.promptHint}
              </p>
            </div>
            <div className="flex shrink-0 gap-1">
              <Button
                aria-label={formatMessage(m.parents.entites.ariaModifier, {
                  label: doudou.label,
                })}
                onClick={() => setEditing(doudou)}
                size="icon"
                type="button"
                variant="ghost"
              >
                <Pencil className="size-4" />
              </Button>
              <Button
                aria-label={formatMessage(m.parents.entites.ariaRetirer, {
                  label: doudou.label,
                })}
                onClick={() => handleDelete(doudou.id)}
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
