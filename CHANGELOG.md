# Changelog

All notable changes to the app, one version per release.
Format: [Keep a Changelog](https://keepachangelog.com/) adapted, 4-digit
versions `MAJOR.MINOR.PATCH.MICRO` (`VERSION` file).

## [0.7.0.0] - 2026-07-31

### Added

- **A sidebar for the parent space**: every parent page (settings, heroes,
  places, elements, cuddly toys, sums, image model) now shares one side
  panel — the sections are always one click away instead of a round trip
  through a hub page. The panel folds away (its trigger button, or ⌘B /
  Ctrl+B) and becomes a drawer on small screens; a printed A5 sheet never
  shows it. Its footer carries the way back to the desktop and the ⌘K
  shortcut reminder — still parent-side only, never in the child's layer.
- New golden assertions (`test:routes`): the `/parents` layout route exists
  and re-parents its eight children, every sidebar section is a URL the app
  really serves (unique ids), no `ssr:` option anywhere under the parents
  routes, and the old hub URL really redirects to the settings page.

### Changed

- **The parent hub page is retired**: `/parents` now lands directly on the
  settings page (`/parents/reglages`) — old links and the ⌘K "Parent space"
  entry keep working. The 🌍 language setting moved onto the settings page.
- The sections live in one pure registry (`src/lib/parents/sections.ts`)
  shared by the sidebar and the ⌘K menu — renaming or reordering a section
  cannot desync them.
- The root shell is full-bleed everywhere: the parents layout owns its own
  reading column (pages no longer carry their own width wrapper).

### Removed

- The unused parent-hub introduction text left both catalogs (the page that
  displayed it no longer exists).

## [0.6.1.0] - 2026-07-31

### Added

- **A ⌘K menu to reach the parent space**: press ⌘K (or Ctrl+K) on any page
  — including over the desktop and the portrait screen — and a search menu
  opens on the parent pages (parent space, settings, heroes, places,
  elements, cuddly toys, sums, image model) plus the way back to the
  desktop. Typing filters by name and by URL segment, so "settings" finds
  Les réglages under a French interface and "reglages" finds Settings under
  an English one. The menu is bilingual like the rest of the shell.
- The menu is **navigation only** — never an action that saves something: a
  setting is still changed on its own page, with its own context. It has no
  visible trigger in the child's layer either: it extends the /parents rule
  (reachable by URL, never drawn in the child's grammar), and the shortcut
  is recalled on the parent home page only. A printed booklet is unaffected
  even with the menu open.
- New golden assertions: every menu destination is a URL the app really
  serves and never a shortcut into a mini-app (`test:routes`), and every
  entry resolves to a label in BOTH catalogs (`test:i18n`).

### Changed

- Floating surfaces (the menu and its dialogue) join the calm palette:
  `--popover` was still the pure white inherited from the base theme, the
  only cold surface in the workshop.

## [0.6.0.0] - 2026-07-31

### Added

- **Settings are configured in the app**: new `/parents/reglages` page
  (🔧 card in the parent space) — Anthropic/Gemini/ElevenLabs keys, writing
  model, images (activation, default model, resolution), voices
  (activation, provider) and the workshop branding (child's first name,
  name, description, booklet signature, with a live preview). Everything is
  stored in the local database (`app_settings`) and applies to the next
  stories — no more editing `.env` or redeploying.
- Environment variables become the **deployment settings** (they apply when
  nothing is set in the app — "deployment setting" badge); each field
  offers "Revert to the deployment setting", and each key an honest
  "Clear" (the deployment key no longer applies until a new one is set).
- Renaming the child happens in the app: the tab title, the desktop
  portrait and the printed booklet follow on the next reload, **without a
  Docker rebuild**. `VITE_*` variables remain honored as a fallback for
  existing deployments.
- A booklet's colophon follows the **story's language** (an English story
  printed under a French interface keeps its English branding); the
  operations sheet follows the workshop language.
- New `test:settings` golden: db>env>default precedence, the four
  secret-key operations, tolerant parsing of hand-edited rows, masking (no
  secret ever travels back to the browser — verified on the serialized
  response), the db-free import graph and the field-level transactional
  patch.

### Changed

- **Startup no longer requires any key**: boot validation only covers
  infra (`DATABASE_URL`). A missing key shows at the point of use — a calm
  "no key is configured" status on the parent side, "On réessaie ?" on the
  child side, and no network call is attempted. First boot:
  `docker compose up` (even without `.env.production`), then paste the key
  in the app.
- Each server operation reads ONE configuration snapshot at its boundary
  (never two generations of settings within the same story); a save
  applies to the next operation, another tab converges on its next reload.
- **Backups**: the `app.db` database (`app-data` volume) may now contain
  keys — it deserves the same care as a `.env` file.

## [0.5.2.2] - 2026-07-31

### Changed

- **The project name is corrected to `kidOS`** (not `kidsOS`): repository,
  package, Docker image and container. Nothing changes for the child or
  the parent — the app keeps its family name derived from
  `VITE_CHILD_NAME` ("L'atelier de Léa"), its URLs and its data.
- On the machine side, the Compose project name goes from `kidsos` to
  `kidos`: the named volumes become `kidos_app-data` (SQLite database +
  generated media). The old `kidsos_*` volumes are **kept intact** as a
  backup after copying the content over — delete them by hand once the new
  version has run for a few days (`docker volume rm kidsos_app-data`).

## [0.5.2.1] - 2026-07-30

### Changed

- **The project is now called `kidsOS`** (repository, package, Docker
  image and container) — nothing changes for the child or the parent: the
  app keeps its family name derived from `VITE_CHILD_NAME` ("L'atelier de
  Léa"), its URLs and its data.
- On the machine side, the Compose project name is now **pinned to
  `kidsos`** in `compose.yml`: named volumes no longer depend on the name
  of the local checkout's folder, so renaming the folder can no longer
  detach the `app-data` volume (the SQLite database and generated media).
  After updating, the data lives in `kidsos_app-data`.

## [0.5.2.0] - 2026-07-30

### Changed

- **The database now lives at home**: no more Turso account or network
  needed for the database — stories, heroes and settings are stored in a
  plain SQLite file next to the images and voices (the `app-data` volume
  in Docker, `data/app.db` locally). Installing the app now only asks for
  an Anthropic key.
- **Migrations apply themselves at startup**: no more `db:migrate` step to
  remember — a new version brings its schema with it, in the right order
  (the code and its migration arrive together).
- **The file is protected**: before applying a new migration, the app
  keeps an `app.db.pre-migrate` snapshot next to the database; WAL mode
  keeps a story generation from blocking a read; a malformed database URL
  (`file://host`, query string) or a leftover Turso configuration is
  refused or clearly reported at startup.
- The README documents the migration from an existing Turso deployment
  (dump → `-bail` import into the Docker volume, checks, backup and
  rollback).

### Added

- A `test:db` assertion suite pins the new foundation: `file:` URL
  derivation, validations, a real boot on a blank directory (12 migrations
  applied), idempotent restart, no spurious snapshot, and the Dockerfile
  contract (`drizzle/` shipped in the image).

## [0.5.1.1] - 2026-07-30

### Changed

- **Written carries finally show**: in the posed operation, the digit
  written in the small carry cell is inked with a solid stroke on a softly
  highlighted background (the same tone as the selection), instead of
  staying grey like an empty cell — the child keeps the carry in sight
  while going down the column. The cell grows a little; the empty cell
  remains a discreet draft and nothing ever judges the digit.

## [0.5.1.0] - 2026-07-30

### Added

- **The whole interface speaks both languages (phase 4, last of the
  multilanguage plan)**: the story-creation flow (steps, the "random /
  next / skip / no doudou" buttons, the flavour question, the calm waiting
  screens, the "On réessaie ?" screen), the story player (Print, Another
  story, the playback buttons), the library, and the entire parent space
  (the hero/place/element/doudou pages and their forms, the image model,
  the playground) follow the language setting. Templated accessibility
  labels ("Modifier {label}") go through the same template as the
  arithmetic tray.
- Deliberately kept in the family's language (decision D5 of the plan):
  entity DATA (names and descriptions of heroes, places, elements,
  doudous — editable at /parents) and the image-model notes.

## [0.5.0.0] - 2026-07-29

### Added

- **Stories speak both languages (phase 3 of the multilanguage plan)**: a
  story created while the workshop is in English is written, illustrated
  and (if enabled) read aloud in English. The language is frozen at
  creation (`stories.lang`): the library may mix both, each story keeps
  its own forever.
- A COMPLETE English corpus, written (not translated word for word) for a
  beginning anglophone reader: system and writing prompts, hidden story
  arc, landing decrescendo, early-reader reading level, forbidden-word and
  stakes lists, the "soft/softly/gentle/gently" anti-tic (the counterpart
  of "doux/doucement"), English corrective messages, illustration prompt
  and an English voice (Ana) for read-aloud.
- English-specific guard-rail: the English safety scan works on WHOLE
  WORDS (never by substring like the French one) — otherwise "warm", a
  core word of a cozy story, would be blocked because it contains "war".
  Verified in real conditions: an arc + a first beat generated in English
  on the first try, calm and short.
- Reading aids (silent letters, liaisons) are FRENCH phonics: they now
  only appear on French stories (annotations and toggles) — the cursive
  font remains available everywhere.
- New golden in `test:coherence`: the whole English branch (prompts,
  whole-word scan, schema key order identical to the French one,
  illustration prompt pinned byte for byte) — and all the French goldens
  pass UNTOUCHED: the historical path has not moved by a single byte.

## [0.4.4.0] - 2026-07-29

### Added

- **The Arithmetic mini-app speaks both languages (phase 2 of the
  multilanguage plan)**: the shelf (tray phrases, screen reader), the
  série ("Next tray", "I'm done, I compare", the 🌿 moment), the soft
  numpad, and the parent page (family cards, palier labels, A5 sheet —
  printed in the workshop language at print time) follow the language
  setting.
- The deterministic word problems exist in English: pools aligned index by
  index with the French pools (same seed → the translation of the same
  problem); an in-progress série is never invalidated by a language switch
  — only the sentence above the operation changes, the digits stay.
- Extended goldens: byte-exact pins of the English problems (translation
  of the same draw as the French pins), pool-alignment proof over 3
  families × 100 seeds × 2 branches, English calm-wording scan (never well
  done/won/hurry/wrong…), sobriety (1 sentence, < 90 characters); and on
  the catalog side, the byte-exact identity of the French with
  FAMILLE_NOMS and the pure module's palier labels.

### Changed

- Saving the arithmetic settings returns a stable code instead of a French
  sentence — the label comes from the catalog, in the parent's language
  (decision D7 of the plan).

## [0.4.3.0] - 2026-07-29

### Added

- **The workshop speaks two languages (phase 1 of the multilanguage
  plan)**: a "Language" setting in the parent space (🌍, French or
  English) switches the whole desktop shell — icons and title bars, entry
  screen, "Ranger le bureau" ritual, calm screens (trouble / page not
  found), tab title and description — without a reload. The branding
  derived from the first name follows the language ("L'atelier d'Arsène" /
  "Arsène's workshop"); the `VITE_APP_NAME` / `VITE_APP_DESCRIPTION` /
  `VITE_STORY_LABEL` overrides keep priority in both languages. Stories,
  the mini-apps and the parent space stay in French for now (next phases).
- New `app_settings` table (migration 0011, `ui-language` key) — read by
  the root loader, silent fallback to French if the database is
  unreachable: the child never sees a language error.
- New `test:i18n` golden: key parity between the two catalogs, the calm
  scan on both languages (never bravo/gagné/perdu… nor well
  done/won/lost…), byte-exact identity of the relocated French labels, and
  per-locale branding (French elision, English possessive).

### Changed

- The desktop app registry (`apps.tsx`) now carries the label id (catalog
  key) instead of the label itself — the icon and its title bar read the
  same key, in both languages.

## [0.4.2.0] - 2026-07-23

### Changed

- **A big architecture tidy-up, with no visible behavior change** for the
  child or the parent (the golden suites guarantee it, and an independent
  external review concluded "safe to ship"):
  - the life of an arithmetic série (exact resume, migration of pre-shelf
    séries, big cleanup of local keys, settings cache) now lives in a
    pure, tested module (`src/lib/operations/serie-session.ts`) behind a
    small storage port — the /calcul page keeps only rendering and
    gestures;
  - every read and write of generated media goes through the single
    `media-store` choke-point — no more hand-built file path anywhere
    else;
  - the illustration prompt text is assembled by a dedicated module,
    locked byte for byte by a golden test;
  - the hypothetical text and image provider interfaces (a single
    implementation each) are removed; only text-to-speech, which really
    has two voices, keeps its seam (`getTtsProvider()`);
  - the re-clamping of a desktop window after a resize is concentrated in
    a pure helper (`reclampCommitted`), instead of four repeated blocks;
  - two contracts until now in prose are pinned by tests: no `ssr` option
    under the desktop, and the session gate called at exactly two places
    (never the root).

### Fixed

- Read-aloud now also works when media is stored on Vercel Blob: the
  default voice (edge) wrote its audio straight to the local disk by
  building its path by hand — in Blob mode (ephemeral filesystems), the
  audio was silently lost. It now goes through the shared media store,
  like the illustrations: the audio follows the active backend (local disk
  or CDN). The current family deployment, on local disk, was unaffected.

## [0.4.1.0] - 2026-07-23

### Added

- **The arithmetic shelf changes with the days**: the trays no longer
  always show the same scenes. Each family now has several paired
  scene + phrase moods — chestnuts, leaves or flowers for addition; giving
  to the doudou or putting away in its box for subtraction; baskets, bowls
  or bags for multiplication — and the shelf is prepared "overnight": it
  changes from one day to the next, never before the child's eyes, and
  stays identical all day (even if the window stays open past midnight).
- **The little stories of the operations vary more**: multiplication no
  longer always fills baskets (boxes, hampers, bags and bowls join the
  round), subtraction alternates between giving, offering or lending to
  the doudou and putting away, setting down or bringing home, and addition
  gains new phrasings too. An interrupted série always resumes with word
  for word the same problems.

### Changed

- On the arithmetic shelf, the "back" arrow (which duplicated the window's
  close cross) and the separator line under the trays were removed:
  closing the window is THE exit gesture; the arrow only remains inside a
  série, to "put the tray back".
- The desktop icons and the home-screen portrait now show the little
  pointer hand, like everything clickable.

### Fixed

- Problems that don't feature the doudou keep exactly the same wording
  whether the doudou is loaded or not: a database slow to load can no
  longer re-word those sentences in a resumed série. (The ones that
  mention the doudou do follow the current configuration — that's their
  role.)

## [0.4.0.0] - 2026-07-22

### Added

- **Arsène's desktop**: the home screen becomes a small calm computer. The
  app opens on the session screen — the child's portrait (their hero),
  their first name, one click to enter, never a password — then on a real
  desktop: three icons (Stories, Arithmetic, Library) laid on a cream
  wash, with a pale sun and a sage hill on the horizon.
- Each activity opens in a **real window**: a title bar with the app's
  name and pictogram, a large soft cross to close, and the window moves by
  dragging its title bar — the bar can never leave the screen, and every
  opening starts centered again. On a small screen, the window fills the
  whole space and dragging goes away.
- The real computer's gestures are learned as-is: one click selects an
  icon (its name highlights, like on a real desktop), a **double-click
  opens it** — with the system's delay, never a home-made threshold — and
  Enter works too.
- The **"Ranger le bureau"** ritual, discreet in a corner, closes the
  session back to the portrait. With the session closed, the whole app
  presents itself through the portrait first: neither the Back button nor
  a direct link skips the ritual.

### Changed

- An in-progress story or arithmetic série **resumes exactly** after its
  window is closed — the frame introduces no loss, and a page opened from
  a scrolled list always starts back at the top.
- The parent space (/parents) deliberately stays outside the desktop: no
  icon, direct access by address, unchanged presentation.
- Printing booklets and sheets from a window renders exactly as before:
  the frame disappears entirely from the paper.

### Fixed

- An interrupted window drag (resize, Escape, tab switch) can no longer
  leave the window stuck off-screen.
- If the device's local storage is unavailable, the session lives in
  memory for the tab's lifetime: the portrait screen never becomes a
  repeated barrier.
- A connection hiccup while opening an activity no longer freezes the
  desktop icons: they become usable again on their own.
- An accented first name recognizes its hero regardless of how the accent
  was typed in the parent space.

## [0.3.1.0] - 2026-07-20

### Changed

- Illustrations now announce their dimensions to the page: no more small
  layout jump while an image from the library, a story or a printed
  booklet finishes loading.
- A big spring cleaning of the code with the adoption of the ultracite
  presets (Biome): imports, attributes and keys sorted everywhere, more
  explicit rewrites (precise null/undefined comparisons, hoisted regular
  expressions, `+= 1`) — with no behavior change at all, the golden suites
  guarantee it.
- The field order of the story schemas sent to the model (title then
  narration then choices) is now locked by a test: a future formatting
  pass can no longer silently reorder it.

### Fixed

- The automatic key sorting had moved section comments (environment
  variables, database schema) under the wrong entries; the semantic groups
  are restored and protected.

## [0.3.0.0] - 2026-07-20

### Added

- The tray shelf: on entering "Poser des calculs", the child now chooses
  their operation family themselves — one tray per family prepared by the
  parent, laid on a plank, with its small fixed scene (chestnuts for
  additions, the doudou for subtractions, baskets for multiplications),
  the sign in a medallion and a short phrase. A family that isn't prepared
  simply doesn't appear.
- Each tray remembers its in-progress série: a tray "taken off" the plank
  resumes exactly where it was, even after a detour through another tray —
  and a série started before this version is recovered too.
- The arrow now makes the journey in two steps: from the série it "puts
  the tray back" (return to the shelf), from the shelf it returns home.
  The end of a série becomes a moment again: 🌿, then the shelf reappears
  with the tray put away.
- On the parent side, the arithmetic page reorganizes into one card per
  operation family: activate/deactivate each family, choose its own
  palier, print an A5 sheet per family. Consequences are stated before the
  gesture ("Changing the palier puts the current série away"), and at
  least one family always stays on the shelf.
- The shelf adapts to the screen: trays compress without ever going under
  the plank, stack on a small screen (each with its plank), announce
  themselves to the screen reader ("Take the additions tray — série in
  progress") and honor the "reduce motion" preference.

### Changed

- The arithmetic settings now live per operation family (migration 0010
  converts the old single setting while preserving the chosen palier —
  run `bun run db:migrate` with the deployment); the série size stays
  global, and an older device's size is preserved.
- The project documentation describes the tray shelf and its data
  lifecycle (CLAUDE.md, schema, backlog).

### Fixed

- An offline visit (or one before the migration) can no longer make an
  in-progress série forgotten: the big cleanup of local séries only
  happens on settings actually read from the database, and the migration
  of a pre-shelf série is only erased after verifying its new place.
- If the settings fail to load, the parents page says so calmly instead of
  presenting an empty form that could have overwritten the real settings
  while believing it was repairing them.
- A série whose content can't be regenerated puts itself away instead of
  staying on the "L'atelier est rangé." screen; parent-side error messages
  stay in calm language, with no technical detail.
- `bun run lint` also works from an agent workspace (the Biome exclusion
  of worktrees is anchored to the config root).

## [0.2.2.1] - 2026-07-20

### Changed

- The app is now called "L'atelier d'Arsène" (derived from the first name:
  "L'atelier de Léa" for another household, "Le petit atelier" without a
  first name) — a name that covers the stories, the arithmetic and the
  upcoming trays. The browser tab and the home screen follow on the next
  deployment; printed booklets keep their "Une histoire d'Arsène" footer.
- The app description becomes "Un endroit calme pour lire, inventer et
  calculer."

## [0.2.2.0] - 2026-07-19

### Changed

- The server functions use TanStack Start's current validation API
  (`validator` replaces the deprecated `inputValidator` alias, strictly
  equivalent) — the dev server now starts without the wall of deprecation
  warnings. No behavior change.

### Fixed

- `bun run lint` no longer breaks when an agent workspace exists under
  `.claude/worktrees/` (Biome exclusion + `.gitignore` entry); the local
  `.claude/settings.local.json` settings also stay out of the repository.

## [0.2.1.0] - 2026-07-18

### Added

- Arithmetic workshop: the soft numpad's digits now slide under the
  fingertip straight into the operation's cells — the tile follows the
  finger and inks itself where it lands, like a pencil setting down. The
  previous tap still works exactly the same; both gestures mix freely.

### Changed

- During a drag, only one cell lights up at a time (the one under the
  finger) — the previous selection goes out for the duration of the
  gesture.
- The drop is forgiving for small fingers: if the finger is just next to a
  cell but the tile overlaps it, the digit lands there anyway.
- The small carry cell is a bit easier to touch (touch target enlarged to
  44 px tall).

## [0.2.0.0] - 2026-07-17

### Added

- The home screen becomes a shelf with two doors: "Histoire où tu choisis"
  and the new "Poser des calculs" mini-app — two independent activities,
  with no crossed mechanics.
- `/calcul` workshop: a short série of posed operations (3 by default),
  presented as trays that put themselves away — the child writes freely on
  the soft numpad (everything inks like pencil, never red, never a grade),
  compares by themselves with the solved version when done, and the
  workshop puts itself away at the end of the série. An operation left
  mid-way resumes exactly where it was.
- Word problems from the child's world: each operation can wear a short
  sentence with the family's hero and doudou ("Arsène range 24 marrons,
  Doudou en apporte 8") — generated locally, no AI.
- Printable A5 sheets: posed operations to complete in pencil, in the same
  format as the story booklets, calibrated on the chosen palier.
- Parent space `/parents/calcul`: palier choice (7 paliers, from carrying-
  free additions to posed multiplications — the adult decides, never an
  algorithm), série sizes, sheet printing.
- Arithmetic works even without a network: the palier is remembered on the
  device and the child never sees an error.

### Changed

- The home page now presents the two activities side by side; the library
  stays reachable as before.

### Infrastructure

- New pure module `src/lib/operations` (seeded deterministic generator,
  shared screen/print geometry, palier ladder, template word problems),
  locked by 60 golden checks — some sweeping every palier × 60 seeds
  (`bun run test:operations`).
- `math_skills` table (additive migration 0009) for the parent-chosen
  palier and série size.
