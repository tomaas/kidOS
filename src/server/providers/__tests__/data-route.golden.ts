/**
 * DATA-ROUTE assertion script — the /data/$ disk-serve route.
 *
 * Pins the fix for the invisible-illustration bug: in local-disk mode
 * (no BLOB_READ_WRITE_TOKEN — i.e. the self-hosted Docker deploy) `saveMedia`
 * stores `/data/media/<file>` web paths, but no route ever served them — every
 * generated image 404'd in the browser, the client preload failed, and each
 * beat landed on the calm "no drawing" state even though the file was on disk.
 *
 * Same standalone-runnable pattern as media-store.golden.ts:
 *   DATA_DIR=<tmp> SKIP_ENV_VALIDATION=1 bun run src/server/providers/__tests__/data-route.golden.ts
 * (wired as `bun run test:data-route`). Exits non-zero on any failure.
 * DATA_DIR is pointed at a fresh temp dir BEFORE the route module loads, so
 * the assertions never touch the real ./data.
 */

import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Must be set before ~/env (via media-store) is imported below.
process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "data-route-golden-"));

const { Route } = await import("~/app/data.$");

let failures = 0;
function check(name: string, ok: boolean, detail?: string) {
  if (ok) {
    console.log(`✓ ${name}`);
  } else {
    failures += 1;
    console.error(`✗ ${name}${detail ? `\n  ${detail}` : ""}`);
  }
}

const handlers = Route.options.server?.handlers as
  | Record<string, (ctx: { params: { _splat?: string } }) => Promise<Response>>
  | undefined;
const get = handlers?.GET;
check(
  "the /data/$ route exposes a GET server handler",
  typeof get === "function"
);
if (!get) {
  console.error(
    "\nDATA-ROUTE FAILED: no GET handler — nothing serves stored media."
  );
  process.exit(1);
}

const mediaDir = join(process.env.DATA_DIR, "media");
mkdirSync(mediaDir, { recursive: true });
const jpgBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
writeFileSync(join(mediaDir, "img_golden.jpg"), jpgBytes);
writeFileSync(
  join(process.env.DATA_DIR, "outside.txt"),
  "must never be served"
);

// The exact bug scenario: a stored `/data/media/<file>` path must serve bytes.
{
  const res = await get({ params: { _splat: "media/img_golden.jpg" } });
  const body = new Uint8Array(await res.arrayBuffer());
  check(
    "a stored media file is served with 200",
    res.status === 200,
    `status=${res.status}`
  );
  check(
    "served bytes are byte-identical to the stored file",
    body.length === jpgBytes.length && body.every((b, i) => b === jpgBytes[i])
  );
  check(
    "content-type derives from the extension (image/jpeg)",
    res.headers.get("content-type") === "image/jpeg",
    `content-type=${res.headers.get("content-type")}`
  );
  check(
    "immutable long-lived cache header (files are nanoid-unique, never overwritten)",
    res.headers.get("cache-control") === "public, max-age=31536000, immutable",
    `cache-control=${res.headers.get("cache-control")}`
  );
}

// A missing file is a plain 404, never a throw (the client preload turns it
// into the calm "no drawing" state).
{
  const res = await get({ params: { _splat: "media/img_missing.jpg" } });
  check(
    "a missing media file → 404",
    res.status === 404,
    `status=${res.status}`
  );
}

// Traversal out of the media dir is rejected (readStoredMediaBytes contract).
{
  const res = await get({ params: { _splat: "media/../outside.txt" } });
  check(
    "a path escaping the media dir → 404",
    res.status === 404,
    `status=${res.status}`
  );
}

// Only the media/ subtree is servable — /data/<anything-else> is not a
// general file server over DATA_DIR.
{
  const res = await get({ params: { _splat: "outside.txt" } });
  check(
    "a non-media /data path → 404",
    res.status === 404,
    `status=${res.status}`
  );
}

if (failures > 0) {
  console.error(`\nDATA-ROUTE FAILED: ${failures} mismatch(es).`);
  process.exit(1);
}
console.log(
  "\nDATA-ROUTE OK: local-disk media is served (200 + right headers), everything else 404s."
);
