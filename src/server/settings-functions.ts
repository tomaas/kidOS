import { createServerFn } from "@tanstack/react-start";
import { eq } from "drizzle-orm";
import { z } from "zod";
import {
  DEFAULT_LOCALE,
  type Locale,
  normalizeLocale,
} from "~/lib/i18n/locale";
import { setSetting, UI_LANGUAGE_KEY } from "~/server/app-config";
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
      // Écrivain CENTRAL (app-config.ts) : tout writer de `app_settings`
      // passe par setSetting/applySettingsPatch — validation de clé et
      // transaction ne peuvent pas être contournées.
      await setSetting(UI_LANGUAGE_KEY, data.locale);
      return { success: true };
    } catch (error) {
      // Le détail technique (chemin du fichier SQLite, SQL) reste côté serveur — le
      // parent reçoit un état calme, libellé par le catalogue client.
      console.error("saveUiLocaleFn:", error);
      return { success: false };
    }
  });
