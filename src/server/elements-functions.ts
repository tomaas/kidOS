import { createServerFn } from "@tanstack/react-start";
import { and, asc, eq, isNull } from "drizzle-orm";
import { z } from "zod";

import { db } from "~/server/db";
import { dbElements } from "~/server/db/schema";
import type { DbElement } from "~/server/db/schema";
import { seedElementsIfNeeded } from "~/server/elements-store";

/**
 * Active elements (deletedAt IS NULL), ordered, for the picker + parent page.
 * Seeds on first read. Elements are REQUIRED (≥1 pick), but the picker falls
 * back to the config list if this ever returns empty, so a DB hiccup never
 * blanks the child flow.
 */
export const listElementsFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<DbElement[]> => {
    await seedElementsIfNeeded();
    return await db
      .select()
      .from(dbElements)
      .where(isNull(dbElements.deletedAt))
      .orderBy(asc(dbElements.sort), asc(dbElements.createdAt));
  }
);

const upsertSchema = z.object({
  emoji: z.string().trim().max(8).optional(),
  imagePath: z.string().trim().optional(),
  label: z.string().trim().min(1, "Un nom est nécessaire."),
  promptHint: z.string().trim().min(1, "Une description est nécessaire."),
  sort: z.number().int().optional(),
});

export type ElementMutationResult =
  | { success: true; element: DbElement }
  | { success: false; error: string };

export const createElementFn = createServerFn({ method: "POST" })
  .validator(upsertSchema)
  .handler(async ({ data }): Promise<ElementMutationResult> => {
    const [element] = await db
      .insert(dbElements)
      .values({
        emoji: data.emoji || null,
        imagePath: data.imagePath || null,
        label: data.label,
        promptHint: data.promptHint,
        sort: data.sort ?? 999,
      })
      .returning();
    return { element, success: true };
  });

export const updateElementFn = createServerFn({ method: "POST" })
  .validator(upsertSchema.extend({ id: z.string() }))
  .handler(async ({ data }): Promise<ElementMutationResult> => {
    const [element] = await db
      .update(dbElements)
      .set({
        emoji: data.emoji || null,
        imagePath: data.imagePath || null,
        label: data.label,
        promptHint: data.promptHint,
        ...(data.sort === undefined ? {} : { sort: data.sort }),
      })
      .where(and(eq(dbElements.id, data.id), isNull(dbElements.deletedAt)))
      .returning();
    if (!element) {
      return { error: "Élément introuvable.", success: false };
    }
    return { element, success: true };
  });

/**
 * Soft delete — sets deletedAt, never removes the row, so any old story that
 * still references this id keeps resolving (and history reads the snapshot
 * anyway). No hard delete exists in the parent UI.
 */
export const deleteElementFn = createServerFn({ method: "POST" })
  .validator(z.object({ id: z.string() }))
  .handler(async ({ data }): Promise<{ success: boolean }> => {
    await db
      .update(dbElements)
      .set({
        deletedAt: new Date().toISOString().replace("T", " ").slice(0, 23),
      })
      .where(and(eq(dbElements.id, data.id), isNull(dbElements.deletedAt)))
      .run();
    return { success: true };
  });
