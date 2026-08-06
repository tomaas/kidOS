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
 * chaque entrée vise une URL réellement servie, aucune ne raccourcit vers
 * une mini-app du bureau (la palette est une porte parent, pas un raccourci
 * enfant), et l'ensemble canonique des ids est figé — une entrée supprimée
 * ne peut pas passer inaperçue.
 *
 * Épingle AUSSI le registre des apps du bureau (components/bureau/apps.tsx) :
 * l'ensemble canonique des 4 icônes et leurs chemins servis — supprimer une
 * icône rendrait sa mini-app inatteignable par sa porte enfant sans faire
 * échouer aucun golden.
 *
 * Épingle ENFIN la coquille /parents (panneau latéral) : le registre pur des
 * sections (lib/parents/sections.ts) vise des URLs servies, la route layout
 * `/parents` re-parente ses 9 enfants, aucune option `ssr:` sous
 * src/app/parents/**, et l'ancien hub `/parents/` redirige vers
 * /parents/reglages (cible servie).
 *   bun run src/lib/bureau/__tests__/routes.golden.ts
 * (wired as `bun run test:routes`). Exits non-zero on any failure.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { APPS_BUREAU } from "~/components/bureau/apps";
import { ENTREES_PALETTE } from "~/lib/palette/entrees";
import { SECTIONS_PARENTS } from "~/lib/parents/sections";

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
  "/sudoku/",
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
  'createFileRoute("/_bureau/sudoku/")',
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
  ["/aventure", "/calcul", "/sudoku", "/bibliotheque"].some(
    (prefixe) => e.to === prefixe || e.to.startsWith(`${prefixe}/`)
  )
);
check(
  "palette : aucun raccourci vers une mini-app du bureau",
  versMiniApp.length === 0,
  versMiniApp.map((e) => e.to).join(", ")
);

// L'ensemble canonique des DIX entrées — sans cette pin, un registre vidé ou
// amputé (l'entrée /parents/sudoku supprimée, par exemple) rendrait les
// boucles ci-dessus vacantes et laisserait tous les goldens verts alors
// qu'une porte parent a disparu.
const IDS_PALETTE_ATTENDUS =
  "accueil, calcul, doudous, elements, espaceParent, heroes, imageModel, lieux, reglages, sudoku";
check(
  "palette : l'ensemble canonique des 10 ids",
  [...idsPalette].sort().join(", ") === IDS_PALETTE_ATTENDUS,
  idsPalette.join(", ")
);

/* ------------------- Les icônes du bureau (APPS_BUREAU) ------------------- */

// Chaque icône du bureau doit viser une URL RÉELLEMENT servie — même
// technique que la palette, l'arbre généré tranche. Tolérance sur la barre
// finale : le router sert /calcul comme `/calcul/`.
for (const app of APPS_BUREAU) {
  check(
    `icône bureau → URL servie: ${app.to}`,
    routeTree.includes(`fullPath: '${app.to}'`) ||
      routeTree.includes(`fullPath: '${app.to}/'`)
  );
}

// L'ensemble canonique des QUATRE apps — la porte ENFANT de chaque mini-app.
// Sans cette pin, supprimer l'icône sudoku laisserait la boucle ci-dessus
// vacante (zéro itération, zéro échec) et l'app deviendrait inatteignable
// dans la grammaire enfant sans qu'aucun golden n'échoue.
const idsBureau = APPS_BUREAU.map((a) => a.id);
const IDS_BUREAU_ATTENDUS = "bibliotheque, calculs, histoires, sudoku";
check(
  "bureau : l'ensemble canonique des 4 apps",
  [...idsBureau].sort().join(", ") === IDS_BUREAU_ATTENDUS,
  idsBureau.join(", ")
);

/* ---------------- La coquille /parents (panneau latéral) ------------------ */

// Retrait des commentaires avant un scan de source : un fragment commenté
// (un `redirect(...)` désactivé, un `ssr:` cité en prose) ne compte pas.
const BLOCS_COMMENTAIRES = /\/\*[\s\S]*?\*\//g;
const LIGNES_COMMENTAIRES = /\/\/[^\n]*/g;
function sansCommentaires(code: string): string {
  return code.replace(BLOCS_COMMENTAIRES, "").replace(LIGNES_COMMENTAIRES, "");
}

// Le registre pur des sections (lib/parents/sections.ts) nourrit la sidebar :
// chaque section vise une URL RÉELLEMENT servie — même technique que la
// palette, l'arbre généré tranche.
for (const section of SECTIONS_PARENTS) {
  check(
    `sections parents → URL servie: ${section.to}`,
    routeTree.includes(`fullPath: '${section.to}'`) ||
      routeTree.includes(`fullPath: '${section.to}/'`)
  );
}

// Les ids sont uniques (ils servent de clé de libellé ET de clé React).
const idsSections = SECTIONS_PARENTS.map((s) => s.id);
check(
  "sections parents : ids uniques",
  new Set(idsSections).size === idsSections.length,
  idsSections.join(", ")
);

// L'ensemble canonique des HUIT sections — sans cette pin, un registre vidé
// ou amputé rendrait la boucle d'URLs ci-dessus vacante (zéro itération,
// zéro échec) et l'unicité trivialement vraie.
const IDS_SECTIONS_ATTENDUS =
  "calcul, doudous, elements, heroes, imageModel, lieux, reglages, sudoku";
check(
  "sections parents : l'ensemble canonique des 8 ids",
  [...idsSections].sort().join(", ") === IDS_SECTIONS_ATTENDUS,
  idsSections.join(", ")
);

// Cohérence des registres : chaque section de la sidebar a son entrée dans
// la palette ⌘K (la palette est un SUR-ensemble — elle ajoute accueil et
// espaceParent) ; l'id partagé est aussi la clé de libellé commune.
const idsPaletteSet = new Set<string>(idsPalette);
const sectionsSansEntree = idsSections.filter((id) => !idsPaletteSet.has(id));
check(
  "chaque section parents a son entrée palette (même id)",
  sectionsSansEntree.length === 0,
  sectionsSansEntree.join(", ")
);

// La route layout /parents existe (id '/parents') et re-parente ses 9
// enfants (8 sections + l'index de redirection) — l'empreinte textuelle est
// `parentRoute: typeof ParentsRouteRoute` dans le bloc declare module.
check("la layout /parents existe (id)", routeTree.includes("id: '/parents'"));
const ENFANTS_PARENTS_ATTENDUS = 9;
const enfantsParents = routeTree.match(
  /parentRoute: typeof ParentsRouteRoute\b/g
);
check(
  `la layout /parents re-parente ses ${ENFANTS_PARENTS_ATTENDUS} enfants`,
  (enfantsParents?.length ?? 0) === ENFANTS_PARENTS_ATTENDUS,
  `trouvé ${enfantsParents?.length ?? 0} occurrence(s)`
);

// L'ancien hub est une REDIRECTION : /parents/ atterrit sur les réglages, et
// la cible est bien une URL servie (une réécriture de la cible casse ici).
const indexParents = readFileSync("src/app/parents/index.tsx", "utf8");
check(
  "/parents/ redirige vers /parents/reglages",
  // Commentaires retirés d'abord : un `redirect(...)` commenté ne compte pas.
  sansCommentaires(indexParents).includes(
    'redirect({ to: "/parents/reglages" })'
  )
);
check(
  "la cible de la redirection est une URL servie",
  routeTree.includes("fullPath: '/parents/reglages'")
);

/* --------------- Contrats prose → épinglés (D17-A + T2-A) ----------------- */

// (D17-A) Selective SSR : AUCUNE option `ssr:` sous src/app/_bureau/** — la
// config SSR de TanStack est héritée vers le bas et ne peut que se
// restreindre ; un `ssr: false` posé sur la layout (ou n'importe quelle
// route enfant) rendrait silencieusement les mini-apps client-only. Le scan
// retire d'abord les commentaires : le contrat vit AUSSI en prose dans
// route.tsx, qui cite « ssr: false » précisément pour l'interdire.
const OPTION_SSR = /\bssr\s*:/;
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

// Même contrat pour la coquille /parents : la layout (route.tsx) est le
// parent de TOUTES les pages parent — un `ssr: false` posé là rendrait
// silencieusement tout l'espace parent client-only.
const sousParents = sources.filter((s) =>
  s.path.startsWith("src/app/parents/")
);
const avecOptionSsrParents = sousParents.filter((s) =>
  OPTION_SSR.test(sansCommentaires(s.contenu))
);
check(
  "contrat: aucune option `ssr:` sous src/app/parents/** (héritage Selective SSR)",
  sousParents.length > 0 && avecOptionSsrParents.length === 0,
  avecOptionSsrParents.map((s) => s.path).join(", ") ||
    "aucun fichier scanné sous src/app/parents/"
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
