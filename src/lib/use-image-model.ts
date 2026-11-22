import { useEffect, useState } from "react";

import { DEFAULT_IMAGE_MODEL, isValidImageModel } from "~/config/image-models";

/**
 * Parent-pickable Google image model (see `~/config/image-models`). The choice
 * is persisted per-device in localStorage and threaded per-request to the image
 * server fns so a parent can compare quality / price / speed live. SSR-safe:
 * the server and the first client paint return the default, then an effect
 * reads + validates the stored choice (unknown id → default).
 *
 * This is a PARENT control only — the child flow never reads it, and an invalid
 * stored value can never reach the child (the server re-validates via
 * `resolveImageModel` before any generation). Mirrors `use-reading-font.ts`.
 */
const STORAGE_KEY = "stories:image-model";

/**
 * @param envDefault the env `IMAGE_MODEL` mirrored from the server's public
 *   flags, so the "par défaut" choice tracks the deployed env rather than a
 *   hard-coded mirror. Falls back to `DEFAULT_IMAGE_MODEL` when absent/unknown.
 */
function resolveDefault(envDefault?: string): string {
  return isValidImageModel(envDefault)
    ? (envDefault as string)
    : DEFAULT_IMAGE_MODEL;
}

function readStored(fallback: string): string {
  if (typeof window === "undefined") {
    return fallback;
  }
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isValidImageModel(stored ?? undefined)
      ? (stored as string)
      : fallback;
  } catch {
    // Private mode / disabled storage — degrade to the default, never throw.
    return fallback;
  }
}

export interface UseImageModel {
  /** The active model id. The default on the server and until hydration. */
  model: string;
  /** Persist + switch to `id` (ignored if not an offered model). */
  setModel: (id: string) => void;
}

export function useImageModel(envDefault?: string): UseImageModel {
  const fallback = resolveDefault(envDefault);
  // Start at the default so SSR and the first client render match (no hydration
  // mismatch), then sync the stored choice in an effect.
  const [model, setModelState] = useState<string>(fallback);

  useEffect(() => {
    setModelState(readStored(fallback));
  }, [fallback]);

  const setModel = (id: string) => {
    if (!isValidImageModel(id)) {
      return;
    }
    setModelState(id);
    try {
      window.localStorage.setItem(STORAGE_KEY, id);
    } catch {
      // Persistence is best-effort; the in-memory choice still applies.
    }
  };

  return { model, setModel };
}
