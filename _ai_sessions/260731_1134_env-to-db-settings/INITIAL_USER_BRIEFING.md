# Session 260731_1134 — env vars → UI + DB settings

## User briefing (verbatim)
"Right now we extensively rely on the environment variables for setup. From now on, I want them to be set in the UI and stored in the database. No need to use gstack-related skills."

## Orchestrator's success definition
A parent configures kidOS entirely from the /parents UI — API keys, model choices,
feature toggles (images/TTS), TTS provider, child name/branding — persisted in the
local SQLite DB. No .env editing, no rebuild. True infra vars (DATA_DIR, PORT,
SKIP_ENV_VALIDATION) stay env. Existing deploys keep working (env as fallback).
Calm constraint + golden-test contracts survive. Ship via repo conventions
(VERSION bump, French CHANGELOG, PR, merge-commit).

## Completion check (defined up front)
- All `bun run test` suites + check-types + lint green
- /browse QA: settings page loads under /parents, save round-trip works, secrets
  masked, toggles apply without rebuild, story generation works with a DB-stored key
- Env-only deploy (no DB rows) still boots and behaves as before
- Handoff: exec summary + decision log in _ai_sessions/260731_1134_env-to-db-settings/
