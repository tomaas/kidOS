import { createServerFn } from "@tanstack/react-start";
import { and, like, notInArray } from "drizzle-orm";
import { z } from "zod";
import type { SudokuSettings } from "~/lib/sudoku";
import {
  SUDOKU_SKILL_KEY_PREFIX,
  settingsFromRows,
  sudokuSkillKeyOf,
} from "~/lib/sudoku";
import { db } from "~/server/db";
import { sudokuSkills } from "~/server/db/schema";

/**
 * Settings of the "sudoku" mini-app — one row per ACTIVATED grid size, keyed
 * `sudoku:<taille>` (KTD7, mirror of math-functions.ts): row present = size
 * activated (a tray on the child's shelf), row absent = the size does not
 * exist on screen (never a greyed tray).
 *
 * The generosite is a MANUAL parent choice per size — these functions only
 * read/write it, they never evaluate the child or move the generosity on
 * their own. The child-facing route additionally caches the last known
 * settings in localStorage (SUDOKU_SETTINGS_CACHE_KEY) so a network outage
 * never shows an error to the child; that read-through happens client-side.
 *
 * All rows→settings logic lives in the PURE, golden-tested settingsFromRows —
 * this file is a query plus a call. Plan-mandated deviation from the calcul
 * model: `authoritative` is computed INSIDE settingsFromRows (at least one
 * RECOGNIZED row — an exotic `sudoku:banana` key matches the LIKE but never
 * arms the client purge); the server function merely relays it.
 */

/**
 * House timestamp format — same idiom as the sibling *-functions.ts files
 * (space-separated, 23 chars). Note: the column DEFAULT (strftime, schema.ts)
 * additionally carries "+00" — both shapes coexist app-wide by convention.
 */
function nowSqlTimestamp(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 23);
}

export const getSudokuSettingsFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<SudokuSettings> => {
    const rows = await db
      .select()
      .from(sudokuSkills)
      .where(like(sudokuSkills.skill, `${SUDOKU_SKILL_KEY_PREFIX}%`));
    // settingsFromRows carries every edge case (empty table → 4×4+6×6
    // defaults never authoritative, dirty generosite clamped, unknown key
    // ignored) — including the authoritative flag itself (see file header).
    return settingsFromRows(rows);
  }
);

const saveSchema = z.object({
  tailles: z
    .array(
      z.object({
        generosite: z.union([z.literal(1), z.literal(2), z.literal(3)]),
        taille: z.union([z.literal(4), z.literal(6), z.literal(9)]),
      })
    )
    // Garde-fou « impossible de tout désactiver » : l'UI bloque le dernier
    // interrupteur, le serveur refuse quand même (message côté parent
    // uniquement — l'enfant n'en voit jamais rien).
    .min(1, "Au moins une taille reste sur l'étagère.")
    .refine(
      (tailles) =>
        new Set(tailles.map((t) => t.taille)).size === tailles.length,
      "Taille en double."
    ),
});

export type SudokuSettingsMutationResult =
  | { success: true; settings: SudokuSettings }
  // Code stable, jamais une phrase : le LIBELLÉ appartient au client
  // (catalogue i18n) — le serveur ne choisit pas la langue du parent (D7 du
  // plan multilangue).
  | { success: false; code: "save-failed" };

export const saveSudokuSettingsFn = createServerFn({ method: "POST" })
  .validator(saveSchema)
  .handler(async ({ data }): Promise<SudokuSettingsMutationResult> => {
    const keptKeys = data.tailles.map((t) => sudokuSkillKeyOf(t.taille));
    try {
      // Un seul batch libSQL — atomique (même idiome que le calcul posé) :
      // jamais d'état transitoire où une taille a disparu sans sa
      // remplaçante. Upsert par taille activée + suppression des
      // désactivées (désactiver = supprimer la ligne).
      await db.batch([
        db
          .delete(sudokuSkills)
          .where(
            and(
              like(sudokuSkills.skill, `${SUDOKU_SKILL_KEY_PREFIX}%`),
              notInArray(sudokuSkills.skill, keptKeys)
            )
          ),
        ...data.tailles.map((taille) =>
          db
            .insert(sudokuSkills)
            .values({
              generosite: taille.generosite,
              skill: sudokuSkillKeyOf(taille.taille),
            })
            .onConflictDoUpdate({
              set: {
                generosite: taille.generosite,
                updatedAt: nowSqlTimestamp(),
              },
              target: sudokuSkills.skill,
            })
        ),
      ]);
    } catch (error) {
      // Le détail technique (chemin du fichier SQLite, SQL) reste côté
      // serveur — le parent reçoit un code calme et fixe, libellé par le
      // catalogue client.
      console.error("saveSudokuSettingsFn:", error);
      return {
        code: "save-failed",
        success: false,
      };
    }
    return {
      // Ré-émis dans l'ordre canonique via la même normalisation pure que la
      // lecture (settingsFromRows sur les lignes qu'on vient d'écrire) —
      // authoritative:true par construction, ce sont de vraies lignes DB.
      settings: settingsFromRows(
        data.tailles.map((taille) => ({
          generosite: taille.generosite,
          skill: sudokuSkillKeyOf(taille.taille),
        }))
      ),
      success: true,
    };
  });
