import { createFileRoute } from "@tanstack/react-router";

import {
  contentTypeFor,
  readStoredMediaBytes,
} from "~/server/providers/media-store";

/**
 * Disk-serve route for locally stored generated media: the web half of the
 * local-disk backend in media-store.ts. When BLOB_READ_WRITE_TOKEN is absent
 * (self-hosted Docker / offline dev), `saveMedia` writes DATA_DIR/media/<file>
 * and stores the `/data/media/<file>` web path — this route is what actually
 * serves those bytes back to the browser.
 *
 * All path handling goes through `readStoredMediaBytes` (the single
 * choke-point): only `/data/media/…` shapes resolve, and anything escaping the
 * media dir (`/data/media/../../.env`) is rejected → 404 here.
 *
 * Filenames are nanoid-unique and never overwritten (see saveMedia), so a
 * served file is immutable → long-lived immutable cache header.
 */
export const Route = createFileRoute("/data/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const webPath = `/data/${params._splat ?? ""}`;
        let bytes: Uint8Array | null;
        try {
          bytes = await readStoredMediaBytes(webPath);
        } catch {
          // Missing file (readFile ENOENT) or any read error → plain 404; the
          // client's image preload treats it as the calm "no drawing" state.
          bytes = null;
        }
        if (!bytes) {
          return new Response("Not found", { status: 404 });
        }
        return new Response(Buffer.from(bytes), {
          headers: {
            "cache-control": "public, max-age=31536000, immutable",
            "content-length": String(bytes.byteLength),
            "content-type": contentTypeFor(webPath),
          },
        });
      },
    },
  },
});
