import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ChevronRight, Home } from "lucide-react";
import { useState } from "react";
import { Button } from "~/components/ui/button";
import {
  LOCALE_LABELS,
  LOCALES,
  type Locale,
  useLocale,
  useMessages,
} from "~/lib/i18n";
import { saveUiLocaleFn } from "~/server/settings-functions";

export const Route = createFileRoute("/parents/")({
  component: ParentsIndexPage,
});

// The parent-facing sub-pages. URL-only section (not linked from the child
// flow); this index is the one landing that gathers them. Each card mirrors the
// emoji + one-line description style of the lists inside each sub-page; title +
// description come from the catalog (parents.index.sections) via `key`.
const SECTIONS = [
  { emoji: "🧒", key: "heroes", to: "/parents/heroes" },
  { emoji: "📍", key: "lieux", to: "/parents/lieux" },
  { emoji: "✨", key: "elements", to: "/parents/elements" },
  { emoji: "🧸", key: "doudous", to: "/parents/doudous" },
  { emoji: "🔢", key: "calcul", to: "/parents/calcul" },
  { emoji: "🎨", key: "imageModel", to: "/parents/image-model" },
  { emoji: "🔧", key: "reglages", to: "/parents/reglages" },
] as const;

/**
 * Parent-only landing (URL-only, NOT linked from the child flow) that gathers
 * the four management sub-pages. Calm, utilitarian, same soft/rounded look as
 * the rest of the app — one card per section with its emoji + a one-line hint.
 */
function ParentsIndexPage() {
  const m = useMessages();
  return (
    <div className="mx-auto w-full max-w-3xl space-y-8">
      <div>
        <Button
          className="gap-2 text-lg text-muted-foreground"
          nativeButton={false}
          render={<Link to="/" />}
          variant="ghost"
        >
          <Home className="size-5" />
          {m.commun.accueil}
        </Button>
      </div>

      <div className="space-y-2">
        <h1 className="font-bold text-3xl">{m.parents.espaceParent}</h1>
        <p className="text-muted-foreground">{m.parents.index.intro}</p>
      </div>

      <ul className="space-y-3">
        {SECTIONS.map((section) => {
          const card = m.parents.index.sections[section.key];
          return (
            <li key={section.to}>
              <Link
                className="flex items-center gap-4 rounded-2xl border bg-card p-5 transition-all hover:-translate-y-0.5 hover:border-primary/50"
                to={section.to}
              >
                <span aria-hidden="true" className="text-4xl leading-none">
                  {section.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-xl">{card.titre}</p>
                  <p className="text-muted-foreground text-sm">
                    {card.description}
                  </p>
                </div>
                <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          );
        })}
      </ul>

      <SectionLangue />

      {/* Le rappel du raccourci vit ICI, côté parent, et nulle part dans la
          couche enfant : la palette reste une porte discrète, comme /parents. */}
      <p className="text-muted-foreground text-sm">{m.palette.indice}</p>
    </div>
  );
}

/**
 * Le réglage de langue de l'atelier — inline sur cette page (deux options,
 * pas de sous-page). Enregistré en DB (app_settings) puis router.invalidate()
 * relance le loader racine : toute l'interface bascule sans rechargement.
 * L'échec reste calme et local (le libellé vient du catalogue client — le
 * serveur ne renvoie qu'un booléen). Les autonymes « Français » / « English »
 * ne sont jamais traduits.
 */
function SectionLangue() {
  const locale = useLocale();
  const m = useMessages();
  const router = useRouter();
  const [etat, setEtat] = useState<"repos" | "enregistre" | "impossible">(
    "repos"
  );

  async function choisir(cible: Locale) {
    if (cible === locale) {
      return;
    }
    const result = await saveUiLocaleFn({ data: { locale: cible } });
    if (result.success) {
      setEtat("enregistre");
      await router.invalidate();
    } else {
      setEtat("impossible");
    }
  }

  return (
    <div className="flex items-center gap-4 rounded-2xl border bg-card p-5">
      <span aria-hidden="true" className="text-4xl leading-none">
        🌍
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-xl">{m.parents.langue.titre}</p>
        <p className="text-muted-foreground text-sm">{m.parents.langue.hint}</p>
        {etat === "enregistre" ? (
          <p className="text-muted-foreground text-sm">
            {m.parents.langue.enregistre}
          </p>
        ) : null}
        {etat === "impossible" ? (
          <p className="text-muted-foreground text-sm">
            {m.parents.enregistrementImpossible}
          </p>
        ) : null}
      </div>
      <div className="flex shrink-0 gap-2">
        {LOCALES.map((option) => (
          <Button
            key={option}
            onClick={() => choisir(option)}
            variant={option === locale ? "default" : "outline"}
          >
            {LOCALE_LABELS[option]}
          </Button>
        ))}
      </div>
    </div>
  );
}
