import { copyFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { serverEnv } from "~/env";
import * as schema from "./schema";

// Local SQLite file (libSQL `file:` URL) under DATA_DIR — in Docker that is
// the app-data volume, next to the generated media. libsql does not create
// parent directories, so ensure the folder exists before opening the file.
// (env.ts rejects the file://<authority> and ?query forms, so the bare slice
// and libsql agree on the path.)
const dbFilePath = serverEnv.databaseUrl.startsWith("file:")
  ? serverEnv.databaseUrl.slice("file:".length)
  : null;
if (dbFilePath) {
  mkdirSync(dirname(dbFilePath), { recursive: true });
}
// Captured BEFORE the client opens: the first PRAGMA below creates an empty
// file, which would make a fresh boot look like a pre-existing db.
const dbExistedBeforeOpen = dbFilePath !== null && existsSync(dbFilePath);

const client = createClient({
  url: serverEnv.databaseUrl,
});

export const db = drizzle(client, { schema });

// Migrations auto-apply at startup — idempotent (tracked in
// __drizzle_migrations), so a restart is a no-op and a new release brings its
// schema with it. Skipped during the build, like env validation. The folder
// is resolved from the CWD: the repo root in dev/start, /app in Docker
// (the Dockerfile copies drizzle/ into the runtime image).
if (!process.env.SKIP_ENV_VALIDATION) {
  // WAL + busy timeout: story generation holds long bursty writes; without
  // this a concurrent read/write surfaces as SQLITE_BUSY on a request.
  // (Backups must include app.db-wal, or checkpoint first — see README.)
  // ORDER MATTERS: busy_timeout FIRST (connection-local, no lock needed) —
  // the journal_mode switch takes a lock, and without a timeout already in
  // place a SECOND process booting while the first writes crashes ici en
  // SQLITE_BUSY (trouvé par le golden de concurrence de test:settings).
  await client.execute("PRAGMA busy_timeout=5000");
  await client.execute("PRAGMA journal_mode=WAL");

  // This file is the family's ONLY copy of the data and some migrations
  // rewrite rows (e.g. 0010). Before applying anything NEW, keep one rolling
  // snapshot next to the db — cheap insurance against a bad data migration.
  if (dbFilePath && dbExistedBeforeOpen) {
    let applied = 0;
    try {
      const rows = await client.execute(
        "SELECT count(*) AS c FROM __drizzle_migrations"
      );
      applied = Number(rows.rows[0]?.c ?? 0);
    } catch {
      // Fresh-but-existing file without the journal table (e.g. a Turso dump
      // load) — treat as "everything pending" and snapshot it.
    }
    const journal = JSON.parse(
      readFileSync(join("drizzle", "meta", "_journal.json"), "utf8")
    ) as { entries: unknown[] };
    if (journal.entries.length > applied) {
      copyFileSync(dbFilePath, `${dbFilePath}.pre-migrate`);
    }
  }

  try {
    await migrate(db, { migrationsFolder: "drizzle" });
  } catch (error) {
    // Fail loud but diagnosable: under compose `restart: unless-stopped` this
    // throw crash-loops the container — make the first log line say why.
    console.error(
      `Échec des migrations au démarrage (db: ${serverEnv.databaseUrl}, dossier: drizzle/). ` +
        "Le conteneur va redémarrer en boucle tant que la migration échoue. " +
        "Un instantané pré-migration existe à côté du fichier db (*.pre-migrate).",
      error
    );
    throw error;
  }
}
