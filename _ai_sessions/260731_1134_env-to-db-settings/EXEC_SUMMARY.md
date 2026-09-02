# Exec summary — env → DB settings (session 260731_1134, shipped v0.6.0.0)

**PR #26 merged to main (2b96316) and deployed to the local Docker box** (health
check passed at session end).

## What shipped

kidOS is no longer configured by editing `.env`. All parent-meaningful settings
— Anthropic/Gemini/ElevenLabs API keys, story & image models, image/TTS
toggles, resolution, voice provider, and the workshop branding (child's name +
3 override strings) — now live in the SQLite `app_settings` table, edited on a
new **/parents/reglages** page (fully bilingual fr/en, calm card grammar,
neutral "non configurée" states — no red, no urgency).

## How to use it

Open **/parents → Réglages**, paste your keys, save per section. Precedence is
**DB > env > code default**: env is now just the *deployment fallback* ("réglage
du déploiement" badge). Every save applies on the next server operation — no
rebuild, no restart. First-run story is now: `docker compose up` → open
/parents/reglages → paste the Anthropic key.

Secrets are never sent back to the client (only `{configured, hint "…789"}`),
and each secret field has four explicit operations: keep (leave blank), set,
**Effacer** (explicit empty override — genuinely masks an env key), and
**Revenir au réglage du déploiement** (delete row → env resumes).

## What changed operationally

- `.env.production` can shrink to infra-only; provider config is optional there.
- **Rename the child without a Docker rebuild**: branding is runtime data now
  (tab title, portrait, print colophon follow on reload; the colophon follows
  the STORY's frozen language, not the UI locale). `VITE_*` build args still
  work as legacy fallback for one release.
- Boot validation is **infra-only** (DATABASE_URL stays fatal; a missing key
  never blocks boot — the child gets the calm "On réessaie ?" soft-failure,
  zero outbound provider call).
- New `test:settings` golden in the `bun run test` chain (47 assertions):
  precedence matrix, four secret ops, a REAL server-fn boundary scan (ephemeral
  dev server, raw wire bytes scanned for planted secrets), real 2-process
  concurrency, real SQL-level rollback inside `db.batch`.

## The found-bug story

The new 2-process concurrency golden exposed a **pre-existing** bug in
`db/index.ts`: `PRAGMA journal_mode=WAL` ran before `busy_timeout`, so a second
process booting during a write crashed with SQLITE_BUSY. Fixed (busy_timeout
first); the golden now pins it. A test written to prove new guarantees paid for
itself on day one.

## Deliberately NOT moved to the UI

`BLOB_READ_WRITE_TOKEN` (selects the media backend and derives the SSRF
allowlist — a deployment-mode property, parent-editable would be a foot-gun),
`DATA_DIR`, `PORT` (chicken-and-egg: you can't store the DB's own location in
the DB; ports/paths are the operator's contract with Docker).

## Leftovers

- **VITE_* fallback retirement** is queued in `TODOS.md` (one release after
  0.6.0.0).
- **Docker build path was NOT exercised by QA** before the deploy (briefing item
  9 "si la machine le permet") — the orchestrator's post-deploy health check is
  the only Docker-path evidence; watch the first real story generation.
- **Worktree archive flagged for deletion**:
  `/home/user/Developer/worktrees/settings-ui-env-to-db-260731-archive` (merged
  branch; safe to remove when convenient).
