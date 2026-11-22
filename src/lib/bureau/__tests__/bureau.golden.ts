/**
 * BUREAU assertion script — la couche OS calme (ceo-review D12-A).
 *
 * Pins the pure desktop-layer modules. Same standalone-runnable pattern as
 * operations.golden.ts (no test runner in this app):
 *   bun run src/lib/bureau/__tests__/bureau.golden.ts
 * (wired as `bun run test:bureau`). Exits non-zero on any failure.
 * Pure modules (no env import) — no SKIP_ENV_VALIDATION needed.
 *
 * Ce que ces assertions verrouillent :
 *  - le modifier de bornage (D23-A strict) : la barre de titre reste
 *    ENTIÈREMENT visible — bords, coins, viewport plus petit que la fenêtre,
 *    et le RE-bornage sur redimensionnement (D11-A) ;
 *  - la garde de forme de session : n'importe quel contenu de
 *    `bureau:session` → un booléen, jamais d'exception ;
 *  - le rituel de session complet (lire/ouvrir/ranger) sur un localStorage
 *    factice : clé stable, aller-retour, et le SILENCE en cas de panne de
 *    stockage — l'enfant ne voit jamais d'erreur ;
 *  - la machine à états de sélection de l'icône (D19-A, sans horloge —
 *    remplace la « fonction de seuil », supprimée par T5 : dblclick natif) :
 *    la sélection ne se perd JAMAIS sur un second clic, `ouverte` absorbe ;
 *  - l'identité du bureau (T4-A) : correspondance childName ↔ héros
 *    insensible à la casse et à l'élision.
 */

import { clampFenetrePosition, reclampCommitted } from "~/lib/bureau/clamp";
import { transitionIcone } from "~/lib/bureau/icone";
import type { EtatIcone, EvenementIcone } from "~/lib/bureau/icone";
import { matchesChildName } from "~/lib/bureau/identite";
import {
  estSessionOuverte,
  lireSessionOuverte,
  ouvrirSession,
  rangerBureau,
  SESSION_STORAGE_KEY,
} from "~/lib/bureau/session";

let failures = 0;
function check(name: string, ok: boolean, detail?: string) {
  if (ok) {
    console.log(`✓ ${name}`);
  } else {
    failures += 1;
    console.error(`✗ ${name}${detail ? `\n  ${detail}` : ""}`);
  }
}

/* ------------------------- Bornage de la fenêtre ------------------------- */

// Géométrie de référence : fenêtre 85 % d'un viewport 1600×1000, barre 56px.
const FENETRE = { height: 850, width: 1360 };
const VIEWPORT = { height: 1000, width: 1600 };
const BARRE = 56;

function clampe(x: number, y: number) {
  return clampFenetrePosition({ x, y }, FENETRE, VIEWPORT, BARRE);
}

const interieur = clampe(120, 75);
check(
  "clamp: une position intérieure est inchangée",
  interieur.x === 120 && interieur.y === 75
);
const gaucheHaut = clampe(-500, -500);
check(
  "clamp: coin haut-gauche — jamais de x/y négatif",
  gaucheHaut.x === 0 && gaucheHaut.y === 0
);
const droite = clampe(9999, 75);
check(
  "clamp: bord droit — la barre entière reste dans l'écran en largeur",
  droite.x === VIEWPORT.width - FENETRE.width,
  `x=${droite.x}`
);
const bas = clampe(120, 9999);
check(
  "clamp: bord bas — il reste toujours au moins la barre visible",
  bas.y === VIEWPORT.height - BARRE,
  `y=${bas.y}`
);
const coin = clampe(9999, 9999);
check(
  "clamp: coin bas-droit — les deux axes bornés ensemble",
  coin.x === 240 && coin.y === 944
);
const etroit = clampFenetrePosition(
  { x: 300, y: 40 },
  FENETRE,
  { height: 700, width: 900 },
  BARRE
);
check(
  "clamp: viewport plus étroit que la fenêtre → x=0 (alignée à gauche), jamais NaN",
  etroit.x === 0 && etroit.y === 40
);
// Re-bornage sur resize (D11-A) : une position valide AVANT le
// rétrécissement est re-bornée par le MÊME modifier pur.
const avant = clampe(240, 900);
const apres = clampFenetrePosition(
  avant,
  FENETRE,
  { height: 600, width: 1400 },
  BARRE
);
check(
  "clamp: re-bornage après rétrécissement du viewport (D11-A)",
  apres.x === 40 && apres.y === 600 - BARRE,
  `x=${apres.x} y=${apres.y}`
);
check(
  "clamp: viewport plus bas que la barre → y=0 (cas dégradé théorique)",
  clampFenetrePosition(
    { x: 0, y: 30 },
    FENETRE,
    { height: 40, width: 1600 },
    BARRE
  ).y === 0
);

/* ------------------- Re-bornage d'une position committée ------------------ */

// reclampCommitted = la discipline de commit du composant, écrite une fois :
// null-passthrough (fenêtre centrée par le CSS), no-op → MÊME référence
// (setPosition(prev => prev) ne re-rend pas), sinon le clamp D23-A.
check(
  "reclamp: position committée nulle (centrée CSS) → null, rien à re-borner",
  reclampCommitted(null, FENETRE, VIEWPORT, BARRE) === null
);
const committeeLoinDesBords = { x: 120, y: 75 };
check(
  "reclamp: no-op loin des bords → la MÊME référence (aucun re-rendu resize)",
  reclampCommitted(committeeLoinDesBords, FENETRE, VIEWPORT, BARRE) ===
    committeeLoinDesBords
);
const committeeAuBordExact = { x: 240, y: 944 };
check(
  "reclamp: déjà exactement sur la borne → toujours la même référence",
  reclampCommitted(committeeAuBordExact, FENETRE, VIEWPORT, BARRE) ===
    committeeAuBordExact
);
const committeeHorsBornes = { x: 9999, y: 9999 };
const rebornee = reclampCommitted(
  committeeHorsBornes,
  FENETRE,
  VIEWPORT,
  BARRE
);
check(
  "reclamp: hors bornes → NOUVELLE référence, bornée comme clampFenetrePosition",
  rebornee !== committeeHorsBornes &&
    rebornee?.x === 240 &&
    rebornee?.y === 944,
  `x=${rebornee?.x} y=${rebornee?.y}`
);
// Rétrécissement du viewport (D11-A) : le re-bornage committé suit le même
// modifier pur que le drag.
const retrecie = reclampCommitted(
  { x: 240, y: 900 },
  FENETRE,
  { height: 600, width: 1400 },
  BARRE
);
check(
  "reclamp: re-bornage après rétrécissement du viewport (D11-A)",
  retrecie?.x === 40 && retrecie?.y === 600 - BARRE,
  `x=${retrecie?.x} y=${retrecie?.y}`
);

/* ------------------------ Garde de forme de session ---------------------- */

check("session: absente (null) → fermée", estSessionOuverte(null) === false);
check("session: undefined → fermée", estSessionOuverte(undefined) === false);
check(
  "session: contenu corrompu (string) → fermée, sans exception",
  estSessionOuverte("n'importe quoi") === false
);
check("session: mauvais type (42) → fermée", estSessionOuverte(42) === false);
check("session: objet vide → fermée", estSessionOuverte({}) === false);
check(
  "session: ouverte:true littéral → ouverte",
  estSessionOuverte({ ouverte: true, v: 1 }) === true
);
check(
  "session: ouverte truthy mais non-true ('oui') → fermée",
  estSessionOuverte({ ouverte: "oui", v: 1 }) === false
);
check(
  "session: version FUTURE qui garde ouverte:true → toujours lisible",
  estSessionOuverte({ extra: { x: 1 }, ouverte: true, v: 99 }) === true
);
check("session: tableau → fermée", estSessionOuverte([true]) === false);

/* --------------- Rituel de session sur un localStorage factice ------------ */

// Le script bun n'a pas de DOM : un window factice suffit — les helpers ne
// touchent QUE window.localStorage, et c'est exactement ce qu'on épingle.
const memoire = new Map<string, string>();
const windowFactice = {
  localStorage: {
    getItem: (k: string) => memoire.get(k) ?? null,
    removeItem: (k: string) => {
      memoire.delete(k);
    },
    setItem: (k: string, v: string) => {
      memoire.set(k, v);
    },
  },
};
(globalThis as { window?: unknown }).window = windowFactice;

check(
  "session: clé de stockage stable (bureau:session)",
  SESSION_STORAGE_KEY === "bureau:session"
);
check(
  "session: stockage vide → fermée par défaut",
  lireSessionOuverte() === false
);
ouvrirSession();
check(
  "session: ouvrirSession → lue ouverte, sous la clé stable",
  lireSessionOuverte() === true && memoire.has(SESSION_STORAGE_KEY)
);
rangerBureau();
check(
  "session: rangerBureau → clé retirée, lue fermée",
  lireSessionOuverte() === false && !memoire.has(SESSION_STORAGE_KEY)
);
memoire.set(SESSION_STORAGE_KEY, "{pas du json");
check(
  "session: JSON corrompu dans le stockage → fermée, sans exception",
  lireSessionOuverte() === false
);

// Panne de stockage (quota, mode privé, désactivé) : SILENCE — aucun des
// trois helpers ne jette, et la session vit en MÉMOIRE le temps de l'onglet
// (repli du module ; sans lui la gate re-présenterait le portrait à chaque
// ouverture d'app — le rituel deviendrait une barrière répétée).
(globalThis as { window?: unknown }).window = {
  localStorage: {
    getItem: () => {
      throw new Error("panne");
    },
    removeItem: () => {
      throw new Error("panne");
    },
    setItem: () => {
      throw new Error("panne");
    },
  },
};
let panneSilencieuse = true;
let ouverteEnMemoire = false;
let rangeeEnMemoire = false;
try {
  ouvrirSession();
  ouverteEnMemoire = lireSessionOuverte();
  rangerBureau();
  rangeeEnMemoire = !lireSessionOuverte();
} catch {
  panneSilencieuse = false;
}
check(
  "session: stockage en panne → silence total, la session vit en mémoire",
  panneSilencieuse && ouverteEnMemoire && rangeeEnMemoire
);

// Le stub en panne est RESTAURÉ : les assertions ajoutées après cette
// section retrouvent un stockage qui marche (pas d'état global piégé).
(globalThis as { window?: unknown }).window = windowFactice;
ouvrirSession();
check(
  "session: après la panne, le stockage restauré fonctionne à nouveau",
  lireSessionOuverte() === true && memoire.has(SESSION_STORAGE_KEY)
);
rangerBureau();

/* ----------------- Machine à états de sélection de l'icône ---------------- */

const transitions: [EtatIcone, EvenementIcone, EtatIcone][] = [
  // repos : le premier clic sélectionne, Entrée et dblclick ouvrent direct.
  ["repos", "click", "selectionnee"],
  ["repos", "dblclick", "ouverte"],
  ["repos", "enter", "ouverte"],
  ["repos", "clickAilleurs", "repos"],
  // sélectionnée : la sélection ne se perd JAMAIS sur un second clic (le
  // double-clic raté laisse l'icône sélectionnée) ; ailleurs → repos.
  ["selectionnee", "click", "selectionnee"],
  ["selectionnee", "dblclick", "ouverte"],
  ["selectionnee", "enter", "ouverte"],
  ["selectionnee", "clickAilleurs", "repos"],
  // ouverte : absorbant — la navigation est en vol, rien ne la dispute.
  ["ouverte", "click", "ouverte"],
  ["ouverte", "dblclick", "ouverte"],
  ["ouverte", "enter", "ouverte"],
  ["ouverte", "clickAilleurs", "ouverte"],
];
for (const [etat, evenement, attendu] of transitions) {
  const obtenu = transitionIcone(etat, evenement);
  check(
    `icône: ${etat} + ${evenement} → ${attendu}`,
    obtenu === attendu,
    `obtenu: ${obtenu}`
  );
}
// La séquence du double-clic RÉEL (click, click, dblclick du système) finit
// ouverte en passant par sélectionnée — jamais par repos.
const seq: EvenementIcone[] = ["click", "click", "dblclick"];
// oxlint-disable-next-line unicorn/no-array-reduce -- le pli des transitions EST la séquence testée.
const final = seq.reduce<EtatIcone>(
  (e, evt) => transitionIcone(e, evt),
  "repos"
);
check(
  "icône: séquence native click,click,dblclick → ouverte",
  final === "ouverte"
);

/* --------------------------- Identité du bureau -------------------------- */

check(
  "identité: correspondance exacte",
  matchesChildName("Arsène", "Arsène") === true
);
check(
  "identité: insensible à la casse",
  matchesChildName("arsène", "ARSÈNE") === true
);
check(
  "identité: insensible à l'élision (d'Arsène ↔ Arsène)",
  matchesChildName("d'Arsène", "Arsène") === true &&
    matchesChildName("Arsène", "d’Arsène") === true
);
check(
  "identité: élision l' aussi (L'Étoile ↔ étoile)",
  matchesChildName("L'Étoile", "étoile") === true &&
    matchesChildName("l’étoile", "Étoile") === true
);
check(
  "identité: un autre héros ne correspond pas",
  matchesChildName("Jules", "Arsène") === false
);
check(
  "identité: prénom non configuré (vide) → jamais de correspondance",
  matchesChildName("Jules", "") === false && matchesChildName("", "") === false
);
check(
  "identité: espaces parasites tolérés",
  matchesChildName("  Arsène ", "Arsène") === true
);
check(
  "identité: accents décomposés (NFD) ↔ précomposés (NFC)",
  matchesChildName("Arsène", "Arsène") === true
);

/* -------------------------------- Verdict -------------------------------- */

if (failures > 0) {
  console.error(`\n${failures} assertion(s) bureau en échec.`);
  process.exit(1);
}
console.log("\nToutes les assertions bureau passent.");
