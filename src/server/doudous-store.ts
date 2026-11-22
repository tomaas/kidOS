import { inArray } from "drizzle-orm";

import { doudous as legacyDoudous } from "~/config/doudous";
import { db } from "~/server/db";
import { doudous } from "~/server/db/schema";

/**
 * Server-only doudou helpers that touch the DB but are NOT server functions.
 *
 * These live in their OWN module (not alongside the `createServerFn` exports in
 * doudous-functions.ts) for the exact same reason as `places-store.ts`: a PLAIN
 * exported function importing `~/server/db` would drag libSQL into the client
 * build if it shared a module with a server fn a route loader imports. Keeping
 * these here, imported only by other server code, keeps the client bundle clean.
 */

/**
 * Seed the config doudous into the DB on FIRST RUN ONLY: any existing row
 * (active or soft-deleted) means the family already owns this table, and the
 * sample config must never inject rows into it (same discipline as
 * `seedPlacesIfNeeded`). On an empty table the exact config ids are reused with
 * `onConflictDoNothing` guarding a concurrent double-seed.
 */
export async function seedDoudousIfNeeded(): Promise<void> {
  const [existing] = await db.select({ id: doudous.id }).from(doudous).limit(1);
  if (existing) {
    return;
  }
  await db
    .insert(doudous)
    .values(
      legacyDoudous.map((d, i) => ({
        emoji: d.emoji,
        id: d.id,
        imageHint: d.imageHint,
        label: d.label,
        promptHint: d.promptHint,
        sort: i,
      }))
    )
    .onConflictDoNothing()
    .run();
}

/**
 * Resolve SEVERAL doudous by id for creation-time snapshotting (multi-select).
 * Preserves the child's pick ORDER, drops any id that resolves to neither a DB
 * row nor a config entry, and de-duplicates. Returns [] for an empty input
 * (the child brought no doudou). One round-trip for the DB rows; config covers
 * a pre-seed gap. The resolved labels + hints are frozen onto the story row.
 */
export async function resolveDoudousForCreation(
  doudouIds: string[]
): Promise<{ label: string; promptHint: string; imageHint: string }[]> {
  const uniqueIds = [...new Set(doudouIds)];
  if (uniqueIds.length === 0) {
    return [];
  }
  await seedDoudousIfNeeded();
  const rows = await db
    .select()
    .from(doudous)
    .where(inArray(doudous.id, uniqueIds));
  const byId = new Map(rows.map((r) => [r.id, r]));
  const legacyById = new Map(legacyDoudous.map((d) => [d.id, d]));
  const resolved: {
    label: string;
    promptHint: string;
    imageHint: string;
  }[] = [];
  for (const id of uniqueIds) {
    const row = byId.get(id);
    if (row) {
      resolved.push({
        imageHint: row.imageHint,
        label: row.label,
        promptHint: row.promptHint,
      });
      continue;
    }
    const legacy = legacyById.get(id);
    if (legacy) {
      resolved.push({
        imageHint: legacy.imageHint,
        label: legacy.label,
        promptHint: legacy.promptHint,
      });
    }
  }
  return resolved;
}
