# TODOS

## Calcul (mini-app opérations)

### Demander à l'éducatrice où en est Arsène + l'observer manipuler
**Priority:** P1
**Contexte :** L'assignment du design doc (`~/.gstack/projects/tomaas-kidOS/user-main-design-20260717-165844.md`). À la rentrée (fin août) : perles dorées ? jeu des timbres déjà présenté ? quelle opération ? Observer ses mains sur le vrai matériel sans l'aider — le design du geste tactile (tranche 5) doit copier ce qu'il fait réellement. **GO/NO-GO** : si les timbres n'ont pas été présentés en classe, l'app ne les introduit pas.
**Depends on:** la rentrée scolaire.

### Observer le geste de l'étagère après ship (protocole 1 semaine)
**Priority:** P2
**Contexte :** Deux décisions de l'eng-review de l'étagère de plateaux (design doc `user-worktree-selection-design-20260719-112405.md`) ont été prises contre l'avis de la voix extérieure, sur la base d'un protocole d'observation : T6-B (l'étagère s'affiche même à un seul plateau — le geste demeure) et T1 (scènes FIXES par famille — la constance bat la nouveauté). **MàJ 2026-07-23 (v0.4.1.0)** : T1 a été révisé par décision utilisateur AVANT observation — les scènes tournent maintenant PAR JOUR (`varianteDuJour`, stable dans la journée) ; la question (b) devient « la rotation quotidienne suffit-elle, ou Arsène cherche-t-il la nouveauté À CHAQUE série ? » (si oui → rouvrir « scènes vivantes » : scène = premier énoncé de la série, seed pré-engagé + mapping SVG des 10 OBJETS). La question (a) sur le plateau unique reste entière.
**Depends on:** le ship de l'étagère de plateaux.

### Tranche 5 — le geste timbres à l'écran
**Priority:** P2
**Contexte :** `stamp-engine.ts` (machine à états pure : place/unplace/exchange/ink, `isColumnReady`, 4 rangs) + `stamp-board.tsx` (`@dnd-kit/react` épinglé — décision eng-review 1B — ou tap-pour-poser selon l'observation), échange 10→1 avec la retenue écrite pendant le geste, encrage gaté par colonne résolue aux paliers avec matériel, fondu du matériel attaché au palier (les types `Fondu`/`Rank` sont déjà réservés dans `src/lib/operations/types.ts`). Golden tests sur l'engine. NB : le glisser-déposer du pavé (v0.2.1.0) utilise déjà `@dnd-kit/core` — revalider le choix `@dnd-kit/react` de la décision 1B avant de commencer, pour ne pas embarquer deux paquets dnd-kit.
**Depends on:** l'assignment ci-dessus (GO/NO-GO école).

### Tranche 6 — soustraction et multiplication au matériel
**Priority:** P2
**Contexte :** Soustraction = seul le diminuende posé, emprunt = échange inverse 1 bleu → 10 verts (variante exacte à confirmer avec l'école) ; multiplication = ligne posée en un geste (« poser encore 48 ») ; spec détaillée de la multiplication à 2 chiffres (produits partiels, décalage) à écrire à ce moment-là.
**Depends on:** Tranche 5.

## Bureau (le vrai petit ordinateur)

### Observer le bureau après ship (protocole 1 semaine)
**Priority:** P2
**Contexte :** Quatre décisions du design doc du bureau
(`~/.gstack/projects/tomaas-kidOS/user-main-design-20260721-141546.md`)
sont parquées sur l'observation, jamais sur la mesure : (a) le drag de fenêtre —
valeur ou friction ? s'il ne déplace jamais la fenêtre, la fenêtre devient fixe ;
(b) les tailles de cibles (icônes, croix) — copient ses mains ; (c) le ressenti
de la gate portrait — le clic-portrait reste-t-il un rituel regardé ou
devient-il un réflexe aveugle ? (d) le double-clic SEUL ouvre (rattrapage
« Ouvrir » retiré le 22/07 ; la voix Codex du pré-landing a relevé le risque
de découvrabilité) : s'il n'y arrive pas, le bouton revient en un commit —
la machine à états n'a pas bougé. Regarder une semaine, sans aider, sans
chronométrer (contrainte calme : jamais de mesure de l'enfant).
**Depends on:** le ship du bureau.

### DragOverlay de /calcul sous le drag de fenêtre (multi-touch)
**Priority:** P3
**Contexte :** Relevé par le red team du pré-landing bureau : sur un écran
TACTILE ≥ lg (iPad paysage), un doigt qui tient la barre de titre pendant
qu'un second traîne une tuile du pavé ferait rendre le DragOverlay de
/calcul décalé (le transform de drag du cadre devient son containing block)
et rogné par l'overflow-hidden. Hors profil de la machine familiale
(souris) ; correctif propre à la tranche 5, la prochaine ouverture légitime
de /calcul : porter le DragOverlay sur document.body (ou garde croisée
entre les deux DndContext).
**MàJ 2026-07-23 (v0.4.2.0)** : le stockage de la série vit désormais dans
`src/lib/operations/serie-session.ts` derrière un port `SerieStorage` —
l'unification D18-A, si elle a encore lieu, passera par ce port (elle n'est
pas faite : la session bureau garde son module à part).
**Depends on:** Tranche 5 calcul (unification lib/storage.ts, D18-A).

### Hauteurs des mini-apps dans la fenêtre (min-h-[80vh] → contexte fenêtré)
**Priority:** P3
**Contexte :** Relevé par le Codex adversarial du pré-landing bureau : les
shells internes (`min-h-[80vh]` dans calcul/index.tsx et ailleurs) mesurent le
VIEWPORT, pas la fenêtre de ~85vh — le contenu déborde donc toujours d'un
poil et la fenêtre montre une barre de défilement même quand tout tiendrait.
Cosmétique (une scrollbar est une grammaire d'OS légitime) ; correctif à la
prochaine ouverture légitime des internes (tranche 5) : min-h-full dans le
contexte fenêtré plutôt que 80vh.
**Depends on:** Tranche 5 calcul.

### Tranche clavier : la machine à écrire
**Priority:** P3
**Contexte :** Le design doc du bureau (D24-A) coupe explicitement le clavier
du périmètre : la grammaire livrée est 100 % pointeur alors que le besoin
énoncé disait « souris ET clavier ». Le foyer naturel de l'alphabétisation
clavier est la « machine à écrire » écartée en D3 : une mini-app calme où les
lettres tapées apparaissent grandes et belles (adjacente à la lecture —
peut-être avec les aides de lecture de `src/lib/reading-aids/`), une icône de
plus sur le bureau. À ouvrir après le ship du bureau, quand l'observation
montre qu'Arsène est à l'aise avec le pointeur.
**Depends on:** le ship du bureau.

### Résilience du brouillon d'aventure pendant la génération
**Priority:** P3
**Contexte :** `src/app/_bureau/aventure/index.tsx` (~l.380) efface le brouillon AVANT
l'appel serveur : quitter pendant une génération en vol perd le choix de
l'enfant. Préexistant (pas introduit par le bureau), relevé par la voix
extérieure de la ceo-review du 21/07 (T3), épinglé tel quel par le plan /qa,
et gardé HORS du périmètre bureau (prémisse 6 : internes intouchés). Correctif
candidat : effacer après résolution, ou restaurer au démontage — toutes les
sorties (croix, flèche retour, bouton Retour) deviennent alors sans perte.
À réviser séparément, avec sa propre attention à la machine à états de
l'aventure.

## Deploy (Docker/Compose)

### Forwarder les build args de branding dans compose.yml
**Priority:** P2
**Contexte :** Le `Dockerfile` déclare les ARGs `VITE_APP_NAME`,
`VITE_APP_DESCRIPTION` et `VITE_STORY_LABEL` mais `compose.yml` ne forwarde
que `VITE_CHILD_NAME` — un override posé dans `.env` (le chemin documenté par
`.env.example` et `src/config/app.ts`) est silencieusement ignoré par
`bun run deploy`. Gap préexistant relevé par la review adversariale du rename
« L'atelier » (v0.2.2.1) : 3 lignes d'`args` à ajouter, ou documenter que
l'override passe par `compose.override.yml`.

## Design

### Formaliser un DESIGN.md via /design-consultation
**Priority:** P3
**Contexte :** Le langage visuel du projet vit éparpillé entre `src/config/style.ts` (crème #FBF6EC, encre #5A4636, ocre #D89A5B, sauge #A9C9A4, Quicksand, imageStyleSuffix aquarelle), les classes des composants (`rounded-2xl`, ring sauge, ombres douces, boutons ghost `text-muted-foreground text-xl`) et la mémoire des sessions. Deux design reviews de suite (juillet : atelier opérations ; 19/07 : étagère de plateaux) ont dû reconstituer ce système à la main. Une session `/design-consultation` produirait le DESIGN.md qui calibre automatiquement toutes les revues futures — la valeur croît avec la 3e mini-app (timbres, rentrée). Matière première : style.ts + la grammaire existante + les blocs « langage visuel » des design docs.
**Depends on:** rien.

## Completed
