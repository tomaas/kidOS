// The pre-commit hook's intent, from agent-core's templates/pre-commit (agent-board pilot DEV-2022).
// An EXAMPLE: a project copies it (e.g. to scripts/pre-commit.test.ts) and runs it with `bun test`.
// agent-core itself does not run it.
//
// package.json's `prepare` is the only installer: bun must not run lefthook's own postinstall,
// which installs the hook whatever `prepare` decides, and `prepare` never writes into a
// core.hooksPath directory that other repos share. The tests assert that intent, never the exact
// `prepare` string.
import { afterAll, describe, expect, test } from "bun:test";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// ADAPT: every extension the project's formatter handles (oxfmt 0.71 here). format and lint must
// take each of them, so a staged file of any of these kinds is never skipped.
const FORMATTER_EXTENSIONS = [
  "js",
  "jsx",
  "mjs",
  "cjs",
  "ts",
  "tsx",
  "mts",
  "cts",
  "json",
  "jsonc",
  "json5",
  "webmanifest",
  "md",
  "css",
  "yml",
  "yaml",
  "html",
  "toml",
];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

// The project root: the nearest directory above this file with a package.json.
const findRoot = (start: string): string => {
  let dir = start;
  while (!existsSync(path.join(dir, "package.json"))) {
    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new Error(`no package.json above ${start}`);
    }
    dir = parent;
  }
  return dir;
};
const ROOT = findRoot(import.meta.dir);
const manifest: unknown = JSON.parse(
  readFileSync(path.join(ROOT, "package.json"), "utf-8")
);
const pkg = isRecord(manifest) ? manifest : {};
const scripts = isRecord(pkg.scripts) ? pkg.scripts : {};
const prepare = typeof scripts.prepare === "string" ? scripts.prepare : "";

const scratch = mkdtempSync(path.join(tmpdir(), "pre-commit-test-"));
afterAll(() => {
  rmSync(scratch, { recursive: true, force: true });
});
let count = 0;
const tempDir = (name: string) => {
  count += 1;
  const dir = path.join(scratch, `${count}-${name}`);
  mkdirSync(dir, { recursive: true });
  return dir;
};

const GIT = Bun.which("git") ?? "";

// Runs `prepare` in `cwd` with a temp global git config (core.hooksPath set or not) and, unless
// `lefthook` is false, a stub lefthook on PATH that only records its arguments. The real global
// config and the system one are never read, and git looks for a repository no higher than scratch.
// PATH is the stub dir alone (git linked in, `command` and `echo` are shell builtins), so a system
// lefthook in /usr/bin can't stand in for a missing one.
const runPrepare = (
  cwd: string,
  options: { hooksPath?: string; lefthook?: boolean } = {}
) => {
  const env = tempDir("env");
  const bin = path.join(env, "bin");
  mkdirSync(bin);
  symlinkSync(GIT, path.join(bin, "git"));
  const calls = path.join(env, "lefthook-calls");
  if (options.lefthook !== false) {
    writeFileSync(
      path.join(bin, "lefthook"),
      `#!/bin/sh\necho "$*" >>'${calls}'\n`,
      {
        mode: 0o755,
      }
    );
  }
  const config = path.join(env, "gitconfig");
  writeFileSync(
    config,
    options.hooksPath === undefined
      ? ""
      : `[core]\n\thooksPath = ${options.hooksPath}\n`
  );
  const result = Bun.spawnSync(["/bin/sh", "-c", prepare], {
    cwd,
    env: {
      PATH: bin,
      HOME: env,
      GIT_CONFIG_GLOBAL: config,
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_CEILING_DIRECTORIES: scratch,
    },
    stdout: "pipe",
    stderr: "pipe",
  });
  return {
    code: result.exitCode,
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
    lefthook: existsSync(calls) ? readFileSync(calls, "utf-8") : "",
  };
};

const gitRepo = () => {
  const dir = tempDir("repo");
  const init = Bun.spawnSync([GIT, "init", "-q", dir], {
    env: { PATH: "/usr/bin:/bin", GIT_CONFIG_NOSYSTEM: "1", HOME: dir },
    stderr: "pipe",
  });
  expect(init.exitCode).toBe(0);
  return dir;
};

// lefthook.yml's pre-commit jobs, each with its globs.
const hook: unknown = Bun.YAML.parse(
  readFileSync(path.join(ROOT, "lefthook.yml"), "utf-8")
);
const preCommit = isRecord(hook) ? hook["pre-commit"] : undefined;
const jobs: unknown[] =
  isRecord(preCommit) && Array.isArray(preCommit.jobs) ? preCommit.jobs : [];
const jobOf = (name: string) =>
  jobs.find((entry) => isRecord(entry) && entry.name === name);
const globsOf = (name: string): string[] => {
  const job = jobOf(name);
  const glob = isRecord(job) ? job.glob : undefined;
  if (typeof glob === "string") {
    return [glob];
  }
  const globs: unknown[] = Array.isArray(glob) ? glob : [];
  return globs.filter((entry): entry is string => typeof entry === "string");
};

describe("the pre-commit hook's jobs", () => {
  test("format and lint take every extension the formatter handles, at the root and below", () => {
    const covered = FORMATTER_EXTENSIONS.flatMap((ext) => [
      `file.${ext}`,
      `a/b/file.${ext}`,
    ]);
    for (const name of ["format", "lint"]) {
      const globs = globsOf(name);
      expect(globs.length).toBeGreaterThan(0);
      const missed = covered.filter(
        (file) => !globs.some((glob) => new Bun.Glob(glob).match(file))
      );
      expect({ job: name, missed }).toEqual({ job: name, missed: [] });
    }
  });

  test("jobs run one after the other on staged files, format first and restaging its fixes", () => {
    expect(isRecord(preCommit) && preCommit.piped).toBe(true);
    const names = jobs.map((job) => (isRecord(job) ? job.name : undefined));
    expect(names.slice(0, 2)).toEqual(["format", "lint"]);
    const format = jobOf("format");
    expect(isRecord(format) && format.stage_fixed).toBe(true);
    for (const job of jobs) {
      const run = isRecord(job) && typeof job.run === "string" ? job.run : "";
      expect(run).toContain("{staged_files}");
      expect(run).not.toContain("--staged");
    }
  });
});

describe("the pre-commit hook's install", () => {
  test("lefthook is pinned exactly and bun never runs its own postinstall", () => {
    const dev = isRecord(pkg.devDependencies) ? pkg.devDependencies : {};
    expect(dev.lefthook).toMatch(/^\d+\.\d+\.\d+$/u);
    // Without the key, bun's default trusted list applies, and it trusts lefthook.
    expect(Array.isArray(pkg.trustedDependencies)).toBe(true);
    const trusted = Array.isArray(pkg.trustedDependencies)
      ? pkg.trustedDependencies
      : [];
    expect(trusted).not.toContain("lefthook");
  });

  test("prepare checks git, lefthook and core.hooksPath before it installs", () => {
    const install = prepare.indexOf("lefthook install");
    expect(install).toBeGreaterThan(-1);
    for (const guard of [
      "git rev-parse",
      "command -v lefthook",
      "core.hooksPath",
    ]) {
      const at = prepare.indexOf(guard);
      expect({ guard, before: at !== -1 && at < install }).toEqual({
        guard,
        before: true,
      });
    }
  });

  test("prepare installs the hook in a git checkout", () => {
    expect(GIT).not.toBe("");
    const run = runPrepare(gitRepo());
    expect(run.code).toBe(0);
    expect(run.stderr).toBe("");
    expect(run.lefthook).toBe("install --force\n");
  });

  test("prepare installs nothing when core.hooksPath is set, and says so", () => {
    const hooks = tempDir("shared-hooks");
    const run = runPrepare(gitRepo(), { hooksPath: hooks });
    expect(run.code).toBe(0);
    expect(run.stderr).toBe("");
    expect(run.lefthook).toBe("");
    expect(run.stdout).toContain("core.hooksPath is set");
    expect(readdirSync(hooks)).toEqual([]);
  });

  test("prepare is a silent no-op outside git and without lefthook", () => {
    const outside = runPrepare(tempDir("tarball"));
    expect(outside).toEqual({ code: 0, stdout: "", stderr: "", lefthook: "" });
    const production = runPrepare(gitRepo(), { lefthook: false });
    expect(production).toEqual({
      code: 0,
      stdout: "",
      stderr: "",
      lefthook: "",
    });
  });
});
