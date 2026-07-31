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
import { formatMessage } from "~/lib/i18n/format";
import { normalizeLocale } from "~/lib/i18n/locale";
import { en } from "~/lib/i18n/messages/en";
import { fr } from "~/lib/i18n/messages/fr";
import { FAMILLE_NOMS, FAMILLES, PALIERS } from "~/lib/operations";
import { ENTREES_PALETTE, type EntreePaletteId } from "~/lib/palette/entrees";

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
  ["calcul.ariaEffacer", "Effacer"],
  ["calcul.ariaReposerPlateau", "Reposer le plateau"],
  ["calcul.atelierRange", "L'atelier est rangé."],
  ["calcul.jaiFiniJeCompare", "J'ai fini, je compare"],
  ["calcul.plateauSuivant", "Plateau suivant"],
  ["calcul.prendrePlateau", "Prendre le plateau des {familles}"],
  ["calcul.rangerAtelier", "Ranger l'atelier"],
  ["calcul.serieEnCours", " — série en cours"],
  ["ecrans.pageIntrouvableTitre", "Cette page n'existe pas"],
  ["ecrans.revenirAccueil", "Revenir à l'accueil"],
  ["ecrans.soucisTexte", "On range tout et on recommence dans un instant."],
  ["ecrans.soucisTitre", "Oups, un petit souci"],
  [
    "parents.calcul.changerPalier",
    "Changer le palier range la série en cours.",
  ],
  [
    "parents.calcul.changerTaille",
    "Changer la taille range les séries en cours de toutes les familles.",
  ],
  [
    "parents.calcul.derniereFamille",
    "Au moins une famille reste sur l'étagère.",
  ],
  ["parents.calcul.enregistrement", "Enregistrement…"],
  ["parents.calcul.enregistrer", "Enregistrer"],
  ["parents.calcul.imprimerFiche", "Imprimer une fiche"],
  [
    "parents.calcul.nApparaitPas",
    "N'apparaît pas sur l'étagère. Désactiver oublie le palier choisi.",
  ],
  ["parents.calcul.operationsParSerie", "Opérations par série"],
  [
    "parents.calcul.rechargementEchoue",
    "Enregistré — le rechargement a échoué, recharge la page pour vérifier.",
  ],
  [
    "parents.calcul.reglagesIndisponibles",
    "Réglages indisponibles pour le moment — recharge la page dans un instant.",
  ],
  ["parents.calcul.titre", "Les calculs"],
  ["parents.calcul.titreFiche", "Des calculs à poser"],
  [
    "parents.enregistrementImpossible",
    "Enregistrement impossible pour le moment — réessaie.",
  ],
  ["parents.espaceParent", "Espace parent"],
];

for (const [chemin, attendu] of PINS_FR) {
  check(
    `identité fr : ${chemin}`,
    feuillesFr.get(chemin) === attendu,
    `attendu « ${attendu} », lu « ${feuillesFr.get(chemin)} »`
  );
}

// ── Libellés de la palette ⌘K ────────────────────────────────────────────────
// Chaque entrée du registre pur (lib/palette/entrees.ts) lit son libellé dans
// le catalogue, à la MÊME clé que la carte correspondante de /parents —
// renommer une clé de section ne doit pas laisser une entrée sans nom (le
// compilateur le voit dans le composant ; ici on l'épingle aussi côté données,
// dans les DEUX langues).
const CHEMIN_LIBELLE: Record<EntreePaletteId, string> = {
  accueil: "commun.accueil",
  calcul: "parents.index.sections.calcul.titre",
  doudous: "parents.index.sections.doudous.titre",
  elements: "parents.index.sections.elements.titre",
  espaceParent: "parents.espaceParent",
  heroes: "parents.index.sections.heroes.titre",
  imageModel: "parents.index.sections.imageModel.titre",
  lieux: "parents.index.sections.lieux.titre",
  reglages: "parents.index.sections.reglages.titre",
};

for (const entree of ENTREES_PALETTE) {
  const chemin = CHEMIN_LIBELLE[entree.id];
  for (const [nom, catalogue] of [
    ["fr", feuillesFr],
    ["en", feuillesEn],
  ] as const) {
    check(
      `palette ${nom} : ${entree.id} → ${chemin}`,
      (catalogue.get(chemin) ?? "").trim().length > 0
    );
  }
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

// ── Cohérence catalogue ↔ modules purs (phase 2, calcul) ─────────────────────
// Le catalogue fr est BYTE-IDENTIQUE aux références françaises des modules
// purs — l'aria du plateau et la page parent gardent leurs octets
// historiques, et une famille/un palier ajouté sans entrée de catalogue
// casse ici.

for (const op of FAMILLES) {
  check(
    `familles fr : catalogue ≡ FAMILLE_NOMS (${op})`,
    fr.calcul.familles[op] === FAMILLE_NOMS[op],
    `catalogue « ${fr.calcul.familles[op]} », lib « ${FAMILLE_NOMS[op]} »`
  );
}

{
  const paliersCatalogue: Record<string, string> = fr.parents.calcul.paliers;
  const paliersCatalogueEn: Record<string, string> = en.parents.calcul.paliers;
  for (const palier of PALIERS) {
    check(
      `palier fr : catalogue ≡ label du module (${palier.id})`,
      paliersCatalogue[palier.id] === palier.label,
      `catalogue « ${paliersCatalogue[palier.id]} », lib « ${palier.label} »`
    );
    check(
      `palier en : entrée présente et non vide (${palier.id})`,
      (paliersCatalogueEn[palier.id] ?? "").trim().length > 0
    );
  }
}

// ── formatMessage (composition des gabarits à trous) ─────────────────────────

check(
  "formatMessage : composition FR de l'aria plateau ≡ octets historiques",
  formatMessage(fr.calcul.prendrePlateau, {
    familles: fr.calcul.familles.addition,
  }) === "Prendre le plateau des additions"
);
check(
  "formatMessage : composition EN de l'aria plateau",
  formatMessage(en.calcul.prendrePlateau, {
    familles: en.calcul.familles.addition,
  }) === "Take the addition tray"
);
check(
  "formatMessage : trou sans valeur → chaîne vide, jamais d'exception",
  formatMessage("a {x} b", {}) === "a  b"
);

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
