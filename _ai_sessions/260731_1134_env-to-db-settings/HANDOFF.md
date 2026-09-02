# HANDOFF — env → DB settings (260731_1134, v0.6.0.0, PR #26 → main 2b96316)

Read `EXEC_SUMMARY.md` first. This file is for the next agent/dev picking up
anything touching settings, providers, branding, or the golden lattice.

## Artifact map (all under `workdir/`)

| Artifact | File |
|---|---|
| Design doc (env inventory, classification, target architecture C1–C10; amended in place after codex round 1) | `260731_1136_design-doc.md` |
| Chunk plan (5 chunks + final QA checker briefing) | `260731_1136_chunk-plan.md` |
| Codex review 1 — design (2 BLOCKERS + 13 findings, all folded into the design doc) | `codex-review-turn-1.md` |
| Codex review 2 — diff (FIX-FIRST verdict: 3 test-strength SHOULD-FIX + 1 NIT, all fixed) | `codex-diff-review.md` |
| Builder decisions per chunk + fix round | `260731_1210_builder-decisions.md` |
| Consolidated session decision log (single page) | `260731_1239_decision-log.md` |
| Final QA report (PASS all items, verdict SHIP) + screenshots | `260731_1241_qa-report.md`, `qa/` |
| Merge message as landed | `260731_1420_merge-message.md` |
| Raw codex pty logs | `codex-pty-turn-1.log`, `codex-diff-pty.log` |

## Contracts you must NOT break

1. **Choke-point rule**: `src/server/app-config.ts` is the ONLY place provider
   configuration is resolved. **Nothing reads `serverEnv` for provider config
   anymore** (keys, models, toggles, resolution, TTS provider, default lang).
   `serverEnv` survives only as the env-fallback source INSIDE app-config, plus
   the true-infra readers (`db/index.ts`, `media-store.ts` for
   BLOB_READ_WRITE_TOKEN/DATA_DIR). Adding a `serverEnv.x` read in a provider
   reintroduces the split-brain this session removed.
2. **One snapshot per logical operation**: each server-fn handler takes ONE
   `getAppConfig()` at its boundary and threads it (or a sub-config) down as a
   parameter. No cache exists — do not add one without measurement; never call
   `getAppConfig()` twice inside one operation (mixed-generation bug).
3. **Central writers only**: every `app_settings` write goes through
   `setSetting`/`deleteSetting`/`applySettingsPatch` (one `db.batch`
   transaction, validation pre-batch). This includes `saveUiLocaleFn`. No
   direct drizzle writes to that table.
4. **Secrets never serialized**: server fns return `{configured, hint,
   source}` — never the value. The `test:settings` boundary scan runs a real
   ephemeral dev server and greps raw wire bytes; it WILL catch you.
5. **Four secret operations** (keep / set / `""` explicit override / delete
   row) are semantic, golden-pinned, and UI-exposed. "Delete row" alone is NOT
   "clear" — it reactivates the env key.
6. **Import graph**: `app-config.ts` must never statically import
   `~/server/db` (lazy `await import` only) — subprocess golden pins that
   importing it creates no db file. Keeps the coherence goldens db-free.
7. **`test:settings` stays in the `bun run test` chain** (adds ~15s for the
   ephemeral-server boundary test — accepted deliberately). Prompt byte-pins
   (test:golden/test:coherence) were untouched and must stay so.
8. **Boot validation is infra-only** (DATABASE_URL fatal; keys never). Missing
   key = deterministic config-status code (`ready`/`off`/`missing-key`) for
   /parents + calm child soft-failure with ZERO provider network calls.
9. **Branding**: `composeBranding` is pure; root loader ships `{locale,
   branding, brandingSource}`; print colophon + server fallback title derive
   from the STORY's frozen `lang`, never the UI locale. `buildBranding` and
   `matchesChildName` byte-pins unchanged.
10. **PRAGMA order in `db/index.ts`**: `busy_timeout` BEFORE
    `journal_mode=WAL` (the found bug). Reordering resurrects SQLITE_BUSY on
    concurrent 2-process boot.

## Open items for whoever comes next

- Retire the legacy `VITE_*` fallback one release after 0.6.0.0 (`TODOS.md` has
  the exact file list: Dockerfile ARG/ENV, compose.yml line, `envFallbackConfig`).
- Docker build path untested by QA pre-deploy (post-deploy health check only) —
  verify a real story generation on the box.
- Delete `/home/user/Developer/worktrees/settings-ui-env-to-db-260731-archive`.
- `status.features` codes are rendered only for `missing-key` (one calm line);
  `off`/`ready` intentionally render nothing.
- `story:default-lang` is API-writable but has no UI control (near-obsolete by
  design — the wizard passes the locale).
