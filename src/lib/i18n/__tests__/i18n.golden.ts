/**
 * I18N assertion script — la locale UI et ses deux catalogues (plan
 * multilangue, phase 1). Same standalone-runnable pattern as
 * operations.golden.ts (no test runner in this app):
 *   bun run src/lib/i18n/__tests__/i18n.golden.ts
 * (wired as `bun run test:i18n`). Exits non-zero on any failure.
 * Pure modules (no env import) — no SKIP_ENV_VALIDATION needed.
 *
 * Ce que ces assertions verrouillent :
 *  - la PARITÉ des catalogues : mêmes chemins de clés fr↔en, chaque feuille
 *    une chaîne non vide — une clé ajoutée d'un seul côté casse ici (en plus
 *    du compilateur) ;
 *  - le scan CALME sur les DEUX catalogues (la contrainte non négociable,
 *    dans les deux langues) : jamais bravo/gagné/perdu/vite/erreur… côté FR,
 *    jamais well done/won/lost/hurry/wrong/score… côté EN ;
 *  - l'IDENTITÉ des octets FR déplacés : le passage au catalogue est un
 *    déplacement de littéraux, pas une réécriture — les libellés du bureau
 *    et des écrans calmes sont épinglés byte-exact ;
 *  - le branding par locale (buildBranding, cœur pur) : l'élision française
 *    (« d'Arsène » / « de Léa ») et le possessif anglais, avec leurs replis
 *    sans prénom ;
 *  - normalizeLocale : n'importe quelle valeur → une locale valide, strict
 *    sur "en", repli "fr" pour tout le reste (y compris "ru" et "EN").
 */

import { buildBranding } from "~/lib/i18n/branding";
import { normalizeLocale } from "~/lib/i18n/locale";
import { en } from "~/lib/i18n/messages/en";
import { fr } from "~/lib/i18n/messages/fr";

let failures = 0;
function check(name: string, ok: boolean, detail?: string) {
  if (ok) {
    console.log(`✓ ${name}`);
  } else {
    failures += 1;
    console.error(`✗ ${name}${detail ? `\n  ${detail}` : ""}`);
  }
}

// ── Parité des catalogues ────────────────────────────────────────────────────

interface Arbre {
  [clef: string]: string | Arbre;
}

function feuilles(arbre: Arbre, prefixe = ""): Map<string, string> {
  const resultat = new Map<string, string>();
  for (const [clef, valeur] of Object.entries(arbre)) {
    const chemin = prefixe ? `${prefixe}.${clef}` : clef;
    if (typeof valeur === "string") {
      resultat.set(chemin, valeur);
    } else {
      for (const [sous, texte] of feuilles(valeur, chemin)) {
        resultat.set(sous, texte);
      }
    }
  }
  return resultat;
}

const feuillesFr = feuilles(fr as unknown as Arbre);
const feuillesEn = feuilles(en as unknown as Arbre);

check(
  "parité : mêmes chemins de clés fr↔en",
  feuillesFr.size === feuillesEn.size &&
    [...feuillesFr.keys()].every((clef) => feuillesEn.has(clef)),
  `fr=${feuillesFr.size} en=${feuillesEn.size}`
);

for (const [nom, catalogue] of [
  ["fr", feuillesFr],
  ["en", feuillesEn],
] as const) {
  check(
    `${nom} : chaque feuille est une chaîne non vide`,
    [...catalogue.values()].every((texte) => texte.trim().length > 0)
  );
}

// ── Scan calme (les deux langues) ────────────────────────────────────────────
// Même idiome word-anchored que le scan des énoncés (operations.golden.ts).

const MOTS_INTERDITS_FR = [
  "bravo",
  "gagné",
  "perdu",
  "vite",
  "erreur",
  "faux",
  "point",
];
const MOTS_INTERDITS_EN = [
  "well done",
  "bravo",
  "won",
  "win",
  "lost",
  "lose",
  "hurry",
  "quick",
  "fast",
  "wrong",
  "score",
  "points?",
  "prize",
  "reward",
  "best",
];

function scanCalme(
  nom: string,
  catalogue: Map<string, string>,
  mots: string[]
) {
  const regex = new RegExp(`\\b(${mots.join("|")})\\b`, "i");
  for (const [chemin, texte] of catalogue) {
    const calme = !regex.test(texte);
    check(
      `calme ${nom} : ${chemin}`,
      calme,
      calme ? undefined : `« ${texte} »`
    );
  }
}

scanCalme("fr", feuillesFr, MOTS_INTERDITS_FR);
scanCalme("en", feuillesEn, MOTS_INTERDITS_EN);

// ── Identité des octets FR déplacés ──────────────────────────────────────────

const PINS_FR: readonly [string, string][] = [
  ["bureau.apps.bibliotheque", "Bibliothèque"],
  ["bureau.apps.calculs", "Calculs"],
  ["bureau.apps.histoires", "Histoires"],
  ["bureau.entrer", "Entrer"],
  ["bureau.fermerFenetre", "Fermer la fenêtre"],
  ["bureau.ranger", "Ranger le bureau"],
  ["ecrans.pageIntrouvableTitre", "Cette page n'existe pas"],
  ["ecrans.revenirAccueil", "Revenir à l'accueil"],
  ["ecrans.soucisTexte", "On range tout et on recommence dans un instant."],
  ["ecrans.soucisTitre", "Oups, un petit souci"],
];

for (const [chemin, attendu] of PINS_FR) {
  check(
    `identité fr : ${chemin}`,
    feuillesFr.get(chemin) === attendu,
    `attendu « ${attendu} », lu « ${feuillesFr.get(chemin)} »`
  );
}

// ── Branding par locale (cœur pur) ───────────────────────────────────────────

const brandingPins: readonly [string, string, string][] = [
  // [description du check, valeur calculée, attendu]
  [
    "fr élision voyelle",
    buildBranding("fr", "Arsène").name,
    "L'atelier d'Arsène",
  ],
  ["fr sans élision", buildBranding("fr", "Léa").name, "L'atelier de Léa"],
  [
    "fr storyLabel élidé",
    buildBranding("fr", "Arsène").storyLabel,
    "Une histoire d'Arsène",
  ],
  ["fr repli sans prénom", buildBranding("fr", "").name, "Le petit atelier"],
  [
    "fr repli storyLabel",
    buildBranding("fr", "").storyLabel,
    "Une petite histoire",
  ],
  [
    "fr description",
    buildBranding("fr", "").description,
    "Un endroit calme pour lire, inventer et calculer.",
  ],
  ["en possessif", buildBranding("en", "Léa").name, "Léa's workshop"],
  [
    "en storyLabel",
    buildBranding("en", "Arsène").storyLabel,
    "A story by Arsène",
  ],
  ["en repli sans prénom", buildBranding("en", "").name, "The little workshop"],
  ["en repli storyLabel", buildBranding("en", "").storyLabel, "A little story"],
  [
    "en description",
    buildBranding("en", "").description,
    "A calm place to read, imagine and count.",
  ],
];

for (const [nom, calcule, attendu] of brandingPins) {
  check(`branding ${nom}`, calcule === attendu, `lu « ${calcule} »`);
}

// ── normalizeLocale ──────────────────────────────────────────────────────────

const normalisations: readonly [unknown, string][] = [
  ["en", "en"],
  ["fr", "fr"],
  ["ru", "fr"],
  ["EN", "fr"],
  ["", "fr"],
  [null, "fr"],
  [undefined, "fr"],
  [42, "fr"],
];

for (const [entree, attendu] of normalisations) {
  check(
    `normalizeLocale(${JSON.stringify(entree)}) → "${attendu}"`,
    normalizeLocale(entree) === attendu
  );
}

// ── Verdict ──────────────────────────────────────────────────────────────────

if (failures > 0) {
  console.error(`\n${failures} assertion(s) i18n en échec.`);
  process.exit(1);
}
console.log("\nToutes les assertions i18n passent.");
