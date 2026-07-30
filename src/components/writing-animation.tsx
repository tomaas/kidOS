import { useMessages } from "~/lib/i18n";

/**
 * Calm, reassuring waiting state. A gently floating feather and three
 * breathing dots — NO progress bar, NO percentage, NO countdown.
 *
 * `message` lets a caller soften the wording for a different phase (e.g. while
 * the illustration is being drawn) while keeping the identical calm visual.
 */
export function WritingAnimation({ message }: { message?: string }) {
  const m = useMessages();
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-8 text-center">
      <span
        aria-hidden="true"
        className="text-7xl"
        style={{ animation: "story-float 3.5s ease-in-out infinite" }}
      >
        🪶
      </span>

      <p className="font-semibold text-3xl">
        {message ?? m.aventure.histoireSecrit}
      </p>

      <div aria-hidden="true" className="flex gap-3">
        {[0, 1, 2].map((i) => (
          <span
            className="size-4 rounded-full bg-primary"
            key={i}
            style={{
              animation: "story-breathe 1.8s ease-in-out infinite",
              animationDelay: `${i * 0.3}s`,
            }}
          />
        ))}
      </div>
    </div>
  );
}
