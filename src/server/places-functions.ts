import { createServerFn } from "@tanstack/react-start";
import { and, asc, eq, isNull } from "drizzle-orm";
import { z } from "zod";

import { db } from "~/server/db";
import { places } from "~/server/db/schema";
import type { DbPlace } from "~/server/db/schema";
import { seedPlacesIfNeeded } from "~/server/places-store";

/**
 * Active places (deletedAt IS NULL), ordered, for the pickers + parent page.
 * Seeds on first read. The pickers fall back to the config list if this ever
 * returns empty, so a DB hiccup never blanks the child flow.
 */
export const listPlacesFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<DbPlace[]> => {
    await seedPlacesIfNeeded();
    return await db
      .select()
      .from(places)
      .where(isNull(places.deletedAt))
      .orderBy(asc(places.sort), asc(places.createdAt));
  }
);

const upsertSchema = z.object({
  emoji: z.string().trim().max(8).optional(),
  imagePath: z.string().trim().optional(),
  label: z.string().trim().min(1, "Un nom est nécessaire."),
  promptHint: z.string().trim().min(1, "Une description est nécessaire."),
  sort: z.number().int().optional(),
});

export type PlaceMutationResult =
  | { success: true; place: DbPlace }
  | { success: false; error: string };

export const createPlaceFn = createServerFn({ method: "POST" })
  .validator(upsertSchema)
  .handler(async ({ data }): Promise<PlaceMutationResult> => {
    const [place] = await db
      .insert(places)
      .values({
        emoji: data.emoji || null,
        imagePath: data.imagePath || null,
        label: data.label,
        promptHint: data.promptHint,
        sort: data.sort ?? 999,
      })
      .returning();
    return { place, success: true };
  });

export const updatePlaceFn = createServerFn({ method: "POST" })
  .validator(upsertSchema.extend({ id: z.string() }))
  .handler(async ({ data }): Promise<PlaceMutationResult> => {
    const [place] = await db
      .update(places)
      .set({
        emoji: data.emoji || null,
        imagePath: data.imagePath || null,
        label: data.label,
        promptHint: data.promptHint,
        ...(data.sort === undefined ? {} : { sort: data.sort }),
      })
      .where(and(eq(places.id, data.id), isNull(places.deletedAt)))
      .returning();
    if (!place) {
      return { error: "Lieu introuvable.", success: false };
    }
    return { place, success: true };
  });

/**
 * Soft delete — sets deletedAt, never removes the row, so any old story that
 * still references this id keeps resolving (and history reads the snapshot
 * anyway). No hard delete exists in the parent UI (codex #5).
 */
export const deletePlaceFn = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }): Promise<{ success: boolean }> => {
    await db
      .update(places)
      .set({
        deletedAt: new Date().toISOString().replace("T", " ").slice(0, 23),
      })
      .where(and(eq(places.id, data.id), isNull(places.deletedAt)))
      .run();
    return { success: true };
  });
