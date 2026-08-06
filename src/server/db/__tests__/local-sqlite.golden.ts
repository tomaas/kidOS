/**
 * LOCAL-SQLITE assertion script — the db bootstrap after the Turso→file move.
 *
 * Pins:
 *  1. `serverEnv.databaseUrl` derivation: defaults to `file:<DATA_DIR>/app.db`
 *     (falling back to `file:./data/app.db` without DATA_DIR), DATABASE_URL
 *     still overrides, and `tursoAuthToken` is GONE from serverEnv;
 *  2. `validateServerEnv`: a non-`file:` DATABASE_URL (old `libsql://` or
 *     `https://` Turso URL) fails loudly with the migration message, a `file:`
 *     URL passes;
 *  3. the startup bootstrap in `db/index.ts`: importing the module on a FRESH
 *     data dir creates the parent folder (even nested, via DATABASE_URL),
 *     creates the db file and AUTO-APPLIES every drizzle migration (all
 *     domain tables present); a second import on the SAME file is a no-op
 *     (idempotent restart).
 *
 * Both `~/env` and `~/server/db` have import-time side effects (validation,
 * client open, migrate), so this script NEVER imports them itself: it
 * re-spawns `bun` on THIS file in child mode with a controlled environment —
 * each case gets a fresh process, a fresh module graph and (for the db cases)
 * a throwaway temp dir. Same standalone-runnable pattern as the other
 * goldens:
 *   bun run src/server/db/__tests__/local-sqlite.golden.ts
 * (wired as `bun run test:db`). It exits non-zero on any failure.
 */

import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// ── Child modes (run in a separate bun process with a controlled env) ────────

const [, , mode] = process.argv;

if (mode === "child:env") {
  // Import ~/env only; print what the migration diff is responsible for.
  const { serverEnv } = await import("~/env");
  console.log(
    JSON.stringify({
      databaseUrl: serverEnv.databaseUrl,
      hasTursoAuthToken: "tursoAuthToken" in serverEnv,
    })
  );
  process.exit(0);
}

if (mode === "child:db") {
  // Import ~/server/db: mkdir of the parent dir + createClient + migrate all
  // happen at import time (no SKIP_ENV_VALIDATION in this child). Then list
  // the tables the migrations created.
  const { db } = await import("~/server/db");
  const { sql } = await import("drizzle-orm");
  const rows = (await db.all(
    sql`select name from sqlite_master where type = 'table' and name not like 'sqlite_%' order by name`
  )) as { name: string }[];
  console.log(JSON.stringify({ tables: rows.map((r) => r.name) }));
  process.exit(0);
}

// ── Parent: spawn helpers ─────────────────────────────────────────────────────

// src/server/db/__tests__ → repo root (migrationsFolder "drizzle" is resolved
// from the CWD, exactly like the real server process).
const testsDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(testsDir, "..", "..", "..", "..");
const thisFile = join(testsDir, "local-sqlite.golden.ts");

function runChild(
  childMode: "child:env" | "child:db",
  env: Record<string, string>
) {
  const childEnv: NodeJS.ProcessEnv = { ...process.env };
  // The cases below must fully control these — never inherit them.
  for (const key of [
    "DATA_DIR",
    "DATABASE_URL",
    "TURSO_AUTH_TOKEN",
    "SKIP_ENV_VALIDATION",
    "ANTHROPIC_API_KEY",
    "IMAGE_ENABLED",
    "TTS_ENABLED",
  ]) {
    delete childEnv[key];
  }
  Object.assign(childEnv, env);
  const result = spawnSync("bun", [thisFile, childMode], {
    cwd: repoRoot,
    encoding: "utf8",
    env: childEnv,
  });
  return {
    json: (): {
      databaseUrl?: string;
      hasTursoAuthToken?: boolean;
      tables?: string[];
    } => {
      try {
        return JSON.parse(result.stdout.trim());
      } catch {
        return {};
      }
    },
    status: result.status,
    stderr: result.stderr,
    stdout: result.stdout,
  };
}

let failures = 0;
function check(name: string, ok: boolean, detail?: string) {
  if (ok) {
    console.log(`✓ ${name}`);
  } else {
    failures += 1;
    console.error(`✗ ${name}${detail ? `\n  ${detail}` : ""}`);
  }
}

// ── 1. databaseUrl derivation (env only, validation skipped) ─────────────────

const envSandbox = mkdtempSync(join(tmpdir(), "local-sqlite-golden-env-"));

{
  const r = runChild("child:env", {
    DATA_DIR: envSandbox,
    SKIP_ENV_VALIDATION: "1",
  });
  check(
    "databaseUrl defaults to file:<DATA_DIR>/app.db",
    r.status === 0 && r.json().databaseUrl === `file:${envSandbox}/app.db`,
    r.stdout + r.stderr
  );
}
{
  const r = runChild("child:env", { SKIP_ENV_VALIDATION: "1" });
  check(
    "without DATA_DIR the default is file:./data/app.db",
    r.status === 0 && r.json().databaseUrl === "file:./data/app.db",
    r.stdout + r.stderr
  );
}
{
  const r = runChild("child:env", {
    DATA_DIR: envSandbox,
    DATABASE_URL: "file:/somewhere/else/app.db",
    SKIP_ENV_VALIDATION: "1",
  });
  check(
    "DATABASE_URL still overrides the derived default",
    r.status === 0 && r.json().databaseUrl === "file:/somewhere/else/app.db",
    r.stdout + r.stderr
  );
  check(
    "tursoAuthToken is gone from serverEnv",
    r.json().hasTursoAuthToken === false,
    r.stdout
  );
}

// ── 2. validateServerEnv: file:-only ─────────────────────────────────────────

{
  // An old Turso deployment restarting on this release must fail LOUDLY with
  // the migration message — never open a network client.
  const r = runChild("child:env", {
    ANTHROPIC_API_KEY: "test-key",
    DATABASE_URL: "libsql://my-stories.turso.io",
    TURSO_AUTH_TOKEN: "stale-token",
  });
  check(
    "a libsql:// URL is rejected at startup (non-zero exit)",
    r.status !== 0,
    `status=${r.status}`
  );
  check(
    "…with the exact migration message",
    r.stderr.includes(
      "DATABASE_URL doit être une URL fichier locale (file:./data/app.db). Le mode Turso distant n'est plus supporté."
    ),
    r.stderr
  );
}
{
  const r = runChild("child:env", {
    ANTHROPIC_API_KEY: "test-key",
    DATABASE_URL: "https://my-stories.turso.io",
  });
  check(
    "the https:// Turso form is rejected too",
    r.status !== 0 && r.stderr.includes("DATABASE_URL doit être une URL"),
    r.stderr
  );
}
{
  const r = runChild("child:env", {
    ANTHROPIC_API_KEY: "test-key",
    DATABASE_URL: `file:${envSandbox}/validated.db`,
  });
  check("a file: URL passes full validation", r.status === 0, r.stderr);
}
{
  // Boot validation is INFRA-ONLY (env→DB settings move) : les clés provider
  // peuvent vivre uniquement dans app_settings — un boot sans AUCUNE clé,
  // même avec IMAGE_ENABLED=true sans GEMINI_API_KEY (ancien cas fatal) et
  // TTS elevenlabs sans clé, doit passer. La vérification se fait au point
  // d'usage (config-status côté /parents, soft-failure côté enfant).
  const r = runChild("child:env", {
    DATABASE_URL: `file:${envSandbox}/no-keys.db`,
    IMAGE_ENABLED: "true",
    TTS_ENABLED: "true",
    TTS_PROVIDER: "elevenlabs",
  });
  check(
    "boot passes with NO provider key at all (validation is infra-only)",
    r.status === 0,
    r.stderr
  );
}
{
  // `file://data/app.db` makes "data" a URL AUTHORITY — libsql and the
  // bootstrap mkdir would disagree on the real path. Must be rejected.
  const r = runChild("child:env", {
    ANTHROPIC_API_KEY: "test-key",
    DATABASE_URL: "file://data/app.db",
  });
  check(
    "file://<authority> form is rejected (file:/// stays allowed)",
    r.status !== 0 && r.stderr.includes("file://<hôte>"),
    r.stderr
  );
}
{
  const r = runChild("child:env", {
    ANTHROPIC_API_KEY: "test-key",
    DATABASE_URL: `file:///${envSandbox.replace(/^\/+/, "")}/absolute.db`,
  });
  check("file:/// absolute form passes validation", r.status === 0, r.stderr);
}
{
  const r = runChild("child:env", {
    ANTHROPIC_API_KEY: "test-key",
    DATABASE_URL: `file:${envSandbox}/app.db?mode=ro`,
  });
  check(
    "a query string on the file URL is rejected",
    r.status !== 0 && r.stderr.includes("query string"),
    r.stderr
  );
}

// ── 3. db bootstrap: fresh dir → migrations applied; restart → no-op ─────────

// Every domain table the migrations must create (schema.ts), plus drizzle's
// own journal table proving `migrate()` ran (not just createClient).
const EXPECTED_TABLES = [
  "__drizzle_migrations",
  "app_settings",
  "doudous",
  "elements",
  "heroes",
  "math_skills",
  "places",
  "stories",
  "story_segments",
  "sudoku_skills",
];

const dbSandbox = mkdtempSync(join(tmpdir(), "local-sqlite-golden-db-"));
const freshDataDir = join(dbSandbox, "fresh-volume");

{
  const r = runChild("child:db", {
    ANTHROPIC_API_KEY: "test-key",
    DATA_DIR: freshDataDir,
  });
  const tables = r.json().tables ?? [];
  check(
    "fresh DATA_DIR: import creates the folder + app.db",
    r.status === 0 && existsSync(join(freshDataDir, "app.db")),
    r.stderr
  );
  check(
    "fresh DATA_DIR: every migration table exists after startup",
    EXPECTED_TABLES.every((t) => tables.includes(t)),
    `tables=${JSON.stringify(tables)}`
  );
  // A brand-new install has nothing to protect — the client creates the empty
  // file before migrate runs, and that must NOT be mistaken for existing data.
  check(
    "fresh DATA_DIR: no pre-migrate snapshot of a brand-new db",
    !existsSync(join(freshDataDir, "app.db.pre-migrate")),
    "app.db.pre-migrate was created on a FRESH boot"
  );
}
{
  // Restart on the SAME file: migrate() is idempotent (__drizzle_migrations).
  const r = runChild("child:db", {
    ANTHROPIC_API_KEY: "test-key",
    DATA_DIR: freshDataDir,
  });
  const tables = r.json().tables ?? [];
  check(
    "restart on an existing db is a no-op (same tables, exit 0)",
    r.status === 0 && EXPECTED_TABLES.every((t) => tables.includes(t)),
    r.stderr
  );
  // The pre-migrate snapshot only fires when migrations are PENDING — a
  // routine restart must never churn the backup file.
  check(
    "no pre-migrate snapshot on a routine restart (nothing pending)",
    !existsSync(join(freshDataDir, "app.db.pre-migrate")),
    "app.db.pre-migrate was created although no migration was pending"
  );
}
{
  // DATABASE_URL override with a NESTED not-yet-existing parent dir — the
  // mkdirSync(recursive) path in db/index.ts.
  const nestedDb = join(dbSandbox, "nested", "deep", "app.db");
  const r = runChild("child:db", {
    ANTHROPIC_API_KEY: "test-key",
    DATABASE_URL: `file:${nestedDb}`,
  });
  check(
    "DATABASE_URL with a nested missing parent dir: created recursively, migrations applied",
    r.status === 0 && existsSync(nestedDb),
    r.stderr
  );
}

// ── 4. Deploy prose-contract: the runtime image must ship drizzle/ ───────────

// migrationsFolder "drizzle" is resolved from the CWD, so the Docker runtime
// stage MUST copy the folder next to the server bundle — a Dockerfile refactor
// that drops the COPY would pass every other check and only crash-loop the
// container at startup.
{
  const dockerfile = readFileSync(join(repoRoot, "Dockerfile"), "utf8");
  check(
    "Dockerfile ships drizzle/ into the runtime image (COPY --from=build /app/drizzle ./drizzle)",
    dockerfile.includes("COPY --from=build /app/drizzle ./drizzle"),
    "the runtime stage no longer copies drizzle/ — startup migrate() would find no migrations"
  );

  const journal = JSON.parse(
    readFileSync(join(repoRoot, "drizzle", "meta", "_journal.json"), "utf8")
  ) as { entries: unknown[] };
  const sqlFiles = readdirSync(join(repoRoot, "drizzle")).filter((f) =>
    f.endsWith(".sql")
  );
  check(
    "drizzle journal entry count matches the .sql migration files",
    journal.entries.length === sqlFiles.length,
    `journal=${journal.entries.length} sqlFiles=${sqlFiles.length}`
  );
}

rmSync(envSandbox, { force: true, recursive: true });
rmSync(dbSandbox, { force: true, recursive: true });

if (failures > 0) {
  console.error(`\nLOCAL-SQLITE FAILED: ${failures} mismatch(es).`);
  process.exit(1);
}
console.log(
  "\nLOCAL-SQLITE OK: file-URL derivation + validation pinned; startup auto-migration proven on fresh AND existing db."
);
