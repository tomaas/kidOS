import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { Home } from "lucide-react";
import { DynamicStoryPlayer } from "~/components/dynamic-story-player";
import { Button } from "~/components/ui/button";
import { getDynamicStoryFn } from "~/server/dynamic-functions";
import { getFlagsFn } from "~/server/functions";

export const Route = createFileRoute("/_bureau/aventure/$id")({
  component: AventureStoryPage,
  loader: async ({ params }) => {
    const [data, flags] = await Promise.all([
      getDynamicStoryFn({ data: params.id }),
      getFlagsFn(),
    ]);
    if (!data) {
      throw notFound();
    }
    return { ...data, flags };
  },
});

function AventureStoryPage() {
  const { story, segments, flags } = Route.useLoaderData();

  // Only COMPLETE beats are part of the fixed, replayable path. A trailing
  // `generating`/`error` placeholder (which also has null choices) is an
  // interrupted beat, not a finished story — the player resumes it.
  const completeSegments = segments.filter((s) => s.status === "complete");
  const last = completeSegments.at(-1);
  // Finished path → read-only replay only when the last COMPLETE beat is the
  // final one (no choices). A mid-play story (last complete beat still offers
  // choices, or a pending placeholder trails) stays live.
  const hasPending = segments.some((s) => s.status !== "complete");
  const readOnly = !hasPending && last !== undefined && last.choices === null;

  return (
    <div className="space-y-8">
      <div className="no-print">
        <Button
          className="gap-2 text-lg text-muted-foreground"
          nativeButton={false}
          render={<Link to="/" />}
          variant="ghost"
        >
          <Home className="size-5" />
          Accueil
        </Button>
      </div>

      <DynamicStoryPlayer
        imageEnabled={flags.imageEnabled}
        imageModel={flags.imageModel}
        initialSegments={segments}
        readOnly={readOnly}
        storyId={story.id}
        storyLang={story.lang}
        title={story.title}
      />
    </div>
  );
}
