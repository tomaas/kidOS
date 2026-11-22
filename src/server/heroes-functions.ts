import { createServerFn } from "@tanstack/react-start";
import { and, asc, eq, isNull } from "drizzle-orm";
import { z } from "zod";

import { db } from "~/server/db";
import { type DbHero, heroes } from "~/server/db/schema";
import { seedHeroesIfNeeded } from "~/server/heroes-store";

/**
 * Active heroes (deletedAt IS NULL), ordered, for the picker + parent page.
 * Seeds on first read. Heroes are REQUIRED (≥1 pick), but the picker falls back
 * to the config list if this ever returns empty, so a DB hiccup never blanks the
 * child flow.
 */
export const listHeroesFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<DbHero[]> => {
    await seedHeroesIfNeeded();
    return db
      .select()
      .from(heroes)
      .where(isNull(heroes.deletedAt))
      .orderBy(asc(heroes.sort), asc(heroes.createdAt));
  }
);

const upsertSchema = z.object({
  emoji: z.string().trim().max(8).optional(),
  imageHint: z
    .string()
    .trim()
    .min(1, "Une description pour l'image est nécessaire."),
  imagePath: z.string().trim().optional(),
  label: z.string().trim().min(1, "Un nom est nécessaire."),
  promptHint: z.string().trim().min(1, "Une description est nécessaire."),
  sort: z.number().int().optional(),
});

export type HeroMutationResult =
  | { success: true; hero: DbHero }
  | { success: false; error: string };

export const createHeroFn = createServerFn({ method: "POST" })
  .validator(upsertSchema)
  .handler(async ({ data }): Promise<HeroMutationResult> => {
    const [hero] = await db
      .insert(heroes)
      .values({
        emoji: data.emoji || null,
        imageHint: data.imageHint,
        imagePath: data.imagePath || null,
        label: data.label,
        promptHint: data.promptHint,
        sort: data.sort ?? 999,
      })
      .returning();
    return { hero, success: true };
  });

export const updateHeroFn = createServerFn({ method: "POST" })
  .validator(upsertSchema.extend({ id: z.string() }))
  .handler(async ({ data }): Promise<HeroMutationResult> => {
    const [hero] = await db
      .update(heroes)
      .set({
        emoji: data.emoji || null,
        imageHint: data.imageHint,
        imagePath: data.imagePath || null,
        label: data.label,
        promptHint: data.promptHint,
        ...(data.sort === undefined ? {} : { sort: data.sort }),
      })
      .where(and(eq(heroes.id, data.id), isNull(heroes.deletedAt)))
      .returning();
    if (!hero) {
      return { error: "Héros introuvable.", success: false };
    }
    return { hero, success: true };
  });

/**
 * Soft delete — sets deletedAt, never removes the row, so any old story that
 * still references this id keeps resolving (and history reads the snapshot
 * anyway). No hard delete exists in the parent UI.
 */
export const deleteHeroFn = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }): Promise<{ success: boolean }> => {
    await db
      .update(heroes)
      .set({
        deletedAt: new Date().toISOString().replace("T", " ").slice(0, 23),
      })
      .where(and(eq(heroes.id, data.id), isNull(heroes.deletedAt)))
      .run();
    return { success: true };
  });
