/**
 * Le canal React de la locale UI : le loader racine (__root) lit la locale
 * (réglage parent en DB, repli "fr") et la pose ici — tout composant sous le
 * shell lit `useMessages()` sans plomberie. Défaut du contexte = "fr" : un
 * composant rendu hors provider (test, storybook improvisé) parle français,
 * jamais une exception.
 */

import { createContext, type ReactNode, useContext } from "react";
import { DEFAULT_LOCALE, type Locale } from "./locale";
import { en } from "./messages/en";
import { fr, type Messages } from "./messages/fr";

export const MESSAGES: Record<Locale, Messages> = { en, fr };

const LocaleContext = createContext<Locale>(DEFAULT_LOCALE);

export function LocaleProvider({
  children,
  locale,
}: Readonly<{ children: ReactNode; locale: Locale }>) {
  return (
    <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>
  );
}

export function useLocale(): Locale {
  return useContext(LocaleContext);
}

export function useMessages(): Messages {
  return MESSAGES[useLocale()];
}
