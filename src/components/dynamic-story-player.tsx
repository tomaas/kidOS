import { Link } from "@tanstack/react-router";
import { Printer, Sparkles } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Button } from "~/components/ui/button";
import { useMessages } from "~/lib/i18n";
import { useImageModel } from "~/lib/use-image-model";
import { useImageReveal } from "~/lib/use-image-reveal";
import { type ReadingAidsFlags, useReadingAids } from "~/lib/use-reading-aids";
import { useReadingFont } from "~/lib/use-reading-font";
import type { SegmentChoice, StorySegment } from "~/server/db/schema";
import {
  continueDynamicStoryFn,
  generateSegmentImageFn,
  retrySegmentImageFn,
} from "~/server/dynamic-functions";
import {
  type ImageStatus,
  resolveStoredImagePath,
} from "~/server/providers/types";
import { HighlightableText } from "./highlightable-text";
import { ImageSlot } from "./image-slot";
import { PrintableDynamicStory } from "./printable-story";
import { ReadingAidsToggles } from "./reading-aids-toggles";
import { ReadingFontToggle } from "./reading-font-toggle";
import { WritingAnimation } from "./writing-animation";

interface DynamicStoryPlayerProps {
  imageEnabled: boolean;
  /** Env default image model (public flag) — seeds the parent-picker hook. */
  imageModel: string;
  /** All segments known so far, in order (idx ascending). */
  initialSegments: StorySegment[];
  /**
   * Read-only replay (from the library): the path is fixed, never offer
   * choices, just show every beat in order.
   */
  readOnly?: boolean;
  storyId: string;
  /**
   * La langue de l'HISTOIRE (stories.lang, figée à la création) — les aides
   * de lecture (lettres muettes, liaisons) sont de la phonétique FRANÇAISE :
   * elles n'existent que pour une histoire "fr" (annotation ET toggles).
   * La police cursive reste disponible dans les deux langues.
   */
  storyLang: string;
  title: string;
}

/** Two large, equal-weight choice buttons. Neither is styled as "correct". */
function ChoiceButtons({
  choices,
  disabled,
  onChoose,
}: {
  choices: SegmentChoice[];
  disabled: boolean;
  onChoose: (choiceId: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-5 pt-2 sm:grid-cols-2">
      {choices.map((choice) => (
        <button
          className="flex min-h-28 items-center justify-center rounded-3xl border-2 border-border bg-card p-6 text-center font-semibold text-2xl leading-snug transition-all hover:-translate-y-0.5 hover:border-primary/50 disabled:opacity-60"
          disabled={disabled}
          key={choice.id}
          onClick={() => onChoose(choice.id)}
          type="button"
        >
          {choice.label}
        </button>
      ))}
    </div>
  );
}

/**
 * Presentational illustration slot for a beat. Shows the image when ready, the
 * faint feather motif when images are off/skipped (calm, on-brand, never reads
 * as an error), or the settled "no drawing today" state on a real failure. The
 * shared `ImageSlot` owns the three states + the `data-image-status` hook.
 */
function SegmentImageView({
  imagePath,
  imageStatus,
  onRetry,
}: {
  imagePath: string | null;
  imageStatus: ImageStatus;
  /** When given, the failed-state placeholder offers a calm "Réessayer" button
   * that re-generates this one beat's image (see `ImageSlot`). */
  onRetry?: () => Promise<void>;
}) {
  return (
    <ImageSlot
      imagePath={imagePath}
      imageStatus={imageStatus}
      onRetry={onRetry}
      placeholderEmoji="🪶"
      placeholderOpacityClass="opacity-30"
    />
  );
}

/**
 * REPLAY image slot (read-only library): the path is usually already stored, so
 * it shows at once. For an old/missing image it fetches in the background and
 * swaps in — a replay is a calm scroll-through, never gated on regeneration.
 */
function ReplaySegmentImage({
  storyId,
  segment,
  imageEnabled,
  imageModel,
}: {
  storyId: string;
  segment: StorySegment;
  imageEnabled: boolean;
  imageModel: string;
}) {
  // Translate the stored value: a real path → ready, the failure sentinel →
  // a settled "failed" state, null → skipped. Never re-fetch a settled beat.
  const stored = resolveStoredImagePath(segment.imagePath);
  const [imagePath, setImagePath] = useState<string | null>(stored.imagePath);
  const [imageStatus, setImageStatus] = useState<ImageStatus>(
    stored.imageStatus
  );

  useEffect(() => {
    const settled = resolveStoredImagePath(segment.imagePath);
    setImagePath(settled.imagePath);
    setImageStatus(settled.imageStatus);
    // Only fetch when nothing is stored yet (skipped). A real path OR the
    // failure sentinel is terminal — never re-attempt on replay.
    if (!imageEnabled || settled.imageStatus !== "skipped") {
      return;
    }
    let cancelled = false;
    generateSegmentImageFn({
      data: { idx: segment.idx, imageModel, storyId },
    }).then((result) => {
      if (cancelled) {
        return;
      }
      setImageStatus(result.imageStatus);
      if (result.imagePath) {
        setImagePath(result.imagePath);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [imageEnabled, storyId, segment.idx, segment.imagePath, imageModel]);

  // Explicit retry of a settled failure (replay view): re-attempt the one image
  // and swap it in on success. Stays calm on failure — the server re-persists
  // the sentinel and we keep the "no drawing" state. Only offered when images
  // are on and this beat actually failed.
  const handleRetry =
    imageEnabled && imageStatus === "failed"
      ? async () => {
          const result = await retrySegmentImageFn({
            data: { idx: segment.idx, imageModel, storyId },
          });
          setImageStatus(result.imageStatus);
          if (result.imagePath) {
            setImagePath(result.imagePath);
          }
        }
      : undefined;

  return (
    <SegmentImageView
      imagePath={imagePath}
      imageStatus={imageStatus}
      onRetry={handleRetry}
    />
  );
}

/**
 * Big readable beat text (≥22px). Cursive mode bumps size + line-height (cursive
 * is taller / harder to decode) so it stays comfortable for a 6–7yo.
 */
function SegmentText({
  segment,
  isCursive,
  aids,
}: {
  segment: StorySegment;
  isCursive: boolean;
  aids: ReadingAidsFlags;
}) {
  return (
    <div
      className={
        isCursive
          ? "space-y-6 text-3xl leading-loose"
          : "space-y-5 text-3xl leading-relaxed"
      }
      style={isCursive ? { fontFamily: "var(--font-cursive)" } : undefined}
    >
      {segment.paragraphs.map((paragraph, i) => (
        <p key={`${segment.id}-${i}`}>
          <HighlightableText
            showLiaisons={aids.showLiaisons}
            showSilent={aids.showSilent}
            text={paragraph}
          />
        </p>
      ))}
    </div>
  );
}

/** One beat as two columns: image left / big text right (single col on mobile). */
function BeatColumns({
  image,
  segment,
  isCursive,
  aids,
}: {
  image: React.ReactNode;
  segment: StorySegment;
  isCursive: boolean;
  aids: ReadingAidsFlags;
}) {
  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:items-start">
      {image}
      <SegmentText aids={aids} isCursive={isCursive} segment={segment} />
    </div>
  );
}

/** Read-only replay beat: image fetches in the background, text shows at once. */
function ReplayBeat({
  storyId,
  segment,
  imageEnabled,
  imageModel,
  isCursive,
  aids,
}: {
  storyId: string;
  segment: StorySegment;
  imageEnabled: boolean;
  imageModel: string;
  isCursive: boolean;
  aids: ReadingAidsFlags;
}) {
  return (
    <BeatColumns
      aids={aids}
      image={
        <ReplaySegmentImage
          imageEnabled={imageEnabled}
          imageModel={imageModel}
          segment={segment}
          storyId={storyId}
        />
      }
      isCursive={isCursive}
      segment={segment}
    />
  );
}

/**
 * LIVE-PLAY beat: waits for THIS beat's illustration, then reveals its text +
 * image together (one clean reveal, no pop-in). The child sees the calm waiting
 * state until the image resolves, fails, times out (~15s), or images are off —
 * `useImageReveal` guarantees they never hang. The parent shows the choices
 * only after this resolves, so text + choices appear with the picture.
 */
function LiveBeat({
  storyId,
  segment,
  imageEnabled,
  imageModel,
  isCursive,
  aids,
  onRevealed,
}: {
  storyId: string;
  segment: StorySegment;
  imageEnabled: boolean;
  imageModel: string;
  isCursive: boolean;
  aids: ReadingAidsFlags;
  onRevealed: (revealed: boolean) => void;
}) {
  const m = useMessages();
  const {
    revealed,
    imagePath: revealedPath,
    imageStatus: revealedStatus,
  } = useImageReveal({
    fetchImage: () =>
      generateSegmentImageFn({
        data: { idx: segment.idx, imageModel, storyId },
      }),
    imageEnabled,
    initialPath: segment.imagePath ?? null,
    resetKey: segment.id,
  });

  // A successful retry's result supersedes the reveal hook's output (the hook
  // owns the initial reveal; we don't reach into it). Reset per beat so a new
  // beat starts from the hook again.
  const [retried, setRetried] = useState<{
    imagePath: string | null;
    imageStatus: ImageStatus;
  } | null>(null);
  useEffect(() => {
    setRetried(null);
  }, [segment.id]);

  const imagePath = retried?.imagePath ?? revealedPath;
  const imageStatus = retried?.imageStatus ?? revealedStatus;

  // Lift the reveal state so the parent can hold the choices until the picture
  // is ready (text + image + choices reveal together).
  useEffect(() => {
    onRevealed(revealed);
  }, [revealed, onRevealed]);

  // Explicit retry of a settled failure (live play): re-attempt the one image
  // and swap it in on success; stay calm on a repeat failure. Only when images
  // are on and this beat actually failed.
  const handleRetry =
    imageEnabled && imageStatus === "failed"
      ? async () => {
          const result = await retrySegmentImageFn({
            data: { idx: segment.idx, imageModel, storyId },
          });
          setRetried({
            imagePath: result.imagePath,
            imageStatus: result.imageStatus,
          });
        }
      : undefined;

  if (!revealed) {
    return <WritingAnimation message={m.aventure.histoireSeDessine} />;
  }

  return (
    <BeatColumns
      aids={aids}
      image={
        <SegmentImageView
          imagePath={imagePath}
          imageStatus={imageStatus}
          onRetry={handleRetry}
        />
      }
      isCursive={isCursive}
      segment={segment}
    />
  );
}

/**
 * The dynamic story screen + state machine.
 *
 * Live play: shows the current beat (image + big text) and its two equal-weight
 * choices. A tap shows the calm writing animation, calls `continueDynamicStory`
 * and appends the next beat — repeating until a final beat (choices === null),
 * which shows the closing actions. No counter, no progress bar, no timer, no
 * "correct" choice. Double-tap safe: buttons disable while a beat is in flight,
 * and the backend is idempotent.
 *
 * Read-only replay (library): renders every known beat in order, no choices.
 */
export function DynamicStoryPlayer({
  storyId,
  storyLang,
  title,
  initialSegments,
  imageEnabled,
  imageModel: envImageModel,
  readOnly = false,
}: DynamicStoryPlayerProps) {
  const m = useMessages();
  const [segments, setSegments] = useState<StorySegment[]>(initialSegments);
  const [pending, setPending] = useState(false);
  const [failed, setFailed] = useState(false);
  // The parent-picked image model (localStorage, default = env model). Threaded
  // into each beat's image fetch; the server re-validates against the allowlist.
  const { model: imageModel } = useImageModel(envImageModel);
  // Optional cursive reading mode (off by default, persisted per-device).
  const { isCursive, toggle: toggleFont } = useReadingFont();
  // CP-book reading aids (lettres muettes, liaisons) — on by default,
  // independently toggleable, persisted per-device.
  const { showSilent, showLiaisons, toggleSilent, toggleLiaisons } =
    useReadingAids();
  // Gating par langue d'histoire (plan multilangue, D6) : la phonétique
  // française ne s'applique jamais à un texte anglais — aides forcées OFF et
  // toggles absents (le réglage par appareil reste intact pour les
  // histoires françaises).
  const aidesFr = storyLang === "fr";
  const aids: ReadingAidsFlags = aidesFr
    ? { showLiaisons, showSilent }
    : { showLiaisons: false, showSilent: false };
  // Whether the current live beat's image reveal has resolved — choices + the
  // closing actions appear only then, so text + image + choices reveal together.
  const [beatRevealed, setBeatRevealed] = useState(false);
  // The choice the child last picked, so a soft retry re-sends the SAME one.
  const lastChoiceRef = useRef<string | null>(null);

  // Only COMPLETE beats are shown / replayed. A trailing `generating`/`error`
  // placeholder is an interrupted beat the backend reserved — never render it.
  const completeSegments = segments.filter((s) => s.status === "complete");
  // A pending placeholder (status not complete) carries the choice that should
  // resume it — used to recover an interrupted beat without re-asking.
  const pendingSeg = segments.find((s) => s.status !== "complete");

  const current = completeSegments.at(-1);
  // In live play, the last complete beat with non-null choices awaits a choice.
  const awaitingChoice =
    !readOnly && current !== undefined && current.choices !== null;
  const isFinal =
    !pendingSeg && current !== undefined && current.choices === null;

  // Resume an interrupted beat on mount (reopened a half-finished story): the
  // backend left a placeholder with the pending choice — re-send it. Idempotent,
  // so this never duplicates or re-asks. The calm waiting state shows meanwhile.
  useEffect(() => {
    if (readOnly || pending || failed) {
      return;
    }
    const resumeChoice = pendingSeg?.pendingChoiceId;
    if (resumeChoice) {
      choose(resumeChoice);
    }
  }, []);

  async function choose(choiceId: string) {
    if (pending) {
      return; // debounce double-tap
    }
    lastChoiceRef.current = choiceId;
    setPending(true);
    setFailed(false);
    try {
      const result = await continueDynamicStoryFn({
        data: { choiceId, storyId },
      });
      if (result.success) {
        // Prior segments are never lost; append (or replace if it re-returns).
        setSegments((prev) => {
          const without = prev.filter((s) => s.idx !== result.segment.idx);
          return [...without, result.segment].sort((a, b) => a.idx - b.idx);
        });
        setPending(false);
        return;
      }
    } catch (err) {
      console.error(
        "[stories] beat continuation failed, will soft-retry:",
        err
      );
      // Fall through to the soft retry below.
    }
    // The APP retries — never imply the child chose wrong.
    setPending(false);
    setFailed(true);
  }

  function retry() {
    const choiceId = lastChoiceRef.current;
    if (choiceId) {
      choose(choiceId);
    }
  }

  // While a beat generates, the calm waiting state (no progress bar).
  if (pending) {
    return <WritingAnimation />;
  }

  if (failed) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-8 text-center">
        <p aria-hidden="true" className="text-6xl">
          🌧️
        </p>
        <p className="font-semibold text-3xl">{m.aventure.histoireReprend}</p>
        <Button
          className="h-14 rounded-2xl px-8 text-xl"
          onClick={retry}
          size="lg"
          type="button"
        >
          {m.aventure.continuer}
        </Button>
      </div>
    );
  }

  // Read-only replay: render the full fixed path, beat after beat.
  if (readOnly) {
    return (
      <div className="space-y-8">
        <div className="no-print space-y-12">
          <h1 className="text-center font-bold text-4xl leading-tight">
            {title}
          </h1>
          {completeSegments.map((segment) => (
            <ReplayBeat
              aids={aids}
              imageEnabled={imageEnabled}
              imageModel={imageModel}
              isCursive={isCursive}
              key={segment.id}
              segment={segment}
              storyId={storyId}
            />
          ))}
          <ClosingActions
            aidesVisibles={aidesFr}
            aids={aids}
            isCursive={isCursive}
            onToggleFont={toggleFont}
            onToggleLiaisons={toggleLiaisons}
            onToggleSilent={toggleSilent}
          />
        </div>
        <PrintableDynamicStory
          aids={aids}
          lang={storyLang}
          segments={completeSegments}
          title={title}
        />
      </div>
    );
  }

  // Live play: only the current beat is interactive on screen. `LiveBeat` holds
  // the calm waiting state until the beat's image is ready, then reveals text +
  // image together; the choices / closing actions wait on `beatRevealed` so the
  // whole beat appears at once (never text-first with a late image pop-in).
  return (
    <div className="space-y-8">
      <div className="no-print space-y-8">
        {current ? (
          <LiveBeat
            aids={aids}
            imageEnabled={imageEnabled}
            imageModel={imageModel}
            isCursive={isCursive}
            key={current.id}
            onRevealed={setBeatRevealed}
            segment={current}
            storyId={storyId}
          />
        ) : null}

        {/* During live play (awaiting a choice) the closing actions aren't
            shown yet, so surface the reading toggles here so they're
            reachable while reading every beat, mirrored next to the choices. */}
        {beatRevealed && awaitingChoice && current?.choices ? (
          <>
            <ChoiceButtons
              choices={current.choices}
              disabled={pending}
              onChoose={choose}
            />
            <div className="flex flex-wrap justify-center gap-4 pt-2">
              {aidesFr ? (
                <ReadingAidsToggles
                  onToggleLiaisons={toggleLiaisons}
                  onToggleSilent={toggleSilent}
                  showLiaisons={showLiaisons}
                  showSilent={showSilent}
                />
              ) : null}
              <ReadingFontToggle isCursive={isCursive} onToggle={toggleFont} />
            </div>
          </>
        ) : null}

        {beatRevealed && isFinal ? (
          <ClosingActions
            aidesVisibles={aidesFr}
            aids={aids}
            isCursive={isCursive}
            onToggleFont={toggleFont}
            onToggleLiaisons={toggleLiaisons}
            onToggleSilent={toggleSilent}
          />
        ) : null}
      </div>

      {/* Hidden on screen; the print dialog renders the full chosen path. */}
      <PrintableDynamicStory
        aids={aids}
        lang={storyLang}
        segments={completeSegments}
        title={title}
      />
    </div>
  );
}

/** Gentle end actions: reading toggles, print the booklet, or start another. */
function ClosingActions({
  isCursive,
  onToggleFont,
  aids,
  aidesVisibles,
  onToggleSilent,
  onToggleLiaisons,
}: {
  isCursive: boolean;
  onToggleFont: () => void;
  aids: ReadingAidsFlags;
  /** false pour une histoire non française : la phonétique FR n'existe pas. */
  aidesVisibles: boolean;
  onToggleSilent: () => void;
  onToggleLiaisons: () => void;
}) {
  const m = useMessages();
  return (
    <div className="flex flex-wrap justify-center gap-4 pt-4">
      {aidesVisibles ? (
        <ReadingAidsToggles
          onToggleLiaisons={onToggleLiaisons}
          onToggleSilent={onToggleSilent}
          showLiaisons={aids.showLiaisons}
          showSilent={aids.showSilent}
        />
      ) : null}
      <ReadingFontToggle isCursive={isCursive} onToggle={onToggleFont} />

      <Button
        className="h-14 gap-3 rounded-2xl px-6 text-xl"
        onClick={() => window.print()}
        size="lg"
        type="button"
        variant="secondary"
      >
        <Printer className="size-6" />
        {m.aventure.imprimer}
      </Button>

      <Button
        className="h-14 gap-3 rounded-2xl px-6 text-xl"
        nativeButton={false}
        render={<Link to="/aventure" />}
        size="lg"
      >
        <Sparkles className="size-6" />
        {m.aventure.uneAutreHistoire}
      </Button>
    </div>
  );
}
