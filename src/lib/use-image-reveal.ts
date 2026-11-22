import { useEffect, useRef, useState } from "react";

import { resolveStoredImagePath } from "~/server/providers/types";
import type { ImageResult, ImageStatus } from "~/server/providers/types";

/**
 * Wait for a beat/story's illustration before revealing its text + image
 * TOGETHER (one clean simultaneous reveal, no text-then-image-pop-in layout
 * shift). The child NEVER hangs on the waiting screen — the safeguards:
 *
 *  - images OFF (`imageEnabled=false`) → no wait, reveal immediately with the
 *    neutral soft field;
 *  - generation FAILS (or returns no path) → reveal text with the neutral
 *    field (never wait forever);
 *  - the image is "ready" only when it is BROWSER-DECODED, not merely when the
 *    server returns a path: we preload it (`new Image()` + `decode()`/`onload`)
 *    and reveal on a successful decode so the <img> can't pop in after the text;
 *    a decode error reveals text + neutral field;
 *  - MAX-WAIT TIMEOUT (`timeoutMs`, ~45s) races all of the above → if nothing
 *    settled by then, reveal text + neutral field anyway; a late image may still
 *    swap in (decoded) if it arrives afterwards.
 *
 * This is a DISPLAY/LOADER-layer gate only: it calls the existing background
 * `fetchImage` (generateSegmentImageFn) — the server generation contract is
 * unchanged.
 */
export interface ImageRevealState {
  /** The resolved image path, or null (disabled / failed / not-yet-arrived). */
  imagePath: string | null;
  /**
   * What kind of "no image / image" state we're in, so the UI distinguishes a
   * calm OFF placeholder from a settled FAILED state (and from a ready image):
   *  - "ready"   → `imagePath` is set;
   *  - "failed"  → generation errored (server logged it) → show "no drawing";
   *  - "skipped" → images off / nothing to draw → the intended calm placeholder.
   * A TIMEOUT (revealed by the max-wait before the fetch settles) reads as
   * "skipped": it's not a known failure, just "no picture yet" — calm, and a
   * late image may still swap in.
   */
  imageStatus: ImageStatus;
  /** True once text + image may be shown together (resolved/failed/timed-out). */
  revealed: boolean;
}

interface UseImageRevealArgs {
  /** Fetches/generates the image in the background; resolves the discriminated
   * {imagePath, imageStatus}. */
  fetchImage: () => Promise<ImageResult>;
  imageEnabled: boolean;
  /** An already-known image path (e.g. a library replay) — reveal at once. */
  initialPath: string | null;
  /**
   * Re-run when this changes (a new beat). Keep it stable for one beat — pass
   * the beat's idx / story id so a new beat re-arms the gate.
   */
  resetKey: string | number;
  /** Max time to wait before revealing text with the neutral field (~45s). */
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 45_000;

/**
 * Module-level map of reveal key → the in-flight background fetch PROMISE, keyed
 * by `resetKey`. Each fetch is a real billed image generation, so a second
 * effect run for the SAME key (a dev double-invoke / mount→unmount→remount, an
 * HMR remount, or any re-render that re-arms the gate) must NOT start a second
 * one — instead it ATTACHES to the existing promise.
 *
 * Sharing the promise (not just suppressing the duplicate) is what makes the
 * late-swap survive StrictMode: under mount→unmount→remount, effect#1 owns the
 * fetch, React's cleanup#1 marks effect#1 `unmounted`, then effect#2 (the LIVE
 * mount) reuses this same promise and its OWN handler — closing over effect#2's
 * live `unmounted`/`fetchStartedAt` — delivers the image when it resolves (~60s).
 * Without the shared promise, only effect#1's (dead) handler would see the
 * result and discard it, and the live mount would never get the image.
 *
 * It deliberately lives OUTSIDE the component and is NOT cleared by an effect
 * cleanup: a dev double-mount's cleanup runs BEFORE the second mount's effect,
 * so an effect-scoped ref would be cleared in between. The entry is deleted by
 * the OWNER exactly once, after the fetch settles, so a genuinely-new key still
 * fetches and a real retry can re-fetch after the prior attempt finishes.
 */
const inFlightFetches = new Map<string, Promise<ImageResult>>();

/**
 * Resolve once the image at `src` is BROWSER-DECODED and paintable (so the
 * <img> won't pop in after the text), or reject if it can't load/decode.
 * `decode()` is the precise signal; fall back to onload/onerror where it is
 * unavailable. SSR-safe (no window → resolve immediately, the real gate runs
 * client-side).
 */
function preloadImage(src: string): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.resolve();
  }
  const img = new Image();
  img.src = src;
  if (typeof img.decode === "function") {
    return img.decode();
  }
  return new Promise<void>((resolve, reject) => {
    img.onload = () => {
      resolve();
    };
    img.onerror = () => {
      reject(new Error("image load failed"));
    };
  });
}

export function useImageReveal({
  imageEnabled,
  initialPath,
  fetchImage,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  resetKey,
}: UseImageRevealArgs): ImageRevealState {
  // `initialPath` is whatever is stored on the row: a real path, the terminal
  // failure sentinel, or null. Translate it once so a settled state (real image
  // OR a prior failure) reveals at once and the sentinel never leaks as a src.
  const initial = resolveStoredImagePath(initialPath);
  // Non-null stored value (real path OR failure sentinel) = SETTLED: reveal at
  // once, never fetch. Null = nothing yet → fetch.
  const isSettled = initialPath !== null;
  const [imagePath, setImagePath] = useState<string | null>(initial.imagePath);
  // A settled state carries its real status (ready / failed). When we have to
  // fetch, it stays "skipped" until the fetch settles it — a calm default so a
  // timeout-before-fetch reads as "no picture yet", not a failure.
  const [imageStatus, setImageStatus] = useState<ImageStatus>(
    isSettled ? initial.imageStatus : "skipped"
  );
  // Reveal immediately when there is nothing to wait for: images off, or the
  // row is already settled. Otherwise gate the reveal on the fetch/timeout.
  const [revealed, setRevealed] = useState<boolean>(!imageEnabled || isSettled);
  // Keep the latest fetchImage without making it a dependency (it is a fresh
  // closure each render — depending on it would re-arm the gate every render).
  const fetchRef = useRef(fetchImage);
  fetchRef.current = fetchImage;

  useEffect(() => {
    // Already-settled row (real image / prior failure) or disabled: reveal at
    // once, no fetch, no wait. The sentinel maps to (null, "failed").
    if (!imageEnabled || initialPath !== null) {
      const settled = resolveStoredImagePath(initialPath);
      console.log("[stories] client image fetch SKIPPED (no fetch)", {
        reason: imageEnabled ? "row already settled" : "imageEnabled=false",
        resetKey,
        status: imageEnabled ? settled.imageStatus : "skipped",
      });
      setImagePath(settled.imagePath);
      setImageStatus(imageEnabled ? settled.imageStatus : "skipped");
      setRevealed(true);
      return;
    }

    // New beat: re-arm the gate (waiting state) and start the background fetch
    // racing a max-wait timeout. Whichever resolves first reveals the text.
    setImagePath(null);
    setImageStatus("skipped");
    setRevealed(false);
    // `unmounted` = this beat is GONE (cleanup ran: resetKey changed / left). It
    // is the ONLY thing that discards a result — NOT the reveal timeout. The
    // timeout merely stops blocking the reveal (text + calm placeholder) while
    // the fetch keeps running; a successful late resolve then swaps the real
    // image in without a manual refresh, as long as we're still on this beat.
    let unmounted = false;
    const fetchStartedAt = Date.now();
    const dedupeKey = String(resetKey);

    // Reveal-without-blocking timeout (both owner + dedup paths): if nothing has
    // settled by `timeoutMs`, STOP BLOCKING — reveal text + calm placeholder so
    // the child is never stuck. The shared fetch is NOT cancelled: it keeps
    // running and, when it resolves later (e.g. ~60s), this effect's handler
    // below swaps the real image in — no manual refresh. Leave status "skipped"
    // (not a known failure).
    const timeout = setTimeout(() => {
      if (!unmounted) {
        console.warn(
          `[stories] image reveal timed out after ${timeoutMs}ms (elapsed ${Date.now() - fetchStartedAt}ms) — not blocking the child; the fetch keeps running and will swap the image in when it resolves`
        );
        setRevealed(true);
      }
    }, timeoutMs);

    // Single-flight: share the in-flight PROMISE per key. The OWNER (no entry
    // yet) calls fetchImage once and registers the promise; a non-owner (a dev
    // double-invoke / remount / re-armed effect) ATTACHES to the same promise —
    // no second billed call. Crucially BOTH attach their OWN handler (closing
    // over THIS effect's live `unmounted`/`fetchStartedAt`), so under StrictMode
    // mount→unmount→remount the LIVE (second) effect still delivers the image.
    const existing = inFlightFetches.get(dedupeKey);
    let promise: Promise<ImageResult>;
    if (existing === undefined) {
      // OWNER: call fetchImage once, register the promise, and free the slot
      // exactly once AFTER settle (so a genuinely-new key still fetches and a
      // real retry can re-fetch). Non-owners must NOT delete it.
      console.log("[stories] client image fetch START", { resetKey });
      promise = fetchRef.current();
      inFlightFetches.set(dedupeKey, promise);
      promise.finally(() => inFlightFetches.delete(dedupeKey));
    } else {
      // NON-OWNER: attach to the same promise — no second billed call.
      console.warn("[stories] image fetch deduped (already in-flight)", {
        key: dedupeKey,
      });
      promise = existing;
    }

    promise
      .then(async ({ imagePath: path, imageStatus: status }) => {
        if (unmounted) {
          // Beat already left (resetKey changed) — discard so we never swap onto
          // the wrong beat.
          return;
        }
        const elapsedMs = Date.now() - fetchStartedAt;
        console.log("[stories] client image fetch SETTLED", {
          hasPath: !!path,
          // True when this resolved AFTER the reveal timeout — a late swap-in.
          lateSwap: elapsedMs >= timeoutMs,
          ms: elapsedMs,
          resetKey,
          status,
        });
        if (!path) {
          // No image: record whether it was a real failure or just skipped, then
          // reveal text with the matching calm state (failed → "no drawing").
          if (status === "failed") {
            console.warn("[stories] server reported image status: failed");
          }
          setImageStatus(status);
          setRevealed(true);
          return;
        }
        // Got a path — reveal/swap only once it is browser-decoded, so the
        // image never half-paints. If the reveal timeout already fired, this is
        // the LATE SWAP: setting the path + "ready" updates the placeholder to
        // the real image in-session (no refresh). A decode error reveals/keeps a
        // "failed" state (a path we can't paint is effectively no drawing).
        try {
          await preloadImage(path);
          if (!unmounted) {
            setImagePath(path);
            setImageStatus("ready");
            setRevealed(true);
          }
        } catch (error) {
          console.error("[stories] image reveal failed (decode):", error);
          if (!unmounted) {
            setImageStatus("failed");
            setRevealed(true);
          }
        }
      })
      .catch((error) => {
        console.error("[stories] image reveal failed (fetch/server):", error);
        if (!unmounted) {
          // The fetch itself rejected (network/server) → a real failure. (If the
          // beat was already revealed by the timeout, this just settles its
          // state; the calm placeholder stays.)
          setImageStatus("failed");
          setRevealed(true);
        }
      });

    return () => {
      // The beat is gone: discard any late fetch result (don't swap onto the
      // wrong beat) and stop the reveal timeout. The fetch itself isn't aborted
      // (the server-side single-flight + DB persist still benefit from it
      // completing once), but its result is ignored here.
      unmounted = true;
      clearTimeout(timeout);
    };
    // resetKey re-arms the gate for a new beat; the other inputs are stable for
    // one beat. fetchImage is intentionally excluded (see fetchRef above).
  }, [resetKey, imageEnabled, initialPath, timeoutMs]);

  return { imagePath, imageStatus, revealed };
}
