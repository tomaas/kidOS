import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
  useRouterState,
} from "@tanstack/react-router";
import type { ReactNode } from "react";
import { PaletteParent } from "~/components/palette-parent";
import { Toaster } from "~/components/ui/sonner";
import {
  buildBranding,
  type Locale,
  LocaleProvider,
  MESSAGES,
  normalizeLocale,
} from "~/lib/i18n";
import { getShellContextFn } from "~/server/settings-functions";
import appCss from "./globals.css?url";

/**
 * Écrans d'erreur/404 AUTO-CONTENUS (eng-review D24-A) : le shell est
 * route-aware (plein-bleed pour la couche bureau) — ces écrans apportent donc
 * leur propre conteneur centré, pour rendre cohérents dans les deux modes
 * (jamais un plein-bleed cassé après un crash dans la fenêtre).
 */
const CALM_SCREEN_CLASS =
  "mx-auto flex min-h-[80vh] w-full max-w-5xl flex-col items-center justify-center gap-6 px-6 py-10 text-center";

/**
 * La locale UI depuis le loaderData du match racine, via l'état du router —
 * disponible PARTOUT où le router rend, y compris errorComponent /
 * notFoundComponent (qui rendent hors du LocaleProvider de RootComponent).
 * `normalizeLocale` absorbe un loaderData absent (erreur très tôt) → "fr",
 * jamais une exception dans un écran d'erreur.
 */
function useRootLocale(): Locale {
  return useRouterState({
    select: (s) =>
      normalizeLocale(
        (s.matches[0]?.loaderData as { locale?: unknown } | undefined)?.locale
      ),
  });
}

export const Route = createRootRoute({
  component: RootComponent,
  errorComponent: () => <EcranCalme variante="souci" />,
  head: ({ loaderData }) => {
    // Le titre d'onglet et la meta description suivent la locale UI (réglage
    // parent) et la marque posée en base (branding:* — env VITE_* en
    // secours), composées par le SERVEUR dans le loader. Repli générique si
    // le loader n'a rien fourni (erreur très tôt) — jamais une exception.
    const branding =
      loaderData?.branding ??
      buildBranding(normalizeLocale(loaderData?.locale), "");
    return {
      links: [
        { href: "https://fonts.googleapis.com", rel: "preconnect" },
        {
          crossOrigin: "anonymous",
          href: "https://fonts.gstatic.com",
          rel: "preconnect",
        },
        { href: appCss, rel: "stylesheet" },
        {
          href: "https://fonts.googleapis.com/css2?family=Quicksand:wght@400..700&display=swap",
          rel: "stylesheet",
        },
      ],
      meta: [
        { charSet: "utf-8" },
        {
          content: "width=device-width, initial-scale=1",
          name: "viewport",
        },
        { title: branding.name },
        {
          content: branding.description,
          name: "description",
        },
      ],
    };
  },
  // La locale UI ET la marque (réglages parent, table app_settings) entrent
  // dans l'app par CE loader et nulle part ailleurs. getShellContextFn ne
  // jette jamais (replis internes) — le shell rend toujours.
  // staleTime: Infinity : ces réglages ne changent que par /parents, qui
  // fait router.invalidate() ; un AUTRE onglet converge à son prochain
  // rechargement — le rechargement est la frontière de cohérence documentée.
  loader: () => getShellContextFn(),
  notFoundComponent: () => <EcranCalme variante="introuvable" />,
  staleTime: Number.POSITIVE_INFINITY,
});

/**
 * L'écran calme partagé erreur/404 — rendu HORS du LocaleProvider (le
 * router remplace le composant racine), d'où useRootLocale + le catalogue
 * lu directement.
 */
function EcranCalme({ variante }: { variante: "souci" | "introuvable" }) {
  const m = MESSAGES[useRootLocale()];
  return (
    <div className={CALM_SCREEN_CLASS}>
      <p className="text-4xl">{variante === "souci" ? "🌙" : "🐚"}</p>
      <h1 className="font-bold text-3xl">
        {variante === "souci"
          ? m.ecrans.soucisTitre
          : m.ecrans.pageIntrouvableTitre}
      </h1>
      {variante === "souci" ? (
        <p className="text-muted-foreground text-xl">{m.ecrans.soucisTexte}</p>
      ) : null}
      <a className="text-2xl text-primary underline" href="/">
        {m.ecrans.revenirAccueil}
      </a>
    </div>
  );
}

export function RootComponent() {
  // Shell route-aware (voix extérieure T5) : la couche bureau (portrait,
  // bureau, fenêtre) a besoin du plein-bleed ; /parents — hors de l'OS —
  // garde le conteneur d'origine. Fonctionne au SSR (l'état du router est
  // disponible côté serveur), donc aucun flash de shell.
  const estParents = useRouterState({
    select: (s) => s.location.pathname.startsWith("/parents"),
  });
  const locale = useRootLocale();
  return (
    <RootDocument conteneur={estParents} locale={locale}>
      <LocaleProvider locale={locale}>
        <Outlet />
        {/* La palette ⌘K vit ICI, et pas dans la gate session-fermée : c'est
            une porte PARENT (comme /parents), pas un élément du bureau — elle
            n'a donc rien à voir avec le rituel d'ouverture. Dans le
            LocaleProvider, parce qu'elle lit le catalogue ; hors du
            LocaleProvider (écrans erreur/404, qui remplacent le composant
            racine) elle ne rend simplement pas. */}
        <PaletteParent />
      </LocaleProvider>
    </RootDocument>
  );
}

export function RootDocument({
  children,
  conteneur,
  locale,
}: Readonly<{ children: ReactNode; conteneur: boolean; locale: Locale }>) {
  return (
    <html lang={locale}>
      <head>
        <HeadContent />
      </head>
      <body className="min-h-screen bg-background text-foreground antialiased">
        {conteneur ? (
          <div className="mx-auto min-h-screen max-w-5xl px-6 py-10">
            {children}
          </div>
        ) : (
          children
        )}
        <Toaster />
        <Scripts />
      </body>
    </html>
  );
}
