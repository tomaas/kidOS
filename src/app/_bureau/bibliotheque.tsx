import { createFileRoute, Link } from "@tanstack/react-router";
import { Home, Leaf } from "lucide-react";
import { Button } from "~/components/ui/button";
import {
  GENERATED_IMAGE_HEIGHT,
  GENERATED_IMAGE_WIDTH,
} from "~/lib/generated-image";
import { useMessages } from "~/lib/i18n";
import { getLibraryFn } from "~/server/functions";
import { isRenderableImagePath } from "~/server/providers/types";

export const Route = createFileRoute("/_bureau/bibliotheque")({
  component: LibraryPage,
  loader: () => getLibraryFn(),
});

/**
 * The library: the collection that grows. A gallery of kept stories (thumb +
 * title) that reopen on click. We visually celebrate accumulation — no number,
 * no counter, no performance metric.
 */
function LibraryPage() {
  const m = useMessages();
  const stories = Route.useLoaderData();

  return (
    // Cap the gallery width inside the wider shell so the cards stay a calm,
    // comfortable size rather than stretching across the whole page.
    <div className="mx-auto w-full max-w-4xl space-y-8">
      <div className="no-print">
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

      <h1 className="text-center font-bold text-4xl">{m.bibliotheque.titre}</h1>

      {stories.length === 0 ? (
        <div className="flex flex-col items-center gap-8 py-12 text-center">
          <p aria-hidden="true" className="text-6xl">
            📖
          </p>
          <p className="text-2xl text-muted-foreground">
            {m.bibliotheque.vide}
          </p>
          <Button
            className="h-14 gap-3 rounded-2xl px-6 text-xl"
            nativeButton={false}
            render={<Link to="/aventure" />}
            size="lg"
          >
            <Leaf className="size-6" />
            {m.bibliotheque.histoireOuTuChoisis}
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {stories.map((story) => (
            <Link
              className="flex items-center gap-5 rounded-3xl border-2 border-border bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-primary/50"
              key={story.id}
              params={{ id: story.id }}
              // The library only lists dynamic stories now — replay their path.
              to="/aventure/$id"
            >
              <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-accent/40">
                {isRenderableImagePath(story.imagePath) ? (
                  <img
                    alt=""
                    className="size-full object-cover"
                    height={GENERATED_IMAGE_HEIGHT}
                    src={story.imagePath}
                    width={GENERATED_IMAGE_WIDTH}
                  />
                ) : (
                  <span aria-hidden="true" className="text-4xl opacity-60">
                    🌼
                  </span>
                )}
              </div>
              <span className="font-semibold text-2xl leading-tight">
                {story.title}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
