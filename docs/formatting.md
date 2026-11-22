# Linting and formatting

kidOS lints and formats with [Ultracite](https://www.ultracite.ai/) on the Oxlint + oxfmt stack (the same as agent-board). Versions are pinned exactly in `package.json`: `ultracite`, `oxlint`, `oxlint-tsgolint` (type-aware rules) and `oxfmt`.

## What runs

- `bun run lint` runs `ultracite check`: `oxlint` (type-aware, through `oxlint-tsgolint`) then `oxfmt --check`. It fails on any lint error or on a file that is not formatted; warnings are reported but do not fail it.
- `bun run lint:fix` runs `ultracite fix`: `oxlint --fix` (safe fixes only) then `oxfmt --write`. Review the diff: a safe fix is still a code change.
- The pre-commit hook runs the same formatter and linter (plus React Doctor) on the staged files: [pre-commit.md](pre-commit.md).

Configuration:

- `oxlint.config.ts`: the Ultracite presets `core`, `react` and `tanstack`, plus kidOS's opt-outs. Each opt-out carries a `// WHY:` line; local settings win over the presets.
- `oxfmt.config.ts`: Ultracite's formatter preset (80 columns, double quotes, sorted imports, sorted `package.json`, Tailwind classes sorted against `src/app/globals.css`), plus the ignored paths.

Both configs ignore `data/`, `_ai_sessions/`, `.claude/`, `.agents/` (vendored skills), `drizzle/` (drizzle-kit output), the generated route tree and build outputs.

An inline exception is one line, with the rule and the reason:

```ts
// oxlint-disable-next-line no-await-in-loop -- sequential retries by design
```

Never reorder object keys by hand or by a tool in the zod schemas: key order is the JSON property order sent to the model and `test:coherence` pins it (`sort-keys` stays off).

## Blame

The mechanical codemod commits (formatter output, safe-fix output) are listed in `.git-blame-ignore-revs`. To skip them in `git blame`, once per clone:

```sh
git config blame.ignoreRevsFile .git-blame-ignore-revs
```
