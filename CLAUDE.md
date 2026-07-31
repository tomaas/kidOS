# CLAUDE.md — kidOS

Single-family web app, a calm fake-OS desktop (the "bureau") for one child:
calm illustrated read-aloud stories in French where the configured child hero
stars, plus a "Poser des calculs" mini-app (posed column arithmetic, no LLM),
each opening in its own window. TanStack Start + React 19.
Deploys via Docker (Compose) and runs locally; the database is a local
SQLite file under `DATA_DIR` (in Docker: the app-data volume) — no cloud
db, no db setup. No authentication — the compose
file binds to loopback only; exposing it further is the operator's problem.

## THE NON-NEGOTIABLE CONSTRAINT

This is a CALM TOOL for a young child, NOT a game. NEVER add: score, note,
timer, "bravo/gagné/perdu", gamification, unlock, reward, streak,
notification, progress bar, %, quiz, evaluation, or any sense of
stakes/performance. This overrides every generic "good app" instinct. The
design test for any feature: "does it add stakes, pressure, or dependence?" If
yes → don't.

## Commands

- `bun run dev` — dev server on port 3009
- `bun run build` / `bun run start` — clean local run (start uses PORT=3009)
- `bun run check-types` — tsc
- `bun run lint` / `bun run lint:fix` — Biome, extending the ultracite
  presets (core + react + tanstack); the deliberate opt-outs (jsx handlers,
  bitwise in the seeded generator, module façades, route filenames) are
  documented inline in `biome.jsonc` and win over the presets.
- `bun run test` — golden assertion scripts (plain bun, no vitest):
  `test:golden` pins prompt identity (text fragments + the segment-image
  prompt builder, byte-identical); `test:coherence` pins the safety/structure
  validators, the anti-"doux" repetition guard, the landing decrescendo, the
  prompt builders and the zod schema key order (key order IS the JSON property
  order sent to the model — a formatting pass must not reorder it), PLUS the
  ENGLISH corpus branch (english-coherence.golden.ts: EN prompts/validators,
  the word-boundary safety scan, EN schema key order = FR, the EN illustration
  prompt byte-pinned, the no-lang default staying French);
  `test:media` pins the media-store rules: blob-host derivation and the
  read-back choke-point (allowlist in both modes, media-dir escape, bytes
  round-trip);
  `test:data-route` pins the `/data/$` media-serving route;
  `test:reading-aids` pins the silent-letter/liaison annotator;
  `test:operations` pins the posed-operations module (seeded generator,
  layout geometry, palier ladder, énoncé templates in BOTH languages —
  EN pool length/index alignment proved, EN pins = translation of the same
  seeded draw, calm-wording scan fr AND en) and
  the serie-session lifecycle (legacy bridge, authoritative purge,
  resume/purge-on-mismatch, fingerprint round-trip, silent storage
  degradation);
  `test:bureau` pins the desktop layer's pure modules (window clamp incl.
  the committed-position re-clamp `reclampCommitted`, session shape guard,
  icon-selection state machine, childName↔hero identity match);
  `test:i18n` pins the UI-locale module (fr↔en catalog key parity, the
  calm-wording scan on BOTH catalogs, byte-identity of the relocated French
  labels, per-locale branding incl. French elision / English possessive,
  `normalizeLocale` strictness);
  `test:routes` pins public-URL integrity of the `_bureau/` relocation (no
  URL changed, no stale route id, /parents never under the layout) plus two
  prose contracts: no `ssr:` option under `src/app/_bureau/**` and the
  closed-session gate CALLED in exactly two files, never `__root`;
  `test:settings` pins the app-config settings service (precedence
  db>env>default, the FOUR secret operations, invalid-means-fallback
  bool/enum parsing, `hintFor` masking, the boundary secret-scan on the
  serialized status shape, the subprocess import-graph proof — importing
  app-config.ts or text/dynamic.ts creates NO db file — and the
  transactional field-level patch);
  `test:db` pins the local-SQLite bootstrap (`file:` URL derivation +
  INFRA-ONLY env validations — provider keys are never boot-fatal — real
  boot on a blank dir with all migrations applied,
  idempotent restart, no spurious `.pre-migrate` snapshot, and the
  Dockerfile contract — `drizzle/` shipped next to the server bundle).
- Migrations AUTO-APPLY at app startup (`db/index.ts`, idempotent) — no
  setup step. `db:generate` creates a new migration from schema edits;
  `db:migrate` applies them manually (rarely needed); `db:push` is also
  available for quick dev schema sync — but it syncs SCHEMA only and never
  runs DATA migrations (e.g. 0010): never rely on it for a release whose
  migration rewrites rows.
- `bun run deploy` — `docker compose up -d --build` (see Nitro bullet; needs
  `.env.production` + optionally `.env` for build-time `VITE_*` args).
- Releases: 4-digit `VERSION` + `CHANGELOG.md` (French, Keep-a-Changelog
  style); deferred work lives in `TODOS.md`.

## Architecture

- **Framework**: TanStack Start (file routes in `src/app/`; index (the
  DESKTOP — see Bureau bullet) + aventure + calcul + bibliotheque (relocated
  under the pathless layout `src/app/_bureau/`, public URLs unchanged) +
  parents section, incl. /parents/calcul — /parents stays OUTSIDE the
  desktop grammar).
- **Bureau (the calm fake-OS frame)**: `/` renders the portrait screen OR
  the desktop (3 icons, dblclick native + Enter — the "Ouvrir" fallback was
  REMOVED by user decision 2026-07-22, single click only selects; "Ranger
  le bureau" ritual) — the choice is 100% client (localStorage
  `bureau:session`, shape-guarded, silent failure; pure modules in
  `src/lib/bureau/`, golden-tested via `test:bureau`). The `_bureau` layout
  wraps each mini-app in ONE window (`src/components/bureau/fenetre.tsx`):
  ~85% viewport, drag by title bar only (@dnd-kit, clamp = title bar fully
  visible, commit in left/top — NEVER a persistent transform, it would
  offset /calcul's DragOverlay), reopen always centered, <lg fullscreen
  without drag, print neutralized (`.bureau-fenetre` rules). CONTRACT: the
  layout never sets `ssr` (Selective SSR is inherited down — an `ssr:false`
  would silently make the mini-apps client-only; golden-pinned, no `ssr:`
  option anywhere under `_bureau/`); the closed-session gate
  lives at exactly TWO places (`_bureau` layout as an optimistic overlay +
  `/`), never `__root` (else /parents and /data/$ would be gated). The
  `__root` shell is route-aware: full-bleed for the desktop layer, the
  `max-w-5xl` container is kept for /parents (the window frame provides the
  container inside).
- **Nitro**: `node-server` preset → builds a standalone `.output/server/
  index.mjs` (traced deps included, native libsql binding too) that `bun run
  start` and the Docker image both run. Deploy = `Dockerfile` (multi-stage:
  `node:22-slim` build stage with the bun binary copied in from `oven/bun` —
  bun only installs deps and runs scripts; vite/rolldown MUST run under real
  node, because under bun `ws` resolves as a builtin and the bundle ships a
  bare `import "ws"` that crashes the node runtime — `SKIP_ENV_VALIDATION=1`
  + `VITE_*` build args, legacy-optional since the env→DB settings move —
  also re-exported as runtime ENV for the fallback → `node:22-slim`
  runtime, port 3009) + `compose.yml` (loopback-bound port,
  `app-data` volume on `/app/data`, secrets via `env_file: .env.production`).
  Machine-specific compose changes go in a gitignored `compose.override.yml`,
  never in `compose.yml`.
- **DB**: local SQLite file (libSQL `file:` URL, default
  `file:<DATA_DIR>/app.db`) via `@libsql/client` + Drizzle. `db/index.ts`
  creates the parent dir, opens the client and AUTO-APPLIES drizzle
  migrations at startup (skipped when `SKIP_ENV_VALIDATION` is set, i.e.
  during build; the Dockerfile ships `drizzle/` next to the server bundle
  since the folder is resolved from the CWD). Persisted tables
  (`src/server/db/schema.ts`): `stories`, `story_segments`, `places`,
  `doudous`, `heroes`, `elements`, plus `math_skills` (migration 0009 ; the
  DATA migration 0010, guarded/idempotent, rekeyed it) — one row per
  ACTIVATED operation family (`calcul-pose:<famille>`, presence = activated),
  each carrying that family's parent-chosen palier + the global série size
  (copied on every row, read in canonical family order — settingsFromRows).
  `app_settings` (key/value) additionally carries `ui-language`, the
  `branding:*` keys and the provider settings (`text:*`, `image:*`,
  `tts:*`) — see the Settings bullet.
  The `src/config/*.ts` files seed/back those
  entity tables (editable via in-app CRUD at /parents). Coherence columns
  (nullable, older rows fall back to prior behavior): `stories.story_arc`
  (hidden "fil rouge" frozen at creation), `stories.visual_world` (story-level
  illustration ambiance — time of day, season, weather, light — generated in
  the SAME call as the arc) and `story_segments.scene_hint` (per-beat scene
  description for the illustrator).
- **UI language (multilang phase 1)**: the desktop SHELL is bilingual fr/en —
  a PARENT setting (🌍 card on /parents), persisted in the `app_settings`
  table (key `ui-language`), read ONLY by the `__root` loader
  (`getShellContextFn` — locale + branding in one read, never throws — DB
  down → "fr" + deploy branding) and propagated via
  `LocaleProvider`/`useMessages()` (`src/lib/i18n/`: typed catalogs
  `messages/{fr,en}.ts`, pure `buildBranding`, `normalizeLocale`;
  golden-tested via `test:i18n`). `<html lang>` and the tab title/description
  follow. DISTINCT from `stories.lang` (per-story, frozen at creation) and
  `DEFAULT_LANG` (server-side story default). Since phase 3 STORIES follow
  the UI language at creation (the wizard passes the locale; `Lang` is now
  "fr" | "ru" | "en"): the whole EN corpus (system/beat/arc prompts,
  EN reading-level spec, forbidden/stakes lists, anti-tic soft/softly/gentle,
  validator messages, EN beat/arc schemas with the SAME key order, EN image
  fragments) lives in `src/server/providers/text/english.ts` — the FR/RU
  path in dynamic.ts is byte-frozen and only BRANCHES there on lang==="en".
  CRITICAL divergence: the EN safety scan is WORD-BOUNDARY, never substring
  ("war" ⊂ "warm" would reject core cozy vocabulary; FR keeps its historical
  substring scan). Reading aids (French phonics) are gated to
  `story.lang === "fr"` (player + print: annotations off, toggles hidden);
  the cursive font toggle stays in both. TTS voice map carries
  en-US-AnaNeural. Since phase 4 the WHOLE UI is bilingual — the aventure
  wizard/player chrome, bibliotheque, and every /parents page (entity pages,
  the four CRUD forms via the shared `parents.formulaires` section, the
  playground); templated aria-labels compose via `formatMessage`
  ("Modifier {label}"). What stays family-language ON PURPOSE (decision D5):
  entity DATA (heroes/places/elements/doudous labels + promptHints, DB rows
  and config seeds) and `config/image-models.ts` notes — user data, not UI.
  Since phase 2 the CALCUL mini-app is fully bilingual:
  UI strings via the catalog (aria templates composed with `formatMessage`,
  the tray aria stays stable AT CONSTANT LANGUAGE), énoncés via per-locale
  packs inside `enonces.ts` (pools index-aligned and SAME LENGTH — pool
  length is part of the PRNG contract, same seed → the EN translation of
  the same sentence; digits-only fingerprint means a language switch never
  invalidates a série), tray VARIANTES carry one phrase per locale on a
  single shared pool (counts identical by construction), the A5 sheet
  prints in the workshop language, and `saveMathSettingsFn` returns a CODE
  (never a French sentence — the client's catalog labels it). Bureau
  app labels live in the catalog keyed by the registry id
  (`m.bureau.apps[app.id]` — icon and title bar read the same key). URLs
  never localize (test:routes).
- **Settings service (env → DB)**: `src/server/app-config.ts` is the SINGLE
  choke-point (media-store philosophy) between `app_settings`, env and code
  defaults. Parent-editable settings (Anthropic/Gemini/ElevenLabs keys,
  story/image models, image/TTS toggles, resolution, TTS provider,
  default story lang, the 4 branding values) live in DB rows (canonical
  kebab-case keys, `SETTING_KEYS`), managed at /parents/reglages.
  Precedence: DB row present wins → env value → code default; DB rows parse
  invalid-means-FALLBACK (a garbage bool/enum row falls through, never
  silently disables). NO cache: every server-function handler takes ONE
  immutable `getAppConfig()` snapshot at its boundary and threads it down
  (providers take a `ProviderConfig` param) — never two config generations
  in one operation; a save applies to the very next operation, reload is
  the client consistency boundary (root loader keeps `staleTime: Infinity`
  + `router.invalidate()` in the saving tab). Boot validation is
  INFRA-ONLY (`DATABASE_URL` stays fatal; provider keys are checked at
  point of use — no network call when unconfigured, child keeps the soft
  "On réessaie ?", /parents shows a calm config-status CODE). SECRETS:
  never serialized to the client ({configured, hint, source} only — hint =
  last 3 chars); four operations per secret: keep (no write) / set /
  explicit empty override (`""` row masks the env key — the honest
  "Effacer") / reset-to-deploy-default (delete row, env resumes). ALL
  writers go through `setSetting`/`applySettingsPatch` (field-level patch,
  ONE `db.batch` transaction — disjoint two-tab saves never clobber), incl.
  `saveUiLocaleFn`. HARD RULE: app-config.ts never imports `~/server/db` at
  top level (lazy import inside read/write fns) — the coherence goldens'
  import graph stays db-free (pinned by test:settings). `app.db` backups
  now contain keys — same care as `.env`.
- **Branding (runtime, DB-backed)**: the branding SOURCE (child name + the
  3 full-string overrides) is a runtime setting (`branding:*` rows, section
  "Le prénom & l'atelier" on /parents/reglages with a live preview) — the
  legacy `VITE_*` vars stay honored as deployment defaults
  (`envFallbackConfig`: process.env at runtime, then the build-baked
  value). `src/config/app.ts` keeps only the PURE `composeBranding(lang,
  source)` (per-locale derivation via `buildBranding` — French d'-elision,
  English possessive — + full-string overrides). The root loader
  (`getShellContextFn`) returns `{locale, branding, brandingSource}`: head
  tags and the portrait read it (rename the child → next reload, NO Docker
  rebuild). STORY-LANG rule: the print colophon (`Colophon lang=` prop) and
  the server fallback story title derive via `composeBranding(story.lang)`
  — an English story printed under a French UI keeps English branding; the
  operations sheet uses the workshop locale. Sample
  heroes in `src/config/characters.ts` — meant to be replaced by each family
  (they only seed empty tables; an already-populated db wins).
- **LLM**: Vercel AI SDK (`ai` + `@ai-sdk/anthropic`), `generateObject` + the
  Zod beat schema (see text adapter). Model from `STORY_MODEL`.
- **Providers** in `src/server/providers/{text,image,tts}/`: text and image
  are plain modules called by concrete name (`generateBeat`/`generateStoryArc`
  in `text/dynamic.ts`; `generateImage` in `image/nanobanana.ts`) — no
  interface seam (one implementation each, see the adapter-census note in
  `types.ts`); only TTS keeps a real seam (`TtsProvider` in `types.ts`, two
  adapters, env-switched via `getTtsProvider()` in `tts/index.ts`):
  - text: `dynamic.ts` (the SOLE text provider;
    required) — choose-your-own-adventure beats. Per-beat Zod schema (`title`
    meaningful on the opening beat only, 1–3 short paragraphs — capped at 2 on
    landing beats, exactly 2 choice labels or null on the final beat,
    `sceneHint`) PLUS content guard-rail: `safetyProblems` (fatal — hero
    named, narration never ends on a question, `forbidden-terms.ts`
    scary/sad-term + stakes/evaluation-language scan, `sceneHint` included
    since it drives the illustration) and
    `structureProblems` (non-fatal — length/readability) → up to 3 corrective
    attempts with problems fed back into the prompt (only a SAFETY failure
    drops the child's saveur on the next attempt) → if the text is safe but
    structure still off, `coerceBeat` salvages a valid beat → else typed
    soft-failure → "On réessaie ?".
  - text coherence (same file): a hidden
    story arc ("fil rouge": goal → milestones → ending image) PLUS the
    story's visual world (one-sentence illustration ambiance) are generated in
    ONE call at creation (15s bound, best-effort — null never blocks the
    first page); the arc is injected into EVERY beat prompt so the story
    advances along one thread and the surprise element pays off. Each beat also
    emits a `sceneHint` (where the action happens NOW) that the image prompt
    prefers over the frozen place hint; prior beats' sceneHints are rendered
    into the history block + a CONTINUITÉ system clause, so the new scene keeps
    the same time/light/setting unless the story explicitly moved.
    Structure guard adds an anti-"doux" repetition retry (>1
    "doux/douce/doucement" per beat → non-fatal corrective rewrite), and the
    last 2 beats get a `remainingChoices` countdown so the ending is prepared
    instead of hitting the mustEnd wall. The same countdown drives the landing
    DECRESCENDO (`isLanding`): the beats carrying the last 2 choices + the
    final beat are asked shorter (2 phrases, schema `paragraphs.max(2)`,
    non-fatal 4+-sentence nudge) — the story winds down because a beginning
    reader tires by the end; the opening beats keep their 2–3-sentence richness.
  - image: `nanobanana.ts` = Gemini image models, behind `IMAGE_ENABLED`.
    The illustration prompt is assembled by the pure `buildSegmentImagePrompt`
    (`image/segment-prompt.ts`, byte-identity golden-pinned).
    Consistency: beats after the first pass the story's EARLIEST illustration
    as an image input (reference) so characters/style stay stable page to page,
    and the prompt carries the story's frozen `visual_world` as the DEFAULT
    ambiance (the beat's own sceneHint keeps priority on location) so pages
    stop drifting from day to night.
    The reference is fetched server-side (10s bound); https refs are
    allowlisted to THIS app's own Blob store host when the rw token is set
    (else to `*.public.blob.vercel-storage.com` — SSRF defense-in-depth) and
    local refs must stay inside the media dir. Any failure degrades to plain
    text-to-image — never fails the beat's image. Gemini call aborts at 90s.
  - tts: `edge` (msedge-tts, default) / `elevenlabs`, behind `TTS_ENABLED`,
    selected via `getTtsProvider()`.
- **Secrets**: DB rows (`app_settings`, via app-config.ts) with env read
  only in `src/env.ts` (server) as fallback. Vite exposes only `VITE_*`;
  all keys/LLM calls live in server functions (`src/server/*-functions.ts`,
  story generation in `dynamic-functions.ts`); no secret ever crosses the
  server-fn boundary (masked {configured, hint} shape, golden-pinned).
- **Generated media** (`src/server/providers/media-store.ts`, single
  choke-point): dual backend gated on env. Local (default, Docker volume) when
  `BLOB_READ_WRITE_TOKEN` is absent → writes `DATA_DIR/media/` (gitignored),
  returns a `/data/media/<file>` web path served by the `/data/$` route.
  Vercel Blob when the token is set (ephemeral filesystems) → uploads and
  returns a public `https://` CDN URL. The `/`-prefix (local) vs `https://`
  (blob) IS the back-compat boundary; old rows of either kind keep working.
  Read-back: `resolveStoredMediaForModel` hides both branches (https
  allowlisted to the app's own Blob host — rw-token-derived, else
  `*.public.blob.vercel-storage.com`; local paths rejected if they escape the
  media dir). BOTH TTS adapters and the image provider persist through
  `saveMedia` — nothing writes media paths by hand.
- **Reading aids** (`src/lib/reading-aids/`): pure French-phonics annotator
  (silent letters + mandatory liaisons, CP-book style), golden-tested;
  decorative CSS only (`.story-silent`, `.story-liaison-*`) — copied text stays
  byte-identical.
- **Operations mini-app** (`src/lib/operations/`, pure module, golden-tested
  via `test:operations`): seeded deterministic generator (mulberry32 — an
  interrupted série regenerates IDENTICALLY from (palier, seed)), shared
  screen/print layout geometry, template énoncés (hero/doudou word problems,
  NO LLM call), and the palier ladder (`progression.ts`, 7 paliers grouped in
  3 canonical families — addition/soustraction/multiplication) which is
  purely DESCRIPTIVE: the parent prepares the SHELF at /parents/calcul (one
  card per family: activated + that family's palier; the last active family
  cannot be deactivated) — NO automatic progression, no comfort score, no
  evaluation of the child (the calm constraint applies in full). `/calcul`
  opens on the TRAY SHELF (`src/components/calcul/tray-shelf.tsx`): one tray
  per activated family — a scene (frozen object counts, no numbers,
  in-palette SVGs), sign medallion, phrase; each family has a small set of
  scene+phrase variants rotated PER DAY (`varianteDuJour`, pure, seeded on
  famille+local day — UX 2026-07-23: never "toujours des marrons"; stable
  within a day, aria-label never changes) — the child picks a tray, never
  sees a level; a non-activated family does NOT exist on screen (no greyed
  tray). The template énoncés draw from seeded pools too (objects,
  containers, verbs — multiplication is no longer always "paniers"). Then the "série qui se range" runs unchanged: free writing on a soft
  numpad — tap into the selected cell or drag the digit tile straight onto a
  grid cell (`@dnd-kit/core`: draggable keys, droppable cells, DragOverlay
  ghost, forgiving drop for small fingers; everything inks like pencil, never
  red), self-comparison with the solved operation. The série resumes PER
  FAMILY (localStorage key per family, shape-guarded; the "sorti" tray state
  uses the full resumable predicate, never key-existence; a one-time bridge
  migrates the pre-shelf `calcul:serie` key; storage failure degrades
  silently — the child never sees an error) — this whole lifecycle (legacy
  bridge, authoritative purge, resume, `calcul:settings` cache) lives in
  `src/lib/operations/serie-session.ts` behind a `SerieStorage` port
  (localStorage in prod via `browserSerieStorage()`, in-memory in goldens);
  the route keeps only rendering + DnD wiring. Back arrow exists ONLY in a
  série ("Reposer le plateau" → shelf); the shelf has NO arrow — the window
  close is the way home (UX 2026-07-23: redundant arrow + drawn shelf plank
  removed); the end of a
  série is a 🌿 transition back to the shelf, never a destination. Server
  functions in `src/server/math-functions.ts` read/write `math_skills` (one
  atomic `db.batch` save; zod cross-checks palier↔family); dirty ids are
  repaired (`resolvePalierForFamille`, `settingsFromRows`) and série size
  always clamped — a hand-edited row or cache never errors. A5 sheets per
  family via `PrintableOperationsSheet`
  (`src/components/printable-operations.tsx`).

## Print

`PrintableStory` + `@media print` A5 in `globals.css`. `window.print()` from the
story screen. No url/header/technical noise; the discreet footer comes from
`appConfig.storyLabel`. `PrintableOperationsSheet` reuses the same A5 print
setup for the posed-operation sheets (triggered from /parents/calcul).

## Deploy Configuration (configured by /setup-deploy)
- Platform: self-hosted Docker Compose (this machine)
- Production URL: http://localhost:3009 (loopback; remote family access via a
  private gitignored overlay — see compose.override.yml, never committed)
- Deploy workflow: none (no CI) — deploy is manual via `bun run deploy`
- Deploy status command: `docker compose ps --format '{{.Name}} {{.Status}}'`
- Merge method: merge commit (matches PR #1-#6 history)
- Project type: web app (SSR, TanStack Start)
- Post-deploy health check: `curl -sf http://localhost:3009/` (expect 200 +
  page content; migrations auto-apply when the container starts)

### Custom deploy hooks
- Pre-merge: `bun run check-types && bun run lint && bun run test`
- Deploy trigger: `bun run deploy` (docker compose up -d --build; brief
  downtime while the app container restarts)
- Deploy status: `docker compose ps` (app + sidecar "Up")
- Health check: poll http://localhost:3009/ until 200 (build takes ~2-4 min)

## gstack (REQUIRED — global install)

**Before doing ANY work, verify gstack is installed:**

```bash
test -d ~/.claude/skills/gstack/bin && echo "GSTACK_OK" || echo "GSTACK_MISSING"
```

If GSTACK_MISSING: STOP. Do not proceed. Tell the user:

> gstack is required for all AI-assisted work in this repo.
> Install it:
> ```bash
> git clone --depth 1 https://github.com/garrytan/gstack.git ~/.claude/skills/gstack
> cd ~/.claude/skills/gstack && ./setup --team
> ```
> Then restart your AI coding tool.

Do not skip skills, ignore gstack errors, or work around missing gstack.

Using gstack skills: After install, skills like /qa, /ship, /review, /investigate,
and /browse are available. Use /browse for all web browsing.
Use ~/.claude/skills/gstack/... for gstack file paths (the global path).
