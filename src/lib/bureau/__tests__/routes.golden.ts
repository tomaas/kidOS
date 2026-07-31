/**
 * ROUTES assertion script — intégrité des URLs publiques (eng-review D24-A).
 *
 * La relocalisation des mini-apps sous `src/app/_bureau/` (préfixe `_` =
 * layout sans segment d'URL) ne doit changer AUCUNE URL publique, et aucun
 * id d'ancienne route ne doit subsister. Vérification TEXTUELLE sur
 * routeTree.gen.ts + les fichiers de src/app : importer le vrai routeTree
 * tirerait l'env serveur et le CSS — hors de portée d'un script bun pur.
 *
 * Épingle AUSSI les destinations de la palette ⌘K (lib/palette/entrees.ts) :
 * chaque entrée vise une URL réellement servie, et aucune ne raccourcit vers
 * une mini-app du bureau (la palette est une porte parent, pas un raccourci
 * enfant).
 *   bun run src/lib/bureau/__tests__/routes.golden.ts
 * (wired as `bun run test:routes`). Exits non-zero on any failure.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { ENTREES_PALETTE } from "~/lib/palette/entrees";

let failures = 0;
function check(name: string, ok: boolean, detail?: string) {
  if (ok) {
    console.log(`✓ ${name}`);
  } else {
    failures += 1;
    console.error(`✗ ${name}${detail ? `\n  ${detail}` : ""}`);
  }
}

const routeTree = readFileSync("src/routeTree.gen.ts", "utf8");

/* --------------------- Les URLs publiques, inchangées --------------------- */

// Chaque chemin doit exister comme fullPath dans l'arbre généré — la ligne
// `fullPath: '/aventure/'` est l'empreinte de l'URL réellement servie.
const URLS_PUBLIQUES = [
  "/",
  "/aventure/",
  "/aventure/$id",
  "/calcul/",
  "/bibliotheque",
  "/parents/",
  "/parents/calcul",
  "/data/$",
];
for (const url of URLS_PUBLIQUES) {
  check(
    `URL publique inchangée: ${url}`,
    routeTree.includes(`fullPath: '${url}'`)
  );
}

// La layout est bien pathless : `/_bureau` existe comme id mais n'introduit
// AUCUN segment d'URL (aucun fullPath ne commence par /_bureau).
check("la layout _bureau existe (id) …", routeTree.includes("id: '/_bureau'"));
check(
  "… et n'apparaît dans aucune URL (pathless)",
  !routeTree.includes("fullPath: '/_bureau")
);

/* ------------------- Aucun id d'ancienne route résiduel ------------------- */

// Les ids des routes déménagées ont été RÉÉCRITS (D24-A) : plus aucun
// createFileRoute avec un ancien id, nulle part sous src/app.
const ANCIENS_IDS = [
  'createFileRoute("/aventure/")',
  'createFileRoute("/aventure/$id")',
  'createFileRoute("/calcul/")',
  'createFileRoute("/bibliotheque")',
];
const NOUVEAUX_IDS = [
  'createFileRoute("/_bureau/aventure/")',
  'createFileRoute("/_bureau/aventure/$id")',
  'createFileRoute("/_bureau/calcul/")',
  'createFileRoute("/_bureau/bibliotheque")',
];

function listeFichiers(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? listeFichiers(path) : [path];
  });
}

const sources = listeFichiers("src/app")
  .filter((p) => p.endsWith(".tsx") || p.endsWith(".ts"))
  .map((p) => ({ contenu: readFileSync(p, "utf8"), path: p }));

for (const ancien of ANCIENS_IDS) {
  const restes = sources.filter((s) => s.contenu.includes(ancien));
  check(
    `aucun id d'ancienne route résiduel: ${ancien}`,
    restes.length === 0,
    restes.map((r) => r.path).join(", ")
  );
}
for (const nouveau of NOUVEAUX_IDS) {
  check(
    `id réécrit présent: ${nouveau}`,
    sources.some((s) => s.contenu.includes(nouveau))
  );
}

// Les anciens emplacements de fichiers n'existent plus (le déménagement est
// complet, pas une copie).
for (const ancien of [
  "src/app/aventure",
  "src/app/calcul",
  "src/app/bibliotheque.tsx",
]) {
  check(`ancien emplacement disparu: ${ancien}`, !existsSync(ancien));
}

// /parents reste HORS de l'OS : aucune route parents sous _bureau.
check(
  "/parents hors de l'OS (jamais sous _bureau)",
  !(
    existsSync("src/app/_bureau/parents") ||
    routeTree.includes("'/_bureau/parents")
  )
);

/* ------------------ Les destinations de la palette ⌘K --------------------- */

// Chaque entrée de la palette doit viser une URL RÉELLEMENT servie : le
// registre (lib/palette/entrees.ts) est typé, mais un renommage de route
// passerait au travers si le type était élargi — l'arbre généré tranche.
// Tolérance sur la barre finale : le router sert /parents comme `/parents/`.
for (const entree of ENTREES_PALETTE) {
  check(
    `palette → URL servie: ${entree.to}`,
    routeTree.includes(`fullPath: '${entree.to}'`) ||
      routeTree.includes(`fullPath: '${entree.to}/'`)
  );
}

// Les ids sont uniques (ils servent de `value` cmdk ET de clé de libellé).
const idsPalette = ENTREES_PALETTE.map((e) => e.id);
check(
  "palette : ids uniques",
  new Set(idsPalette).size === idsPalette.length,
  idsPalette.join(", ")
);

// La palette est une porte PARENT : elle ne raccourcit JAMAIS vers une
// mini-app du bureau (l'enfant les ouvre par leur icône, jamais au clavier).
const versMiniApp = ENTREES_PALETTE.filter((e) =>
  ["/aventure", "/calcul", "/bibliotheque"].some(
    (prefixe) => e.to === prefixe || e.to.startsWith(`${prefixe}/`)
  )
);
check(
  "palette : aucun raccourci vers une mini-app du bureau",
  versMiniApp.length === 0,
  versMiniApp.map((e) => e.to).join(", ")
);

/* --------------- Contrats prose → épinglés (D17-A + T2-A) ----------------- */

// (D17-A) Selective SSR : AUCUNE option `ssr:` sous src/app/_bureau/** — la
// config SSR de TanStack est héritée vers le bas et ne peut que se
// restreindre ; un `ssr: false` posé sur la layout (ou n'importe quelle
// route enfant) rendrait silencieusement les mini-apps client-only. Le scan
// retire d'abord les commentaires : le contrat vit AUSSI en prose dans
// route.tsx, qui cite « ssr: false » précisément pour l'interdire.
const BLOCS_COMMENTAIRES = /\/\*[\s\S]*?\*\//g;
const LIGNES_COMMENTAIRES = /\/\/[^\n]*/g;
const OPTION_SSR = /\bssr\s*:/;
function sansCommentaires(code: string): string {
  return code.replace(BLOCS_COMMENTAIRES, "").replace(LIGNES_COMMENTAIRES, "");
}
const sousBureau = sources.filter((s) => s.path.startsWith("src/app/_bureau/"));
const avecOptionSsr = sousBureau.filter((s) =>
  OPTION_SSR.test(sansCommentaires(s.contenu))
);
check(
  "contrat D17-A: aucune option `ssr:` sous src/app/_bureau/** (héritage Selective SSR)",
  sousBureau.length > 0 && avecOptionSsr.length === 0,
  avecOptionSsr.map((s) => s.path).join(", ") ||
    "aucun fichier scanné sous src/app/_bureau/"
);

// (T2-A) La gate session-fermée vit à exactement DEUX endroits : `/` et la
// layout _bureau — jamais __root, sinon /parents et /data/$ seraient gatés.
// L'empreinte textuelle est l'APPEL `lireSessionOuverte(` (session.ts), hors
// commentaires — la seule présence du token (ligne d'import, prose) ne
// suffit pas : garder l'import en supprimant l'appel doit faire échouer.
const APPEL_GATE = /\blireSessionOuverte\s*\(/;
const EMPLACEMENTS_GATE = ["src/app/_bureau/route.tsx", "src/app/index.tsx"];
const fichiersGate = sources
  .filter((s) => APPEL_GATE.test(sansCommentaires(s.contenu)))
  .map((s) => s.path)
  // Tri par code units (pas localeCompare) : l'ordre attendu est celui des
  // littéraux d'EMPLACEMENTS_GATE, indépendant de la locale de la machine.
  .sort((a, b) => (a < b ? -1 : 1));
check(
  "contrat T2-A: la gate (lireSessionOuverte) vit à exactement DEUX endroits — / et la layout _bureau, jamais __root",
  fichiersGate.length === EMPLACEMENTS_GATE.length &&
    EMPLACEMENTS_GATE.every((p, i) => fichiersGate[i] === p),
  `trouvée dans: ${fichiersGate.join(", ") || "(nulle part)"}`
);

/* -------------------------------- Verdict -------------------------------- */

if (failures > 0) {
  console.error(`\n${failures} assertion(s) routes en échec.`);
  process.exit(1);
}
console.log("\nToutes les assertions routes passent.");
