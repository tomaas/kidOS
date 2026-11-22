# Pre-commit hook

kidOS runs a [Lefthook](https://lefthook.dev/) pre-commit hook on the staged files: the formatter, the linter, then React Doctor on UI files. It comes from agent-core's `templates/pre-commit` (v1.6.0). Its config is `lefthook.yml`; `test:pre-commit` (`scripts/pre-commit.test.ts`) pins its intent. It catches a format or lint error before the commit exists, so a fix never has to move a pushed head.

## What runs

The jobs run one after the other (`piped: true`); the first failure stops the commit. A job with no matching staged file is skipped.

| Order | Job | Files | Command |
| --- | --- | --- | --- |
| 1 | `format` | every extension oxfmt handles (js, jsx, mjs, cjs, ts, tsx, mts, cts, json, jsonc, json5, webmanifest, md, css, yml, yaml, html, toml) | `bun x --no-install oxfmt --no-error-on-unmatched-pattern {staged_files}`; fixed files are staged again (`stage_fixed: true`) |
| 2 | `lint` | same | `bun x --no-install ultracite check {staged_files}` (Oxlint type-aware, then `oxfmt --check`, as `bun run lint`) |
| 3 | `react-doctor` | `src/{app,components}/**/*.{ts,tsx}` | `npx -y react-doctor@latest --no-score --no-supply-chain --blocking error {staged_files}` |

- `format` and `lint` skip the paths that `oxlint.config.ts` and `oxfmt.config.ts` ignore (`data/`, `_ai_sessions/`, `.claude/`, `.agents/`, `drizzle/`, generated `*.gen.*` files such as the route tree, the `.tanstack/`, `.nitro/` and `.gstack/` caches). A commit that stages only such files then skips both jobs instead of failing on "No files found to lint".
- React Doctor gets the staged file paths. Only an error blocks; warnings print and the commit goes through. `--no-score` and `--no-supply-chain`: no score upload, share URL or Socket.dev scan. It is unpinned on purpose (always the newest release); the registry check costs about 1 s per commit that touches UI files.
- No typecheck, tests or build in the hook, and no pre-push hook. Those stay in `bun run check-types`, `bun run test` and `bun run build` (see "Custom deploy hooks" in `CLAUDE.md`).

## How it installs

`bun install` runs the `prepare` script, the only installer. Two guards:

1. **`prepare`** installs the hook (`lefthook install --force`) only inside a git checkout and only when lefthook is on PATH (a pinned devDependency, so `bun install --production` skips it). It never installs when `core.hooksPath` is set (see below).
2. **`trustedDependencies` without lefthook.** The lefthook npm package has its own `postinstall`, which would install the hook whatever `prepare` decides. `trustedDependencies` replaces bun's default trust list, so lefthook's script is blocked. The list holds only the packages whose install script kidOS needs (today `esbuild`, measured with `bun pm untrusted`); lefthook is never on it. A new dependency that needs its install script goes on the list.

Docker builds are not affected: the Dockerfile runs `bun install --frozen-lockfile --ignore-scripts` and the build context has no `.git`.

In a `git worktree add` worktree, the hook goes into the main clone's shared `.git/hooks`, so every worktree gets it.

## When `core.hooksPath` is set

If `core.hooksPath` is set at any level (system, global or the repo's own config), `bun install` prints one line and installs nothing:

```text
lefthook: core.hooksPath is set, pre-commit hook not installed (docs/pre-commit.md)
```

A global `core.hooksPath` directory is shared by every repo on the machine (for example a build account's main-push guard); installing there would overwrite it. To get the hook, unset it where it is set, then install again:

```sh
git config --show-origin core.hooksPath   # where it is set
git config --unset core.hooksPath         # or --global --unset, if that is where it is
bun install
```

## Skipping it (humans only, emergencies)

- `LEFTHOOK_EXCLUDE=react-doctor git commit …` skips one job (comma-separated names for more).
- `LEFTHOOK=0 git commit …` skips the whole hook.

Agents and bots never skip it (`AGENTS.md`, "Git hooks").

## Is it active?

agent-core's read-only `hooks-check` tells:

```sh
~/.cache/agent-core/<tag>/tools/hooks-check/hooks-check /path/to/kidOS
```

It prints `active`, `configured-not-installed` (run `bun install`), `hooks-path-set` (see above), `none` or `unknown`.

## Timings

Measured on nuc-lab (shared host) on 2026-11-22, warm npx cache, in a fresh clone:

| Commit | Hook time |
| --- | --- |
| 1 UI file | about 5-6 s (React Doctor about 3-4 s of it) |
| 34 files, 26 of them UI | about 6 s |
| 1 non-UI file (React Doctor skipped) | about 1 s |
| only ignored paths (`_ai_sessions/`, `.agents/`) | under 0.1 s (every job skipped) |
