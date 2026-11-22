import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve, sep } from "node:path";

import { serverEnv } from "~/env";

/**
 * Generated images/audio are persisted through this single choke-point. The
 * string returned here flows verbatim into `stories.imagePath` /
 * `storySegments.imagePath` and is rendered straight into `<img src>`.
 *
 * Two backends, gated on env:
 * - Vercel Blob (cloud) when `BLOB_READ_WRITE_TOKEN` is set → returns a public
 *   `https://…` CDN URL. This makes the app cloud-deployable on Vercel, whose
 *   filesystem is ephemeral/read-only.
 * - Local disk (DATA_DIR, gitignored) as a fallback when the token is absent
 *   (e.g. offline local dev) → returns a `/data/media/<file>` web path served
 *   by the `/data/$` route.
 *
 * The leading-`/` (local) vs `https://` (blob) prefix IS the back-compat
 * boundary — old rows keep working via the disk-serve route.
 */
const MEDIA_DIR = resolve(serverEnv.dataDir, "media");

const CONTENT_TYPES: Record<string, string> = {
  jpeg: "image/jpeg",
  jpg: "image/jpeg",
  mp3: "audio/mpeg",
  png: "image/png",
  wav: "audio/wav",
  webp: "image/webp",
};

// Exported for the /data/$ disk-serve route, which needs the same mapping to
// set the response Content-Type it serves stored files with.
export function contentTypeFor(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return CONTENT_TYPES[ext] ?? "application/octet-stream";
}

// Hard cap on a single Blob upload. The Blob REST API has no built-in
// timeout, so a stalled upload (network blip, provider hiccup) would otherwise
// hang the whole image step until the client's reveal timeout. Capping it here
// turns a stall into a fast, caught failure → the calm "no drawing" state.
const BLOB_UPLOAD_TIMEOUT_MS = 20_000;

// Vercel Blob REST endpoint + protocol constants, copied verbatim from the
// `@vercel/blob@2.4.1` SDK source so this fetch replicates `put()` exactly.
// We DON'T use the SDK: it transitively pulls @vercel/oidc → @vercel/cli-config
// → xdg-app-paths, a CJS module that calls bare top-level `require()`. Nitro
// bundles this SSR app to pure ESM (.mjs) where `require` is undefined; Rollup
// hoisted that chain into a shared eager chunk imported at module-load on every
// route → `ReferenceError: require is not defined` → prod SSR 500. A lazy
// `await import("@vercel/blob")` did NOT help (the chain was still hoisted into
// the eager chunk). Talking to the REST API directly removes the dep entirely.
const BLOB_API_URL = "https://vercel.com/api/blob";
const BLOB_API_VERSION = "12";

// rw token format: `vercel_blob_rw_<storeId>_<secret>` → storeId is segment[3].
function storeIdFromToken(token: string): string {
  return token.split("_")[3] ?? "";
}

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
  label: string
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`${label} timed out after ${ms}ms`)),
      ms
    );
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      }
    );
  });
}

export async function saveMedia(
  filename: string,
  bytes: Uint8Array
): Promise<string> {
  // Cloud path: Vercel Blob. Filenames are nanoid-unique, so we never overwrite
  // an existing key (Blob public URLs are cached ~1mo — overwriting is unsafe).
  if (serverEnv.blobReadWriteToken) {
    const token = serverEnv.blobReadWriteToken;
    const pathname = `media/${filename}`;
    // Replicates @vercel/blob `put()`: PUT /?pathname=… with the x-* protocol
    // headers the SDK sends. Headers copied verbatim from the SDK source so the
    // server treats this identically (access=public, no random suffix, the
    // file's content-type). Bounded by a timeout so a stalled upload fails fast
    // (caught upstream → calm "no drawing" state) rather than hanging.
    const params = new URLSearchParams({ pathname });
    const response = await withTimeout(
      fetch(`${BLOB_API_URL}/?${params.toString()}`, {
        // Buffer (Uint8Array subclass) is a valid fetch BodyInit; the raw
        // Uint8Array isn't accepted by the DOM lib's typings.
        body: Buffer.from(bytes),
        headers: {
          authorization: `Bearer ${token}`,
          "x-add-random-suffix": "0",
          "x-api-version": BLOB_API_VERSION,
          "x-content-type": contentTypeFor(filename),
          "x-vercel-blob-access": "public",
          "x-vercel-blob-store-id": storeIdFromToken(token),
        },
        method: "PUT",
      }),
      BLOB_UPLOAD_TIMEOUT_MS,
      "Vercel Blob upload"
    );
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(
        `Vercel Blob upload failed: ${response.status} ${response.statusText} ${detail}`.trim()
      );
    }
    // SDK returns { url, downloadUrl, pathname, contentType, … }; we need `url`.
    const result = (await response.json()) as { url?: string };
    if (!result.url) {
      throw new Error("Vercel Blob upload returned no url");
    }
    return result.url;
  }

  // Local-disk fallback (offline dev). Web path served by the /data/$ route.
  await mkdir(MEDIA_DIR, { recursive: true });
  await writeFile(join(MEDIA_DIR, filename), bytes);
  return `/data/media/${filename}`;
}

// The web-path prefix local-disk `saveMedia` returns (see above). Exported so
// readers of stored paths don't re-derive the storage convention by hand.
export const MEDIA_WEB_PREFIX = "/data/media/";

/**
 * The exact public hostname of THIS app's Vercel Blob store (derived from the
 * rw token), or null when running without Blob (local dev). Lets readers of
 * stored https media URLs pin their allowlist to our own store instead of the
 * whole *.public.blob.vercel-storage.com namespace.
 */
export function blobStoreHost(): string | null {
  const token = serverEnv.blobReadWriteToken;
  return token ? blobHostFromToken(token) : null;
}

/**
 * Derive the public blob hostname from a rw token. Pure (env-free) so the
 * allowlist compare can be unit-tested. LOWERCASED on purpose: hostnames are
 * case-insensitive and the WHATWG URL parser lowercases `url.hostname`, so a
 * store id containing uppercase letters would otherwise never equal the parsed
 * hostname — the app would silently reject its OWN blob URLs and disable every
 * reference image in blob/prod mode. Returns null for a malformed token.
 */
export function blobHostFromToken(token: string): string | null {
  const storeId = storeIdFromToken(token);
  return storeId
    ? `${storeId}.public.blob.vercel-storage.com`.toLowerCase()
    : null;
}

/**
 * Read back the bytes of a LOCAL stored media web path (`/data/media/<file>`).
 * Returns null for any other shape. The resolved file must stay inside
 * MEDIA_DIR — a tampered stored path like `/data/media/../../.env` is rejected
 * rather than read (defense-in-depth: today only server-generated nanoid
 * filenames are ever written to the DB).
 */
export async function readStoredMediaBytes(
  webPath: string
): Promise<Uint8Array | null> {
  if (!webPath.startsWith(MEDIA_WEB_PREFIX)) {
    return null;
  }
  const full = resolve(MEDIA_DIR, webPath.slice(MEDIA_WEB_PREFIX.length));
  if (!full.startsWith(MEDIA_DIR + sep)) {
    return null;
  }
  return await readFile(full);
}

// The public-blob namespace suffix, the https allowlist FALLBACK when no rw
// token is configured (then we can't derive the exact store host).
const BLOB_HOST_SUFFIX = ".public.blob.vercel-storage.com";

// Bound on fetching back a stored blob media (reference-image flow): a stalled
// CDN fetch must degrade (→ plain text-to-image) rather than hang the beat.
const STORED_MEDIA_FETCH_TIMEOUT_MS = 10_000;

/**
 * The https-branch ALLOWLIST decision for a stored media value, PURE
 * (env-free) so the goldens can pin it: parse the stored `https://` string and
 * accept it only when its hostname is THIS app's own Blob store (`storeHost`,
 * rw-token-derived — see `blobStoreHost`) — or, when no token is configured
 * (local dev reading old blob rows), any `*.public.blob.vercel-storage.com`
 * host. Anything else (a tampered row, a future write path) returns null:
 * ignored rather than fetched server-side (SSRF defense-in-depth).
 */
export function allowedStoredMediaUrl(
  stored: string,
  storeHost: string | null
): URL | null {
  if (!stored.startsWith("https://")) {
    return null;
  }
  let url: URL;
  try {
    url = new URL(stored);
  } catch {
    return null;
  }
  const allowed = storeHost
    ? url.hostname === storeHost
    : url.hostname.endsWith(BLOB_HOST_SUFFIX);
  return allowed ? url : null;
}

/**
 * Read back a STORED media value (a `stories`/`story_segments` path column) as
 * bytes for a model input — the single read-back counterpart of `saveMedia`,
 * hiding the same `/`-prefix (local) vs `https://` (blob) back-compat boundary
 * so no caller re-implements the storage rule:
 *  - `https://…` → allowlisted via `allowedStoredMediaUrl` (own store host
 *    when the rw token is set, else the public-blob suffix), then fetched with
 *    a bounded timeout. A rejected host logs LOUDLY: a silent rejection here
 *    once hid a prod bug (a case-mismatched store host rejected the app's OWN
 *    blob URLs and disabled every reference image).
 *  - `/data/media/…` → `readStoredMediaBytes` (rejects any path escaping the
 *    media dir).
 * Returns undefined when the value is rejected/unreadable — callers degrade
 * (e.g. plain text-to-image). Errors propagate: the caller owns best-effort.
 */
export async function resolveStoredMediaForModel(
  stored: string
): Promise<Uint8Array | undefined> {
  if (stored.startsWith("https://")) {
    const storeHost = blobStoreHost();
    const url = allowedStoredMediaUrl(stored, storeHost);
    if (!url) {
      console.warn(
        `[media-store] stored https media REJECTED by host allowlist: ${stored}` +
          ` (expected ${storeHost ?? `*${BLOB_HOST_SUFFIX}`}).`
      );
      return;
    }
    const res = await fetch(url, {
      signal: AbortSignal.timeout(STORED_MEDIA_FETCH_TIMEOUT_MS),
    });
    if (!res.ok) {
      return;
    }
    return new Uint8Array(await res.arrayBuffer());
  }
  return (await readStoredMediaBytes(stored)) ?? undefined;
}
