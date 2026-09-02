# Consolidated decision log — env → DB settings (260731_1134)

One page, session-wide. Per-chunk detail in `260731_1210_builder-decisions.md`;
design rationale in `260731_1136_design-doc.md` (C1–C10).

1. **Storage = extend `app_settings`, no new table** — key/value pattern already
   proven by `ui-language`; ~14 string rows, a typed table buys nothing.
2. **Precedence DB > env > default, pure fallback, NO boot seed** — copy-on-boot
   would silently duplicate secrets into the DB and ignore later .env rotation.
3. **NO cache** (codex #3/#4) — one immutable `getAppConfig()` snapshot per
   server operation, threaded down as a parameter; removes invalidation races
   and cross-process staleness at negligible SQLite cost.
4. **Boot validation infra-only** (codex BLOCKER #1) — a key living only in
   SQLite must never fail boot; key checks moved to point-of-use with
   deterministic status codes (`ready`/`off`/`missing-key`) + calm child
   soft-failure, zero network when unconfigured.
5. **Four secret operations** (codex BLOCKER #2) — keep / set / explicit `""`
   override (honest "Effacer", masks env) / delete row (reset to deploy
   default). Delete alone would silently reactivate the env key.
6. **Invalid-means-FALLBACK** DB parsing (codex #14) — a garbage row falls
   through to env/default, never forces `false`; its badge reports the
   effective source, never claims the garbage row applies.
7. **Central writers only** — `setSetting`/`applySettingsPatch` (one `db.batch`
   transaction, field-level patch); `saveUiLocaleFn` rewired through them;
   per-section save buttons make two-tab disjoint saves safe by construction.
8. **`app-config.ts` never statically imports `~/server/db`** — lazy import,
   pinned by a subprocess "no db file created" golden, keeping the coherence
   goldens db-free under SKIP_ENV_VALIDATION.
9. **BLOB_READ_WRITE_TOKEN / DATA_DIR / PORT stay env** — deployment-mode
   properties (media backend + SSRF allowlist; DB can't store its own
   location); parent-editable would be a foot-gun with zero family value.
10. **Branding goes runtime** — `composeBranding` pure, root loader carries
    `{locale, branding, brandingSource}`; consts `childName`/`appConfig`
    deleted (all consumers rewired, no dead code); VITE_* honored as runtime
    env fallback for one release (Dockerfile ARG→ENV).
11. **Story-language branding** (codex #5) — print colophon + server fallback
    title derive via the STORY's frozen `lang`, never the UI locale.
12. **Reload = client consistency boundary** (codex #10) — root loader keeps
    `staleTime: Infinity`; saving tab calls `router.invalidate()`, other tabs
    converge on reload. Documented, no revalidation machinery.
13. **Boundary tests at the real wire** (diff-review fix round) — compiled
    `createServerFn` can't run outside the Start runtime, so `test:settings`
    spins an ephemeral dev server and scans real RPC + SSR bytes for planted
    secrets; +15s accepted.
14. **Real concurrency test found a pre-existing bug** — `busy_timeout` must
    run BEFORE `journal_mode=WAL` in `db/index.ts` (WAL switch takes a lock →
    second booting process crashed SQLITE_BUSY). Fixed + pinned, stable 3/3.
15. **Chunk hygiene** — branding UI inputs shipped WITH the runtime-branding
    chunk (codex #7: no inert controls in any mergeable state); `story:
    default-lang` API-writable but deliberately has no UI control.
