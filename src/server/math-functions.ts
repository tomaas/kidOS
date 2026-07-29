import { createServerFn } from "@tanstack/react-start";
import { and, eq, like, notInArray, or } from "drizzle-orm";
import { z } from "zod";
import type { FamilySettings, Operation } from "~/lib/operations";
import {
  FAMILLES,
  isPalierOfFamille,
  MAX_SERIE_SIZE,
  MIN_SERIE_SIZE,
  SKILL_KEY_PREFIX,
  settingsFromRows,
  skillKeyOf,
} from "~/lib/operations";
import { db } from "~/server/db";
import { mathSkills } from "~/server/db/schema";

/**
 * Settings of the "poser des calculs" mini-app — one row per ACTIVATED
 * operation family, keyed `calcul-pose:<famille>` (eng-review 1B): row
 * present = family activated (a tray on the child's shelf), row absent = the
 * family does not exist on screen (premise 3 — never a greyed tray). The
 * legacy single `calcul-pose` row is rewritten by data migration 0010.
 *
 * The palier is a MANUAL parent choice per family (eng-review T2-A) — these
 * functions only read/write it, they never evaluate the child or move the
 * palier on their own. The child-facing route additionally caches the last
 * known settings in localStorage (decision 2A) so a network outage never
 * shows an error to the child; that read-through happens client-side.
 *
 * All rows→settings logic lives in the PURE, golden-tested settingsFromRows
 * (decision 3A) — this file is a query plus a call.
 */

/**
 * House timestamp format — same idiom as the sibling *-functions.ts files
 * (space-separated, 23 chars). Note: the column DEFAULT (strftime, schema.ts)
 * additionally carries "+00" — both shapes coexist app-wide by convention.
 */
function nowSqlTimestamp(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 23);
}

export interface MathSettings extends FamilySettings {
  /**
   * true seulement quand les réglages viennent de VRAIES lignes DB (red-team
   * RT1) : une réponse par défaut (table vide, DB pas encore migrée) n'est
   * pas une vérité sur les familles — le client ne doit JAMAIS purger des
   * séries locales sur cette base. Absent d'un cache appareil par
   * construction (normalizeFamilySettings ne le produit pas).
   */
  authoritative?: boolean;
}

export const getMathSettingsFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<MathSettings> => {
    const rows = await db
      .select()
      .from(mathSkills)
      .where(like(mathSkills.skill, `${SKILL_KEY_PREFIX}%`));
    // settingsFromRows carries every edge case (empty table → default
    // addition, dirty palier repaired within its family, serieSize clamped).
    // authoritative exige au moins une ligne RECONNUE (adversarial #1) : une
    // clé exotique (`calcul-pose:banana`, casse LIKE) matcherait le LIKE mais
    // produirait des défauts — qui ne doivent jamais armer la purge client.
    const recognized = rows.some((row) =>
      FAMILLES.some((op) => row.skill === skillKeyOf(op))
    );
    return { ...settingsFromRows(rows), authoritative: recognized };
  }
);

const familleValues = FAMILLES as readonly [Operation, ...Operation[]];

const saveSchema = z.object({
  familles: z
    .array(
      z
        .object({
          op: z.enum(familleValues),
          palier: z.string(),
        })
        // Validation croisée palier↔famille (eng-review T7) : une ligne
        // incohérente écrite « proprement » serait réparée en silence à la
        // lecture — un palier qui change dans le dos du parent. On refuse.
        .refine(
          (f) => isPalierOfFamille(f.op, f.palier),
          "Palier hors de sa famille."
        )
    )
    // Garde-fou « impossible de tout désactiver » : l'UI bloque le dernier
    // interrupteur, le serveur refuse quand même (message côté parent
    // uniquement — l'enfant n'en voit jamais rien).
    .min(1, "Au moins une famille reste sur l'étagère.")
    .refine(
      (familles) => new Set(familles.map((f) => f.op)).size === familles.length,
      "Famille en double."
    ),
  serieSize: z.number().int().min(MIN_SERIE_SIZE).max(MAX_SERIE_SIZE),
});

export type MathSettingsMutationResult =
  | { success: true; settings: MathSettings }
  // Code stable, jamais une phrase : le LIBELLÉ appartient au client
  // (catalogue i18n) — le serveur ne choisit pas la langue du parent (D7 du
  // plan multilangue).
  | { success: false; code: "save-failed" };

export const saveMathSettingsFn = createServerFn({ method: "POST" })
  .validator(saveSchema)
  .handler(async ({ data }): Promise<MathSettingsMutationResult> => {
    const keptKeys = data.familles.map((f) => skillKeyOf(f.op));
    try {
      // Un seul batch libSQL — atomique (eng-review, voix extérieure #5) :
      // jamais d'état transitoire où une famille a disparu sans sa
      // remplaçante. Upsert par famille activée + suppression des
      // désactivées (désactiver = supprimer la ligne, prémisse 5).
      await db.batch([
        db.delete(mathSkills).where(
          or(
            and(
              like(mathSkills.skill, `${SKILL_KEY_PREFIX}%`),
              notInArray(mathSkills.skill, keptKeys)
            ),
            // Auto-nettoyage : une ligne legacy nue recréée par l'ANCIEN
            // code pendant la fenêtre post-migration/pré-redéploiement
            // (data-migration review) disparaît à la première sauvegarde.
            eq(mathSkills.skill, "calcul-pose")
          )
        ),
        ...data.familles.map((famille) =>
          db
            .insert(mathSkills)
            .values({
              palier: famille.palier,
              serieSize: data.serieSize,
              skill: skillKeyOf(famille.op),
            })
            .onConflictDoUpdate({
              set: {
                palier: famille.palier,
                serieSize: data.serieSize,
                updatedAt: nowSqlTimestamp(),
              },
              target: mathSkills.skill,
            })
        ),
      ]);
    } catch (error) {
      // Le détail technique (chaîne Turso, SQL) reste côté serveur — le
      // parent reçoit un code calme et fixe (security review), libellé par
      // le catalogue client.
      console.error("saveMathSettingsFn:", error);
      return {
        code: "save-failed",
        success: false,
      };
    }
    return {
      settings: {
        // Ré-émis dans l'ordre canonique, comme settingsFromRows le lirait.
        familles: FAMILLES.flatMap((op) => {
          const famille = data.familles.find((f) => f.op === op);
          return famille ? [{ op, palier: famille.palier }] : [];
        }),
        serieSize: data.serieSize,
      },
      success: true,
    };
  });
