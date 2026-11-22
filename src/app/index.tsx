import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { Bureau } from "~/components/bureau/bureau";
import { EcranPortrait } from "~/components/bureau/portrait";
import {
  lireSessionOuverte,
  ouvrirSession,
  rangerBureau,
} from "~/lib/bureau/session";

export const Route = createFileRoute("/")({
  component: HomePage,
});

/**
 * Accueil — le bureau d'Arsène. REVIREMENT DOCUMENTÉ de la décision
 * eng-review « deliberately NOT a mini-app registry » (l'étagère à deux
 * portes) : le fait nouveau est la curiosité d'Arsène pour le vrai
 * ordinateur — le registre EST désormais la leçon (vie pratique Montessori :
 * le cadre devient le programme, design doc user-main-design-20260721).
 *
 * `/` rend l'écran-portrait OU le bureau selon la session — jamais de
 * redirect qui claque. La décision est 100 % CLIENT (le serveur ne lit pas
 * localStorage) : le composant choisit après montage, d'où le premier paint
 * en lavis nu — sinon mismatch d'hydratation ou flash du mauvais écran.
 * C'est ici le second des DEUX seuls emplacements de la gate session-fermée
 * (T2-A) — l'autre est la layout _bureau ; jamais __root.
 */
function HomePage() {
  const [etat, setEtat] = useState<"verification" | "portrait" | "bureau">(
    "verification"
  );
  useEffect(() => {
    setEtat(lireSessionOuverte() ? "bureau" : "portrait");
  }, []);

  if (etat === "verification") {
    // SSR + premier rendu client : le lavis calme, rien d'autre.
    return <div className="bureau-fond min-h-screen" />;
  }

  if (etat === "portrait") {
    return (
      <EcranPortrait
        onOuvrir={() => {
          ouvrirSession();
          setEtat("bureau");
        }}
      />
    );
  }

  return (
    <Bureau
      onRanger={() => {
        rangerBureau();
        setEtat("portrait");
      }}
    />
  );
}
