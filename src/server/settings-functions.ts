import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { z } from "zod";
import {
  DEFAULT_LOCALE,
  type Locale,
  normalizeLocale,
} from "~/lib/i18n/locale";
import { db } from "~/server/db";
import { appSettings } from "~/server/db/schema";

/**
 * Réglages globaux (table `app_settings`) — pour l'instant un seul : la
 * locale de l'INTERFACE, choisie par le parent à /parents. Lue par le loader
 * racine à CHAQUE rendu SSR : la lecture ne jette JAMAIS (DB injoignable →
 * locale par défaut, log serveur) — le shell doit toujours rendre, l'enfant
 * ne voit jamais d'erreur de langue. L'écriture renvoie un booléen calme ;
 * le libellé d'échec appartient au CLIENT (catalogue i18n) — le serveur ne
 * choisit pas la langue d'un message destiné au parent.
 */

const UI_LANGUAGE_KEY = "ui-language";

/**
 * House timestamp format — same idiom as the sibling *-functions.ts files
 * (space-separated, 23 chars). Note: the column DEFAULT (strftime, schema.ts)
 * additionally carries "+00" — both shapes coexist app-wide by convention.
 */
function nowSqlTimestamp(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 23);
}

export const getUiLocaleFn = createServerFn({ method: "GET" }).handler(
  async (): Promise<{ locale: Locale }> => {
    try {
      const [row] = await db
        .select()
        .from(appSettings)
        .where(eq(appSettings.key, UI_LANGUAGE_KEY));
      return { locale: normalizeLocale(row?.value) };
    } catch (error) {
      console.error("getUiLocaleFn:", error);
      return { locale: DEFAULT_LOCALE };
    }
  }
);

export const saveUiLocaleFn = createServerFn({ method: "POST" })
  .validator(z.object({ locale: z.enum(["fr", "en"]) }))
  .handler(async ({ data }): Promise<{ success: boolean }> => {
    try {
      await db
        .insert(appSettings)
        .values({ key: UI_LANGUAGE_KEY, value: data.locale })
        .onConflictDoUpdate({
          set: { updatedAt: nowSqlTimestamp(), value: data.locale },
          target: appSettings.key,
        });
      return { success: true };
    } catch (error) {
      // Le détail technique (chemin du fichier SQLite, SQL) reste côté serveur — le
      // parent reçoit un état calme, libellé par le catalogue client.
      console.error("saveUiLocaleFn:", error);
      return { success: false };
    }
  });
