# Plan — rendre le bureau et ses mini-apps multilingues (FR + EN)

Date : 2026-07-29 · Statut : proposition (aucun code modifié)
Base : audit complet par 4 agents parallèles (UI, pipeline histoires, calcul/persistance, tests/env/routes).

---

## TL;DR

L'app a déjà **la moitié d'un axe langue côté serveur** — et **zéro i18n côté UI** :

- Existe déjà : `Lang = "fr" | "ru"` (`src/server/providers/types.ts:3`), colonne
  `stories.lang` (default `"fr"`), env `DEFAULT_LANG`, `PublicFlags.defaultLang`
  (plombé jusqu'au client mais **jamais lu** — code mort prêt à servir),
  `buildSystem(lang)` et l'arc branchent déjà fr/ru, la carte des voix TTS est
  un `Record<Lang, string>`.
- N'existe pas : catalogue de messages UI (~230 littéraux français inline),
  gating des aides à la lecture (phonétique 100 % FR, invoquée sans condition),
  langue dans le prompt d'illustration, énoncés calcul EN, `<html lang>` dynamique.

Stratégie : **les goldens FR deviennent le filet de sécurité du refactor** — on
extrait des « packs de langue » en gardant les octets FR strictement identiques
(les goldens existants passent sans modification), puis on ajoute des goldens EN
parallèles. Aucune URL ne change (`/aventure`, `/calcul`, `/bibliotheque` restent
telles quelles — `test:routes` intact).

---

## Décisions recommandées (avec alternatives)

| # | Décision | Recommandation | Alternative écartée |
|---|---|---|---|
| D1 | Où vit la langue de l'app | **Réglage parent** dans /parents, persisté en DB (nouvelle table `app_settings`, clé/valeur minimale), fallback `DEFAULT_LANG`. Changement sans rebuild ni restart. | Env-only (`DEFAULT_LANG` étendu à `"en"`) : moins de travail (le canal `getPublicFlags` existe déjà) mais exige un restart pour changer. Acceptable comme **étape 1 livrable** avant le toggle parent. |
| D2 | Granularité | **UI = langue globale ; histoire = `stories.lang` figé à la création** (défaut = langue UI). Une histoire FR rouverte reste FR (aides lecture, TTS, image) même si l'UI passe EN. La bibliothèque peut mélanger. | Langue par histoire choisie dans le wizard : à garder pour plus tard (une étape wizard en plus = friction pour l'enfant). |
| D3 | URLs | **Inchangées.** Les segments français sont des identifiants, pas de l'UI. | URLs localisées : casse `test:routes` (fullPath + ids épinglés), zéro bénéfice mono-famille. |
| D4 | Le `"ru"` existant | **Conservé** tel quel (union devient `"fr" \| "ru" \| "en"`). Branche non testée mais inoffensive. | Le retirer : churn inutile. |
| D5 | Données d'entités (héros/lieux/doudous/éléments) | **v1 : catalogue unique, langue de la famille** — ce sont des données utilisateur éditables à /parents ; une famille EN saisit ses entités en EN. Documenter la limite. | Colonnes `label_en`/`prompt_hint_en` nullable : possible phase ultérieure si vrai besoin bilingue simultané. |
| D6 | Aides à la lecture pour EN | **Masquées** quand `story.lang !== "fr"` (annotateur + toggles). Un annotateur phonétique anglais est un autre projet. | Port EN des aides : hors périmètre. |
| D7 | Erreurs serveur → client | **Codes d'erreur stables** (`"retry"`, `"story-finished"`, `"palier-mismatch"`…) rendus par le catalogue client ; fallback : si la chaîne ne matche aucun code connu, l'afficher brute (compat lignes déjà persistées dans `story_segments.error`). | Localiser côté serveur : duplique le catalogue et fige la langue au moment de l'erreur. |
| D8 | Bibliothèque i18n | **Catalogue maison typé** (`src/lib/i18n/`), pas de dépendance. ~230 chaînes, clés typées, deux fichiers `fr.ts`/`en.ts`, un golden de parité. React context + hook `useT()`, SSR-safe (la langue vient du loader racine). | i18next/lingui : sur-outillage pour une app mono-famille sans pluralisation complexe (le pluriel est déjà « esquivé par construction » dans les énoncés). |

**Contrainte transversale (non négociable)** : le catalogue EN passe le même
scan « calme » que le FR — jamais *well done / won / lost / hurry / wrong /
score / point / error*. Le golden calm-wording est dupliqué avec une liste EN.

---

## Phasage

### Phase 1 — Fondation i18n + coquille OS (le bureau parle EN)

1. `src/lib/i18n/` : `messages/fr.ts`, `messages/en.ts`, type `Locale = "fr" | "en"`,
   `LocaleProvider` + `useT()`. La langue arrive par le loader de `__root`
   (v1 : `getPublicFlags().defaultLang` — le canal existe déjà, `src/env.ts:141-148` ;
   étape D1 complète : lecture `app_settings`).
2. `<html lang={locale}>` dans `__root.tsx:94` ; meta description depuis le catalogue.
3. Migrer les surfaces bureau : `apps.tsx` (« Histoires/Calculs/Bibliothèque » —
   source unique icône + barre de titre), « Ranger le bureau », « Entrer »,
   écrans erreur/404 de `__root`, `aria-label="Fermer la fenêtre"`.
4. Grammaire FR sortie du code partagé :
   - `withDe()`/élision (`src/config/app.ts:19-23`) → fonctions de branding par
     locale (`fr: "L'atelier d'Arsène"` / `en: "Arsène's workshop"`). Les
     overrides `VITE_APP_NAME`/`VITE_STORY_LABEL` gardent la priorité.
   - `matchesChildName` (`src/lib/bureau/identite.ts`) : `toLocaleLowerCase(locale)` ;
     le strip d'élision `d'/l'` est inoffensif en EN — comportement FR épinglé par
     `bureau.golden.ts` inchangé.
5. Golden nouveau : parité de clés fr↔en + scan calme EN sur tout le catalogue.

### Phase 2 — Mini-app Calcul (la plus contrainte)

1. UI : shelf (« Plateau suivant », « J'ai fini, je compare », « L'atelier est
   rangé. », aria « Reposer le plateau », « Effacer »), page /parents/calcul
   (~16 chaînes), `FAMILLE_NOMS` + `PALIERS[].label` par locale.
2. Énoncés : pools EN dans `enonces.ts` avec **longueurs strictement identiques
   aux pools FR** (13 gabarits, 10 objets, 5 contenants) — la longueur du pool
   fait partie du contrat PRNG (`pick()` indexe par `rand() * length`) : à
   longueurs égales, la même graine produit la **traduction du même énoncé**.
   L'anglais simplifie (pas de partitif « en », pas de « sa boîte » genré).
   Le fingerprint de reprise est digits-only (`settings.ts:204-206`) → changer
   la langue **n'invalide pas** une série en cours, seul le libellé change. ✔
3. Variantes du plateau (`tray-shelf.tsx` `VARIANTES`) : phrases EN, **mêmes
   comptes par famille** (le hash `varianteDuJour` prend `pool.length`).
   L'aria-label reste stable *par langue* (contrat de stabilité documenté dans
   l'en-tête du fichier — à amender : « stable à langue constante »).
4. `math-functions.ts` : messages zod → codes (D7) ; la copie cliente dupliquée
   (`parents/calcul.tsx:280`) disparaît au profit du catalogue.
5. Goldens : les pins FR byte-exact (« Arsène range 32 plumes… »,
   `CONTENANTS_PIN`) restent inchangés ; on ajoute les pins EN équivalents,
   la parité de longueur des pools, le scan calme EN, et la contrainte de
   sobriété (1 phrase, < 90 chars) sur les phrases EN.
6. `PrintableOperationsSheet` : titre « Des calculs à poser » via catalogue.

### Phase 3 — Pipeline histoires EN (le plus gros morceau)

1. Types : `Lang = "fr" | "ru" | "en"` (`types.ts:3`), `langSchema`
   (`dynamic-functions.ts:45`), les deux casts `as "fr" | "ru"`
   (`dynamic-functions.ts:411`, `functions.ts:112`) remplacés par une validation.
2. **Packs de langue texte** (`src/server/providers/text/locales/{fr,en}.ts`) :
   le pack FR reproduit les octets actuels à l'identique (goldens
   `test:golden`/`test:coherence` = filet de sécurité du refactor). Chaque pack
   porte :
   - le prompt système (`buildSystem`) et les blocs de `buildPrompt`
     (fil rouge, historique, mustEnd, décrescendo « 2 phrases seulement »…) ;
   - `READING_LEVEL_GUIDANCE` réécrit pour l'EN (early-reader : présent/passé
     simple anglais OK, connecteurs *then, so, but, when* — l'interdit
     passé simple/subjonctif est un concept FR sans équivalent) ;
   - les `.describe()` du schéma zod (l'ordre des clés reste épinglé — seuls
     les textes changent par langue ; `sceneHint` « En français » → « In English ») ;
   - `forbidden-terms` EN (~23 termes : *dead, kill, blood, monster, scary,
     afraid, danger, war, knife, cry, sad, nightmare, ghost, witch…*),
     `STAKES_TERMS` EN (*best, right answer, wrong answer, win, lose, well
     done, hurry, you must…*) — fusionner au passage la copie divergente
     `CUSTOM_STAKES_TERMS` (`custom-prompt.ts:5-24`) ;
   - le tic-guard : FR `doux/douce/doucement` ; EN équivalent
     (*soft/softly/gently* — même seuil, même mécanique non fatale) ;
   - les messages de validation (ré-injectés dans le prompt correctif → ils
     doivent être dans la langue de l'histoire).
3. Blocs fragments (`hero-prompt.ts`, `doudou-prompt.ts` — pluralisation
   morphologique FR inline, `element-prompt.ts`, `custom-prompt.ts`) : variantes
   par pack, octets FR gelés (épinglés par `prompt-identity.golden.ts`).
4. Arc + monde visuel : la ligne de langue existe déjà (`dynamic.ts:632-637`) —
   ajouter la branche EN **et** une consigne de langue explicite pour
   `visualWorld`/`outfit` (aujourd'hui non spécifiée → FR de facto).
5. **Image** : plomber `story.lang` jusqu'à `buildSegmentImagePrompt`
   (`dynamic-functions.ts:708` ne le passe pas) ; pack EN du prompt
   d'illustration + `imageStyleSuffix` (« No text in the image. » etc.) ;
   les 4 prompts FR épinglés byte-exact restent gelés, 4 goldens EN ajoutés.
6. TTS : `edge.ts` `VOICE` reçoit `en: "en-US-AnaNeural"` (voix enfant) — le
   `Record<Lang, string>` force l'ajout à la compilation ; elevenlabs est déjà
   multilingue (lang ignoré). NB : `synthesizeFn` n'a aucun appelant — dormant,
   on étend juste la carte.
7. Heuristiques : seuils mots/phrase (`MAX_WORDS_*`) par pack (l'EN moyenne des
   mots plus courts) ; les caps caractères (choix ≤ 60) conviennent aux deux.
8. Wizard : `startDynamicStoryFn` reçoit `lang` = langue UI courante (aujourd'hui
   jamais envoyé → fallback env).

### Phase 4 — Aventure/Bibliothèque UI + gating lecture

1. Chaînes wizard (~36 : étapes, « On réessaie ? », « au hasard », « passer »,
   placeholders), player (« Imprimer », « Une autre histoire », états de
   chargement), bibliothèque (4), image-slot — via catalogue.
2. **Gating aides à la lecture** : `dynamic-story-player.tsx` et
   `printable-story.tsx` n'annotent et n'affichent les toggles
   (« Lettres muettes »/« Liaisons ») que si `story.lang === "fr"` (D6).
   `test:reading-aids` inchangé. Le toggle police cursive reste bilingue
   (simple choix de police).
3. `/parents` (~110 chaînes : 6 pages + 4 formulaires + playground) — le plus
   volumineux mais mécanique ; unifier au passage « Retirer/Supprimer » et les
   accords `ce/cet` dans les clés du catalogue.
4. Erreurs serveur → codes (D7) sur `dynamic-functions`, `heroes/elements-functions`.

### Phase 5 — Réglage parent + release

1. D1 complet : table `app_settings` (migration drizzle), carte « Langue » dans
   /parents (deux options, pas de drapeau-gamification), lecture dans le loader
   racine, fallback `DEFAULT_LANG`.
2. Suite de tests : `bun run test` complet ; nouveaux goldens (parité catalogue,
   calm-scan EN, énoncés EN, prompts EN, parité longueurs de pools).
3. `VERSION` + `CHANGELOG.md` (français, Keep-a-Changelog), TODOS.md pour les
   reports (D5 entités bilingues, aides lecture EN).
4. Déploiement : `bun run db:migrate` (nouvelle table) puis `bun run deploy`.

---

## Risques & garde-fous

- **Goldens byte-exact** : le risque n° 1 est de casser `test:golden` en
  refactorant. Garde-fou : règle de travail « le pack FR est un déplacement de
  littéraux, jamais une réécriture » ; lancer `bun run test:golden` après chaque
  extraction.
- **Contrat PRNG des énoncés** : longueur de pool = partie du contrat. Garde-fou :
  golden de parité `OBJETS_EN.length === OBJETS.length` etc.
- **Qualité EN du LLM** : les listes interdites EN et le reading-level EN sont
  de la rédaction, pas de la traduction — à valider en générant quelques
  histoires EN réelles avant release (lecture parent).
- **`visualWorld`/`outfit` FR de facto sur les vieilles lignes** : les nouvelles
  histoires EN reçoivent une consigne de langue ; les anciennes lignes restent
  FR et continuent de marcher (le prompt image FR gelé les consomme).
- **Aria-labels** : stables par langue ; amender le commentaire-contrat de
  `tray-shelf.tsx` pour le dire.
- **`soft-numpad.tsx`** : le refus délibéré des annonces dnd-kit anglaises
  reste valable en FR ; en EN on pourrait les réactiver — micro-décision,
  défaut : garder le comportement actuel dans les deux langues.

## Estimation grossière

| Phase | Taille |
|---|---|
| 1 Fondation + bureau | S–M (catalogue + ~20 chaînes + plomberie locale) |
| 2 Calcul | M (28 gabarits/pools + goldens) |
| 3 Pipeline histoires | **L** (packs, validateurs, image, goldens EN) |
| 4 UI aventure + parents + gating | M (volumineux, mécanique) |
| 5 Réglage + release | S |

Ordre livrable : chaque phase est shippable seule (1 → l'OS est bilingue même si
les histoires restent FR ; 3 peut précéder 4 si on veut des histoires EN vite).
