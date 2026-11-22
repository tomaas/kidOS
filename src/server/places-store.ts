import { eq } from "drizzle-orm";

import { places as legacyPlaces } from "~/config/places";
import { db } from "~/server/db";
import { places } from "~/server/db/schema";

/**
 * Server-only place helpers that touch the DB but are NOT server functions.
 *
 * These live in their OWN module (not alongside the `createServerFn` exports in
 * places-functions.ts) on purpose: TanStack strips server-FN bodies from the
 * client bundle, but a PLAIN exported function that imports `~/server/db` would
 * drag libSQL into the client build if it shared a module with a server fn that
 * a route loader imports. Keeping these here, imported only by other server
 * code, keeps the client bundle clean.
 */

/**
 * Seed the 6 config places into the DB on FIRST RUN ONLY: any existing row
 * (active or soft-deleted) means the family already owns this table, and the
 * sample config must never inject rows into it. On an empty table the exact
 * config ids are reused (codex #6: NOT seed-by-count) with `onConflictDoNothing`
 * guarding a concurrent double-seed. Reusing the config ids keeps historical
 * `stories.placeId` references resolving to a live row for stories created
 * before the snapshot columns existed.
 */
export async function seedPlacesIfNeeded(): Promise<void> {
  const [existing] = await db.select({ id: places.id }).from(places).limit(1);
  if (existing) {
    return;
  }
  await db
    .insert(places)
    .values(
      legacyPlaces.map((p, i) => ({
        emoji: p.emoji,
        id: p.id,
        label: p.label,
        promptHint: p.promptHint,
        sort: i,
      }))
    )
    .onConflictDoNothing()
    .run();
}

/**
 * Resolve a place by id for CREATION-TIME snapshotting. Prefers the live DB row
 * (active OR soft-deleted — a story can be created from a place that exists),
 * falling back to the immutable config so a fresh DB before the first seed still
 * resolves. The resolved label + promptHint are frozen onto the new story row;
 * after that, history never reads the table.
 */
export async function resolvePlaceForCreation(
  placeId: string
): Promise<{ label: string; promptHint: string } | null> {
  await seedPlacesIfNeeded();
  const [row] = await db.select().from(places).where(eq(places.id, placeId));
  if (row) {
    return { label: row.label, promptHint: row.promptHint };
  }
  const legacy = legacyPlaces.find((p) => p.id === placeId);
  return legacy ? { label: legacy.label, promptHint: legacy.promptHint } : null;
}
