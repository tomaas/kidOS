# English language convention switch — decision log (260731)

- History rewrite: `git filter-branch --msg-filter` over 398ffb6..main,
  mapping by `$GIT_COMMIT` SHA to per-commit message files in
  `workdir/msg-map/` (safer than first-line matching). Merges preserved.
- main: 2b96316 → c9cd87e (message-only; tree f0172c2 identical, 8 commits,
  `git diff old new` empty). After PR #27 merge: main = 469bd65.
- Deliberate French kept in rewritten messages: quoted UI labels only
  ("On réessaie ?", "Sans clé configurée…", "Revenir au réglage du
  déploiement", "Effacer") — they name real on-screen strings.
- CHANGELOG.md fully translated (0.2.0.0 → 0.6.0.0); quoted UI strings
  kept in French for the same reason. CLAUDE.md release bullet now states
  the English convention (changelog + commits/PRs).
- Remote branch `settings-ui-integration` was already deleted (GitHub
  auto-delete at PR #26 merge) — push :delete errored "remote ref does not
  exist", no action needed.
- Pre-push redact hook did not flag anything (no GSTACK_REDACT_PREPUSH
  bypass needed).
- gbrain clone ~/gbrain-code-repos/kidos hard-reset to rewritten
  origin/main; freshness service exits 1 as expected (other clones), log
  shows `[kidos] up to date (469bd65…)`.
