/**
 * L'écran-portrait — la « session » du bureau, un geste, jamais une barrière
 * (prémisse 3) : pas de mot de passe, pas d'état d'échec possible. La machine
 * accueille l'enfant ; elle ne rapporte jamais sur lui (aucun « dernière
 * connexion », aucun historique).
 *
 * Identité (ceo-review T4-A) : l'utilisateur du bureau est le PRÉNOM
 * CONFIGURÉ (childName) et le portrait est le héros dont le nom correspond
 * (comparaison insensible à la casse et à l'élision) — jamais « le premier
 * héros de la table ». Le chargement est client et silencieux : une DB
 * injoignable ou une image qui 404 tombent sur le repli emoji (ceo-review
 * D10-A `onError`) — l'écran de démarrage ne peut jamais montrer un glyphe
 * d'image cassée.
 */

import { getRouteApi } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { matchesChildName } from "~/lib/bureau/identite";
import { useMessages } from "~/lib/i18n";
import { listHeroesFn } from "~/server/heroes-functions";
import { isRenderableImagePath } from "~/server/providers/types";

interface PortraitInfo {
  emoji: string | null;
  imagePath: string | null;
}

// Le prénom et la marque viennent du loader RACINE (réglage parent en base,
// VITE_* du déploiement en secours) — plus jamais une constante de build :
// renommer l'enfant s'applique au prochain rechargement, sans rebuild.
const rootRoute = getRouteApi("__root__");

export function EcranPortrait({ onOuvrir }: { onOuvrir: () => void }) {
  const { branding, brandingSource } = rootRoute.useLoaderData();
  const childName = brandingSource.childName.trim();
  const m = useMessages();
  const [portrait, setPortrait] = useState<PortraitInfo | null>(null);
  const [imageCassee, setImageCassee] = useState(false);

  useEffect(() => {
    let annule = false;
    listHeroesFn()
      .then((heroes) => {
        const hero = heroes.find((h) => matchesChildName(h.label, childName));
        if (!annule && hero) {
          setPortrait({ emoji: hero.emoji, imagePath: hero.imagePath });
        }
      })
      .catch(() => {
        // DB injoignable — le repli emoji accueille aussi bien.
      });
    return () => {
      annule = true;
    };
  }, []);

  const imageUtilisable =
    !imageCassee &&
    portrait !== null &&
    isRenderableImagePath(portrait.imagePath);

  return (
    <div className="bureau-fond fixed inset-0 z-50 flex flex-col items-center justify-center gap-10">
      <button
        className="group flex cursor-pointer flex-col items-center gap-6 rounded-[3rem] p-8 outline-none focus-visible:ring-4 focus-visible:ring-ring"
        onClick={onOuvrir}
        type="button"
      >
        <span className="flex size-44 items-center justify-center overflow-hidden rounded-full border-4 border-border bg-card shadow-lg transition-transform duration-300 group-hover:scale-105 motion-reduce:transition-none">
          {imageUtilisable && portrait.imagePath ? (
            // biome-ignore lint/a11y/noNoninteractiveElementInteractions: onError n'est pas une interaction — c'est le repli D10-A (image cassée → emoji, jamais de glyphe cassé au boot).
            <img
              alt=""
              className="size-full object-cover"
              height={176}
              onError={() => setImageCassee(true)}
              src={portrait.imagePath}
              width={176}
            />
          ) : (
            <span aria-hidden="true" className="text-7xl">
              {portrait?.emoji ?? "🌟"}
            </span>
          )}
        </span>
        <span className="font-bold text-4xl">{childName || branding.name}</span>
        <span className="text-muted-foreground text-xl">{m.bureau.entrer}</span>
      </button>
    </div>
  );
}
