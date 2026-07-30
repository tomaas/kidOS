import { useState } from "react";
import { cn } from "~/lib/cn";
import {
  GENERATED_IMAGE_HEIGHT,
  GENERATED_IMAGE_WIDTH,
} from "~/lib/generated-image";
import { useMessages } from "~/lib/i18n";
import type { ImageStatus } from "~/server/providers/types";

interface ImageSlotProps {
  imagePath: string | null;
  imageStatus: ImageStatus;
  /**
   * Optional re-generation handler for the FAILED state only. When provided, the
   * "no drawing today" placeholder offers a calm "Réessayer" button that calls
   * this and re-attempts the one image. Omitted → no button (e.g. images off, or
   * a surface where retry doesn't apply). The slot owns its own gentle
   * loading/failure copy so callers stay simple.
   */
  onRetry?: () => Promise<void>;
  /** Emoji shown in the calm OFF/"skipped" placeholder — 🌼 (classic) or 🪶
   * (dynamic beat), so each surface keeps its existing motif. */
  placeholderEmoji: string;
  /** Opacity class for the placeholder emoji (the two surfaces differ slightly:
   * classic uses opacity-50, the dynamic beat opacity-30). */
  placeholderOpacityClass?: string;
  /** Classic story view keeps the picture sticky through a long read; the
   * dynamic beat does not. */
  sticky?: boolean;
}

/**
 * The illustration slot, shared by the classic story view + the dynamic beat
 * view. It renders ONE of three SETTLED states (never an indefinite spinner —
 * the reveal gate already handled waiting):
 *
 *  - "ready"   → the decoded illustration.
 *  - "skipped" → images are off / nothing to draw → the calm neutral field with
 *               the surface's soft motif (🌼 / 🪶). This is intended, not a
 *               failure — visually unchanged from before.
 *  - "failed"  → generation was attempted and errored (operator saw the server
 *               log). The child sees a gentle, SETTLED "no drawing this time"
 *               state — a sleeping moon + soft wording — so it reads as "we
 *               tried, no picture today" rather than perpetual loading. The
 *               story still reads fine. No technical error, no anxiety (calm-tool
 *               rule).
 *
 * `data-image-status` is set for discreet operator inspection (never visible).
 */
/** The settled "no drawing today" state — a sleeping moon + soft wording.
 * Distinct from the loading feather and the neutral OFF placeholder, so the
 * child reads "we tried, no picture this time", never perpetual loading.
 *
 * When `onRetry` is given, a calm "Réessayer" button re-attempts the one image.
 * The button owns a gentle local lifecycle — "On réessaie…" while in flight,
 * back to the calm placeholder on success (the parent swaps the real image in),
 * a soft "ça n'a pas marché, réessaie plus tard" on a repeat failure. No scary
 * error, no stakes (calm-tool rule); a retry failure can never crash the page. */
function FailedState({ onRetry }: { onRetry?: () => Promise<void> }) {
  const [retrying, setRetrying] = useState(false);
  const m = useMessages();
  const [retryFailed, setRetryFailed] = useState(false);

  async function handleRetry() {
    if (retrying) {
      return; // guard double-tap
    }
    setRetrying(true);
    setRetryFailed(false);
    try {
      await onRetry?.();
      // On success the parent reveals the new image and unmounts this state.
    } catch {
      // Defensive: a thrown retry must never crash the page — stay calm.
      setRetryFailed(true);
    } finally {
      setRetrying(false);
    }
  }

  return (
    <div className="flex size-full flex-col items-center justify-center gap-3 px-6 text-center">
      <span aria-hidden="true" className="text-6xl opacity-70">
        🌙
      </span>
      <p className="font-medium text-lg text-muted-foreground">
        {m.aventure.image.dodo}
      </p>
      {onRetry ? (
        <>
          <button
            className="mt-1 flex items-center gap-2 rounded-2xl border border-border bg-card/60 px-5 py-2 font-medium text-base text-muted-foreground transition-all hover:-translate-y-0.5 hover:border-primary/40 disabled:opacity-60"
            disabled={retrying}
            onClick={handleRetry}
            type="button"
          >
            <span aria-hidden="true">🔄</span>
            {retrying
              ? m.aventure.image.onReessaie
              : m.aventure.image.reessayer}
          </button>
          {retryFailed ? (
            <p className="text-muted-foreground/70 text-sm">
              {m.aventure.image.pasMarche}
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}

/** The calm OFF/"skipped" placeholder — the surface's soft motif (🌼 / 🪶). */
function PlaceholderState({
  emoji,
  opacityClass,
}: {
  emoji: string;
  opacityClass: string;
}) {
  return (
    <div className="flex size-full items-center justify-center">
      <span aria-hidden="true" className={`text-7xl ${opacityClass}`}>
        {emoji}
      </span>
    </div>
  );
}

export function ImageSlot({
  imagePath,
  imageStatus,
  placeholderEmoji,
  placeholderOpacityClass = "opacity-50",
  sticky = false,
  onRetry,
}: ImageSlotProps) {
  function inner() {
    if (imagePath) {
      return (
        <img
          alt=""
          className="size-full object-cover"
          height={GENERATED_IMAGE_HEIGHT}
          src={imagePath}
          width={GENERATED_IMAGE_WIDTH}
        />
      );
    }
    if (imageStatus === "failed") {
      return <FailedState onRetry={onRetry} />;
    }
    return (
      <PlaceholderState
        emoji={placeholderEmoji}
        opacityClass={placeholderOpacityClass}
      />
    );
  }

  return (
    <div
      className={cn(
        "aspect-[4/3] w-full overflow-hidden rounded-3xl bg-accent/40",
        sticky && "lg:sticky lg:top-10"
      )}
      data-image-status={imageStatus}
    >
      {inner()}
    </div>
  );
}
