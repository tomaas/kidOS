import {
  createFileRoute,
  Outlet,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { appPourChemin } from "~/components/bureau/apps";
import { Fenetre } from "~/components/bureau/fenetre";
import { EcranPortrait } from "~/components/bureau/portrait";
import { lireSessionOuverte, ouvrirSession } from "~/lib/bureau/session";
import { useMessages } from "~/lib/i18n";

/**
 * La route layout pathless du bureau : le CADRE fenêtre autour des trois
 * mini-apps (préfixe `_` = layout sans segment d'URL — les chemins publics
 * /aventure, /calcul, /bibliotheque sont INCHANGÉS ; seuls les fichiers ont
 * déménagé, prémisse 6).
 *
 * Contrat de la layout (eng-review D17-A) — NE PAS poser `ssr: false` ici :
 * la config Selective SSR de TanStack est héritée vers le bas et ne peut que
 * se restreindre — un `ssr: false` rendrait silencieusement les trois
 * mini-apps client-only, exactement le comportement que la prémisse 6 promet
 * intouché. Le cadre fenêtre rend donc SSR-safe (centrage CSS, aucune
 * lecture de window pendant le rendu).
 *
 * La gate session-fermée (ceo-review T2-A) vit à exactement DEUX endroits :
 * ICI et `/` — jamais dans __root (sinon /parents et /data/$ seraient
 * gatés). Politique de flash (eng-review D22-A) : les enfants rendent
 * OPTIMISTEMENT — le SSR des mini-apps reste visible au premier paint, le
 * portrait ne se SUPERPOSE que quand la vérification client dit « session
 * fermée ». Le seul flash accepté est le lien profond à session fermée
 * (rare) — jamais le chemin quotidien session-ouverte.
 */
export const Route = createFileRoute("/_bureau")({
  component: BureauLayout,
});

function BureauLayout() {
  const m = useMessages();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  // Le titre de la fenêtre = le libellé de l'icône du bureau + son
  // pictogramme, depuis le registre UNIQUE (components/bureau/apps.tsx) —
  // même clé de catalogue que l'icône (m.bureau.apps[id]).
  const app = appPourChemin(pathname);
  const Pictogramme = app.icone;
  // false au SSR et au premier rendu client (rendu optimiste D22-A) ; la
  // vérification est 100 % client — le serveur ne lit pas localStorage.
  const [gateFermee, setGateFermee] = useState(false);
  useEffect(() => {
    setGateFermee(!lireSessionOuverte());
  }, []);

  return (
    <>
      {/* `inert` sous le portrait : la fenêtre recouverte sort de l'ordre de
          tabulation et des lecteurs d'écran tant que la gate est fermée — le
          rituel n'est pas une sécurité, mais Tab ne doit pas cliquer derrière
          un écran opaque (passes adversariales, cross-model). */}
      <div inert={gateFermee || undefined}>
        <Fenetre
          icone={<Pictogramme className="size-5" />}
          titre={m.bureau.apps[app.id]}
        >
          <Outlet />
        </Fenetre>
      </div>
      {gateFermee ? (
        <EcranPortrait
          onOuvrir={() => {
            ouvrirSession();
            setGateFermee(false);
          }}
        />
      ) : null}
    </>
  );
}
