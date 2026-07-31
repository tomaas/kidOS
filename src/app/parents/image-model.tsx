import { createFileRoute } from "@tanstack/react-router";
import { Check } from "lucide-react";
import { IMAGE_MODELS } from "~/config/image-models";
import { useMessages } from "~/lib/i18n";
import { useImageModel } from "~/lib/use-image-model";
import { getFlagsFn } from "~/server/functions";
import { ImageTestPlayground } from "./components/-image-test-playground";

export const Route = createFileRoute("/parents/image-model")({
  component: ParentsImageModelPage,
  // Only the env default model (a public flag) is needed — the choice itself
  // lives in localStorage, there is no DB-backed state here.
  loader: () => getFlagsFn(),
});

/**
 * Parent-only page (URL-only, NOT linked from the child flow) to pick which
 * Google image model draws the illustrations, to compare quality / price /
 * speed live. Pure localStorage radio-card list over `IMAGE_MODELS` — no DB,
 * no migration. The selected card is marked; the env-default one gets a small
 * "par défaut" badge.
 *
 * Calm-tool note: this is a PARENT control. The child flow is unchanged, and an
 * unknown/stale stored id can never reach the child — the server re-validates
 * the model against the allowlist (loud fallback log) before any generation.
 */
function ParentsImageModelPage() {
  const m = useMessages();
  const flags = Route.useLoaderData();
  const { model, setModel } = useImageModel(flags.imageModel);

  return (
    <>
      <div className="space-y-2">
        <h1 className="font-bold text-3xl">{m.parents.imageModel.titre}</h1>
        <p className="text-muted-foreground">{m.parents.imageModel.intro}</p>
      </div>

      <ul className="space-y-3">
        {IMAGE_MODELS.map((option) => {
          const selected = option.id === model;
          const isDefault = option.id === flags.imageModel;
          return (
            <li key={option.id}>
              <button
                aria-pressed={selected}
                className={`flex w-full items-start gap-4 rounded-2xl border bg-card p-5 text-left transition-all hover:-translate-y-0.5 hover:border-primary/50 ${
                  selected ? "border-primary ring-2 ring-primary/40" : ""
                }`}
                onClick={() => setModel(option.id)}
                type="button"
              >
                <span
                  aria-hidden="true"
                  className={`mt-1 flex size-6 shrink-0 items-center justify-center rounded-full border-2 ${
                    selected
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-muted-foreground/40"
                  }`}
                >
                  {selected ? <Check className="size-4" /> : null}
                </span>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-lg">{option.label}</p>
                    {isDefault ? (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground text-xs">
                        {m.parents.imageModel.parDefaut}
                      </span>
                    ) : null}
                  </div>
                  {/* The exact Google model id, so the parent knows precisely
                      which model each option is. */}
                  <p className="font-mono text-muted-foreground text-xs">
                    {option.id}
                  </p>
                  <p className="text-muted-foreground text-sm">{option.note}</p>
                </div>
              </button>
            </li>
          );
        })}
      </ul>

      <ImageTestPlayground initialModel={model} />
    </>
  );
}
