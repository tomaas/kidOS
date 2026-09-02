# Builder decisions/learnings — env→DB settings (branch settings-ui/env-to-db-260731)

## Chunk 1 — app-config service
- **Status shape built pure (`settingsStatusFromRows(rows, fallback)`)** instead of only inside a server fn: lets the boundary secret-scan golden prove non-disclosure without invoking `createServerFn` machinery (which the repo's goldens never do). Chunk 3's server fn is a thin wrapper over it.
- **`source` badge is EFFECTIVE truth**: an invalid DB row (e.g. `image:resolution=8K`) reports `source:"default"` — the "par défaut (env)" badge never claims a garbage row applies. Edge case accepted: a `""` text row equal to an empty fallback reads as "db"; harmless (values identical).
- **Transaction-failure pin is validation-level**: `applySettingsPatch` validates every key BEFORE building statements, so a mixed valid+invalid patch provably writes nothing. A true SQL-level mid-batch failure can't be injected through the typed API; libsql `db.batch` atomicity (same idiom as saveMathSettingsFn) covers that layer.
- **Env fallback = frozen `serverEnv` + call-time `process.env.VITE_*`**: provider fallbacks keep env.ts as single source of defaults (restart-scoped, as today); branding VITE_* read at call time since they're not in serverEnv and the Dockerfile will pass them as runtime env during the legacy-fallback release.
- **test:db pins**: no existing pin asserted the key-required behavior, so the change is one ADDED pin (boot passes with zero keys, IMAGE_ENABLED=true, TTS elevenlabs) — no pin rewritten.

## Chunk 2 — snapshot threading
- Providers take the full `ProviderConfig` (not per-provider micro-configs): one shape, no drift, type-only import keeps the golden import graph db-free. `logTextGen` gains a `model` param (stays sync — codex #4/#7).
- ElevenLabs adapter became a factory `elevenLabsTtsProvider(apiKey)` — the only way to thread the key through the `TtsProvider` seam without changing the interface.
- Missing-key point-of-use: `startDynamicStoryFn` short-circuits BEFORE the arc call (zero network); child wording unchanged ("On réessaie ?"); parent-facing status comes from `featureStatuses` (codes "ready"/"off"/"missing-key", distinct from provider-failure codes).

## Chunk 3 — /parents/reglages
- Non-secret text field emptied on save → server converts `set ""` to `delete` (the badge must tell the truth; a `""` row would be read-side ignored anyway). Secrets keep `""` = explicit mask.
- Per-SECTION save buttons = natural field-level disjoint patches (two tabs on different sections can't clobber).
- `story:default-lang` is writable through the API but has NO UI control (design C7 lists only Histoires/Images/Voix; near-obsolete since the wizard passes the locale) — not an inert control, just absent.

## Chunk 4 — runtime branding
- `src/config/app.ts` reduced to pure `composeBranding(lang, source)`; `childName`/`brandingFor`/`appConfig` consts DELETED (all 4 consumers rewired — no dead code kept).
- Branding source reaches components via `getRouteApi("__root__").useLoaderData()` (no new context provider; LocaleProvider untouched).
- VITE_* fallback = `process.env` (runtime, Docker re-exports ARGs as ENV) then build-baked `import.meta.env` — an existing deployment keeps its branding through the upgrade with zero action.
- Colophon: `lang` prop — story pages pass `stories.lang` (codex #5), the operations sheet passes the workshop locale.
- Live proof on dev :3011: `branding:child-name` row → `<title>L'atelier de Léa</title>` without rebuild; planted secret absent from the /parents/reglages SSR payload (only "…345" hint).

## Chunk 5 — docs/release
- v0.6.0.0 (minor bump: feature release). TODOS entry for removing the legacy VITE_* fallback one release later.

## Fix round (codex diff-review turn 2)
- **Compiled createServerFn can't execute outside the Start runtime** (vite splits handler/RPC; raw bun call returns undefined). The honest boundary test = HTTP against an ephemeral dev server: real functionIds scraped from the vite-transformed client module (base64 {file, export}), real RPC GET/POST (seroval body, Sec-Fetch-Site: same-origin for the CSRF middleware) + the SSR page — raw wire bytes scanned. Adds ~15s to test:settings; judged worth it (it's the exact serialization users get).
- **Real bug found by the new concurrency test**: `PRAGMA journal_mode=WAL` ran BEFORE `busy_timeout` in db/index.ts — the WAL switch takes a lock, so a second process booting during a write crashed SQLITE_BUSY. Fixed by ordering busy_timeout first. test:settings stable 3/3 runs.
- Rollback now proven at the SQL layer (NOT NULL violation injected on a LATER batch statement via a type-cast null) — pre-validation keeps its own renamed pin.
- features.* rendered as one calm line ("…reste en pause pour le moment.") only on missing-key; "off"/"ready" show nothing on purpose.
