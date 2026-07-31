/**
 * APP-CONFIG assertion script — le point de passage unique des réglages
 * (env → DB), `src/server/app-config.ts`.
 *
 * Pins :
 *  1. matrice de PRÉCÉDENCE (ligne DB > env > défaut du code) sur la
 *     fusion pure `configFromRows` ;
 *  2. les QUATRE opérations secret : conserver (pas de ligne) / définir /
 *     masque explicite (ligne "") / réinitialiser (suppression) ;
 *  3. parsing « invalid means FALLBACK » des booléens/enums DB (absent,
 *     true, false, vide, corrompu — épinglés séparément) ;
 *  4. masquage `hintFor` (jamais plus de 3 caractères de fin) ;
 *  5. boundary secret-scan : la forme statut sérialisée ne contient JAMAIS
 *     un secret planté ;
 *  6. liste canonique des clés GELÉE ;
 *  7. graphe d'imports : importer app-config.ts (et dynamic.ts) dans un
 *     répertoire vierge ne crée AUCUN fichier db (subprocess) + assertion
 *     statique « pas d'import top-level de ~/server/db » ;
 *  8. intégration DB réelle (subprocess, tmp dir) : round-trip des quatre
 *     opérations, patch transactionnel au niveau champ (updates disjoints
 *     qui ne s'écrasent pas, patch invalide → rien d'écrit), never-throw
 *     quand la base est inouvrable (config env seule, exit 0).
 *
 * Même patron standalone que local-sqlite.golden.ts (spawn d'enfants bun
 * pour tout ce qui touche l'env process ou la vraie base) :
 *   bun run src/server/__tests__/app-config.golden.ts
 * (câblé en `bun run test:settings`). Sort non-zéro à la moindre déviation.
 */

import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Secrets PLANTÉS pour le scan de frontière — improbables dans tout autre
// contenu sérialisé.
const PLANTED = {
  anthropic: "sk-ant-PLANTED-anthropic-secret-00007Yq",
  elevenlabs: "el-PLANTED-elevenlabs-secret-0000Zt",
  gemini: "AIza-PLANTED-gemini-secret-0000Xw",
};

// ── Child modes ───────────────────────────────────────────────────────────────

const [, , mode] = process.argv;

if (mode === "child:import-only") {
  // Importer le module NE DOIT ni ouvrir ni créer la base (import lazy).
  await import("~/server/app-config");
  const dataDir = process.env.DATA_DIR ?? "";
  console.log(JSON.stringify({ dbFile: existsSync(join(dataDir, "app.db")) }));
  process.exit(0);
}

if (mode === "child:import-dynamic") {
  // Le provider texte (importé par les goldens de cohérence) doit rester
  // db-free à l'import, sinon test:coherence bootstrapperait la base.
  await import("~/server/providers/text/dynamic");
  const dataDir = process.env.DATA_DIR ?? "";
  console.log(JSON.stringify({ dbFile: existsSync(join(dataDir, "app.db")) }));
  process.exit(0);
}

if (mode === "child:roundtrip") {
  // Base réelle dans un tmp dir : les quatre opérations secret + le patch
  // transactionnel, contre l'env contrôlé posé par le parent.
  const {
    applySettingsPatch,
    deleteSetting,
    getAppConfig,
    getSettingRows,
    setSetting,
  } = await import("~/server/app-config");

  const read = async () => (await getAppConfig()).provider;

  const blank = await read();
  const afterSet = await (async () => {
    await setSetting("text:anthropic-api-key", PLANTED.anthropic);
    return await read();
  })();
  const afterEmptyOverride = await (async () => {
    await setSetting("text:anthropic-api-key", "");
    return await read();
  })();
  const afterReset = await (async () => {
    await deleteSetting("text:anthropic-api-key");
    return await read();
  })();

  // Patchs DISJOINTS successifs (deux onglets, deux sections) : au niveau
  // champ, le second ne réécrit jamais les clés du premier.
  await applySettingsPatch([
    { key: "text:story-model", op: "set", value: "claude-test-model" },
  ]);
  await applySettingsPatch([
    { key: "image:model", op: "set", value: "gemini-test-model" },
  ]);
  const afterDisjoint = await read();

  // Patch INVALIDE (clé inconnue) : rejeté par la PRÉ-VALIDATION (avant
  // toute construction de batch) — l'opération valide du même patch n'est
  // pas appliquée.
  let invalidPatchThrew = false;
  try {
    await applySettingsPatch([
      { key: "text:story-model", op: "set", value: "must-not-land" },
      { key: "not-a-setting", op: "set", value: "x" },
    ]);
  } catch {
    invalidPatchThrew = true;
  }
  const afterInvalidPatch = await read();

  // ROLLBACK RÉEL dans db.batch (codex diff-review #3) : un échec SQL sur
  // un statement ULTÉRIEUR (violation NOT NULL sur `value`, injectée en
  // contournant le type — la clé, elle, est valide) doit annuler le
  // statement PRÉCÉDENT du même batch. C'est l'atomicité de libsql batch
  // elle-même qui est prouvée ici, pas la pré-validation.
  let sqlFailureThrew = false;
  try {
    await applySettingsPatch([
      { key: "image:resolution", op: "set", value: "2K" },
      {
        key: "tts:provider",
        op: "set",
        value: null as unknown as string,
      },
    ]);
  } catch {
    sqlFailureThrew = true;
  }
  const rowsAfterSqlFailure = await getSettingRows();

  // ui-language passe par le même écrivain central.
  await setSetting("ui-language", "en");
  const rows = await getSettingRows();

  console.log(
    JSON.stringify({
      afterDisjoint: {
        imageModel: afterDisjoint.imageModel,
        storyModel: afterDisjoint.storyModel,
      },
      afterEmptyOverrideKey: afterEmptyOverride.anthropicApiKey,
      afterInvalidPatchStoryModel: afterInvalidPatch.storyModel,
      afterResetKey: afterReset.anthropicApiKey,
      afterSetKey: afterSet.anthropicApiKey,
      blankKey: blank.anthropicApiKey,
      invalidPatchThrew,
      sqlFailure: {
        resolutionRowAfter: rowsAfterSqlFailure.get("image:resolution") ?? null,
        threw: sqlFailureThrew,
        ttsProviderRowAfter: rowsAfterSqlFailure.get("tts:provider") ?? null,
      },
      uiLanguageRow: rows.get("ui-language") ?? null,
    })
  );
  process.exit(0);
}

if (mode === "child:plant-secrets") {
  // Pose les secrets DB pour le test de frontière HTTP (même DATA_DIR que
  // le serveur dev éphémère — WAL rend l'écriture inter-processus sûre).
  const { setSetting } = await import("~/server/app-config");
  await setSetting("image:gemini-api-key", PLANTED.gemini);
  await setSetting("tts:elevenlabs-api-key", PLANTED.elevenlabs);
  console.log(JSON.stringify({ planted: true }));
  process.exit(0);
}

if (mode === "child:writer") {
  // Écrivain CONCURRENT (codex diff-review #2) : son propre processus, donc
  // son propre client libsql sur le MÊME fichier — verrous SQLite réels.
  const [, , , keysCsv, prefix, iterationsRaw] = process.argv;
  const { applySettingsPatch } = await import("~/server/app-config");
  const keys = (keysCsv ?? "").split(",");
  const iterations = Number(iterationsRaw ?? "0");
  for (let i = 1; i <= iterations; i += 1) {
    // biome-ignore lint/performance/noAwaitInLoops: écritures SÉQUENTIELLES par processus, la concurrence vient des DEUX processus.
    await applySettingsPatch(
      keys.map((key) => ({ key, op: "set" as const, value: `${prefix}-${i}` }))
    );
  }
  console.log(JSON.stringify({ done: true }));
  process.exit(0);
}

if (mode === "child:read-rows") {
  // Lecture simple des lignes (boot la base au passage — migrations).
  const { getSettingRows } = await import("~/server/app-config");
  const rows = await getSettingRows();
  console.log(JSON.stringify({ rows: Object.fromEntries(rows) }));
  process.exit(0);
}

if (mode === "child:db-fails") {
  // Base inouvrable (parent dir impossible) : getAppConfig ne jette JAMAIS —
  // config env seule + log serveur, exit 0.
  const { getAppConfig } = await import("~/server/app-config");
  const config = await getAppConfig();
  console.log(
    JSON.stringify({ anthropicKey: config.provider.anthropicApiKey })
  );
  process.exit(0);
}

// ── Parent ────────────────────────────────────────────────────────────────────

const testsDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(testsDir, "..", "..", "..");
const thisFile = join(testsDir, "app-config.golden.ts");

function runChild(childMode: string, env: Record<string, string>) {
  const childEnv: NodeJS.ProcessEnv = { ...process.env };
  for (const key of [
    "DATA_DIR",
    "DATABASE_URL",
    "SKIP_ENV_VALIDATION",
    "ANTHROPIC_API_KEY",
    "GEMINI_API_KEY",
    "ELEVENLABS_API_KEY",
    "STORY_MODEL",
    "IMAGE_ENABLED",
    "IMAGE_MODEL",
    "IMAGE_RESOLUTION",
    "TTS_ENABLED",
    "TTS_PROVIDER",
    "DEFAULT_LANG",
    "VITE_CHILD_NAME",
    "VITE_APP_NAME",
    "VITE_APP_DESCRIPTION",
    "VITE_STORY_LABEL",
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
    json: (): Record<string, unknown> => {
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

// Le parent n'importe que la partie PURE du module (aucun effet db —
// prouvé par les cas subprocess ci-dessous).
const { configFromRows, hintFor, SETTING_KEYS, settingsStatusFromRows } =
  await import("~/server/app-config");
type AppConfigT = import("~/server/app-config").AppConfig;

// ── 1. Liste canonique gelée ─────────────────────────────────────────────────

check(
  "canonical key list is frozen",
  JSON.stringify(SETTING_KEYS) ===
    JSON.stringify([
      "text:anthropic-api-key",
      "text:story-model",
      "image:enabled",
      "image:gemini-api-key",
      "image:model",
      "image:resolution",
      "tts:enabled",
      "tts:provider",
      "tts:elevenlabs-api-key",
      "story:default-lang",
      "branding:child-name",
      "branding:app-name",
      "branding:app-description",
      "branding:story-label",
    ]),
  JSON.stringify(SETTING_KEYS)
);

// ── 2. Précédence pure (db > env > défaut) — fallback STUB injecté ───────────

const stubFallback: AppConfigT = Object.freeze({
  branding: Object.freeze({
    appDescription: "env-description",
    appName: "env-name",
    childName: "env-child",
    storyLabel: "env-label",
  }),
  provider: Object.freeze({
    anthropicApiKey: "env-anthropic-key-123456",
    defaultLang: "fr" as const,
    elevenLabsApiKey: "",
    geminiApiKey: "env-gemini-key-123456",
    imageEnabled: false,
    imageModel: "env-image-model",
    imageResolution: "1K" as const,
    storyModel: "env-story-model",
    ttsEnabled: true,
    ttsProvider: "edge" as const,
  }),
});

{
  const merged = configFromRows(new Map(), stubFallback);
  check(
    "no rows → env fallback verbatim (all fields)",
    JSON.stringify(merged) === JSON.stringify(stubFallback),
    JSON.stringify(merged)
  );
}
{
  const merged = configFromRows(
    new Map([
      ["text:story-model", "db-story-model"],
      ["branding:child-name", "Léa"],
    ]),
    stubFallback
  );
  check(
    "db row wins over env (text + branding)",
    merged.provider.storyModel === "db-story-model" &&
      merged.branding.childName === "Léa" &&
      merged.provider.imageModel === "env-image-model",
    JSON.stringify(merged)
  );
}

// ── 3. Booléens/enums DB : invalid means FALLBACK ────────────────────────────

const boolCase = (raw: string | undefined) => {
  const rows = new Map<string, string>();
  if (raw !== undefined) {
    rows.set("image:enabled", raw);
  }
  return configFromRows(rows, stubFallback).provider.imageEnabled;
};
check("bool: missing row → fallback (false)", boolCase(undefined) === false);
check('bool: "true" → true', boolCase("true") === true);
check('bool: "false" → false', boolCase("false") === false);
check('bool: "" (vide) → fallback, jamais false forcé', boolCase("") === false);
{
  const withTrueFallback = configFromRows(
    new Map([["tts:enabled", "banana"]]),
    stubFallback
  ).provider.ttsEnabled;
  check(
    "bool: garbage row → FALLBACK (true kept), not disabled",
    withTrueFallback === true
  );
}
{
  const resolution = (raw?: string) => {
    const rows = new Map<string, string>();
    if (raw !== undefined) {
      rows.set("image:resolution", raw);
    }
    return configFromRows(rows, stubFallback).provider.imageResolution;
  };
  check("enum: missing → fallback (1K)", resolution(undefined) === "1K");
  check('enum: "2K" valid → applied', resolution("2K") === "2K");
  check('enum: garbage ("8K") → fallback', resolution("8K") === "1K");
  const lang = configFromRows(
    new Map([["story:default-lang", "de"]]),
    stubFallback
  ).provider.defaultLang;
  check("enum: invalid lang → fallback fr", lang === "fr");
  const provider = configFromRows(
    new Map([["tts:provider", "elevenlabs"]]),
    stubFallback
  ).provider.ttsProvider;
  check("enum: valid tts provider applied", provider === "elevenlabs");
}

// ── 4. Sémantique SECRET en lecture (les quatre états) ───────────────────────

{
  const noRow = configFromRows(new Map(), stubFallback);
  check(
    "secret: no row → env key (keep/reset state)",
    noRow.provider.anthropicApiKey === "env-anthropic-key-123456"
  );
  const set = configFromRows(
    new Map([["text:anthropic-api-key", PLANTED.anthropic]]),
    stubFallback
  );
  check(
    "secret: row set → db value wins",
    set.provider.anthropicApiKey === PLANTED.anthropic
  );
  const masked = configFromRows(
    new Map([["text:anthropic-api-key", ""]]),
    stubFallback
  );
  check(
    'secret: row "" → MASQUE explicite (env neutralisée, feature unconfigured)',
    masked.provider.anthropicApiKey === ""
  );
}

// ── 5. hintFor ───────────────────────────────────────────────────────────────

check('hintFor: empty → ""', hintFor("") === "");
check(
  'hintFor: short (<8) → "" (jamais révélateur)',
  hintFor("abcdefg") === ""
);
check(
  "hintFor: long → …3 derniers caractères",
  hintFor("sk-ant-abcdefgh7Yq") === "…7Yq"
);

// ── 6. Boundary secret-scan sur la forme statut ──────────────────────────────

{
  const rows = new Map([
    ["text:anthropic-api-key", PLANTED.anthropic],
    ["image:gemini-api-key", PLANTED.gemini],
    ["tts:elevenlabs-api-key", PLANTED.elevenlabs],
    ["image:enabled", "true"],
    ["tts:enabled", "true"],
    ["tts:provider", "elevenlabs"],
  ]);
  const status = settingsStatusFromRows(rows, stubFallback);
  const serialized = JSON.stringify(status);
  const leaked = Object.values(PLANTED).filter((secret) =>
    serialized.includes(secret)
  );
  check(
    "status shape never carries a planted secret (recursive serialize scan)",
    leaked.length === 0,
    `leaked=${JSON.stringify(leaked)}`
  );
  // Le fallback env est un secret aussi — il ne doit pas fuiter non plus.
  check(
    "status shape never carries the env fallback secret either",
    !(
      serialized.includes("env-anthropic-key-123456") ||
      serialized.includes("env-gemini-key-123456")
    ),
    serialized
  );
  check(
    "status: configured + hint + source db",
    status.provider.anthropicApiKey.configured &&
      status.provider.anthropicApiKey.hint === "…7Yq" &&
      status.provider.anthropicApiKey.source === "db"
  );
  check(
    "status: features all ready when keys present",
    status.features.text === "ready" &&
      status.features.image === "ready" &&
      status.features.tts === "ready",
    JSON.stringify(status.features)
  );
}
{
  const masked = settingsStatusFromRows(
    new Map([
      ["text:anthropic-api-key", ""],
      ["image:enabled", "true"],
    ]),
    stubFallback
  );
  check(
    "status: masque explicite → unconfigured (missing-key), source db",
    masked.features.text === "missing-key" &&
      masked.provider.anthropicApiKey.configured === false &&
      masked.provider.anthropicApiKey.source === "db"
  );
  check(
    "status: image enabled sans clé db → missing-key… sauf clé env",
    masked.features.image === "ready",
    "env gemini fallback still configures the feature"
  );
  const off = settingsStatusFromRows(new Map(), stubFallback);
  check(
    "status: feature désactivée → off (jamais missing-key)",
    off.features.image === "off"
  );
  check(
    "status: source default quand aucune ligne",
    off.provider.storyModel.source === "default" &&
      off.provider.storyModel.value === "env-story-model"
  );
  const dirty = settingsStatusFromRows(
    new Map([["image:resolution", "8K"]]),
    stubFallback
  );
  check(
    "status: ligne invalide déclarée source default (le badge dit vrai)",
    dirty.provider.imageResolution.source === "default" &&
      dirty.provider.imageResolution.value === "1K"
  );
}

// ── 7. Graphe d'imports ──────────────────────────────────────────────────────

{
  const source = readFileSync(
    join(repoRoot, "src", "server", "app-config.ts"),
    "utf8"
  );
  const topLevelDbImport = /^import[^;]*from\s+["']~\/server\/db["']/m.test(
    source
  );
  check(
    "static: app-config.ts has no top-level ~/server/db import",
    !topLevelDbImport
  );
}

const importSandbox = mkdtempSync(join(tmpdir(), "app-config-golden-import-"));
{
  const r = runChild("child:import-only", { DATA_DIR: importSandbox });
  check(
    "subprocess: importing app-config.ts creates NO db file",
    r.status === 0 && r.json().dbFile === false,
    r.stdout + r.stderr
  );
}
{
  const r = runChild("child:import-dynamic", { DATA_DIR: importSandbox });
  check(
    "subprocess: importing text/dynamic.ts creates NO db file",
    r.status === 0 && r.json().dbFile === false,
    r.stdout + r.stderr
  );
}

// ── 8. Intégration DB réelle (tmp dir) ───────────────────────────────────────

const dbSandbox = mkdtempSync(join(tmpdir(), "app-config-golden-db-"));
{
  const r = runChild("child:roundtrip", {
    ANTHROPIC_API_KEY: "env-anthropic-key-123456",
    DATA_DIR: join(dbSandbox, "volume"),
  });
  const j = r.json();
  check("roundtrip child exits 0", r.status === 0, r.stderr);
  check(
    "roundtrip: blank db → env key",
    j.blankKey === "env-anthropic-key-123456",
    JSON.stringify(j)
  );
  check("roundtrip: set → db key wins", j.afterSetKey === PLANTED.anthropic);
  check(
    'roundtrip: masque explicite ("" row) → clé effective vide',
    j.afterEmptyOverrideKey === ""
  );
  check(
    "roundtrip: reset (delete row) → env key resumes",
    j.afterResetKey === "env-anthropic-key-123456"
  );
  check(
    "roundtrip: disjoint field-level patches both survive",
    JSON.stringify(j.afterDisjoint) ===
      JSON.stringify({
        imageModel: "gemini-test-model",
        storyModel: "claude-test-model",
      }),
    JSON.stringify(j.afterDisjoint)
  );
  check(
    "roundtrip: unknown-key patch is rejected by PRE-validation, writes NOTHING",
    j.invalidPatchThrew === true &&
      j.afterInvalidPatchStoryModel === "claude-test-model",
    JSON.stringify(j)
  );
  {
    const sqlFailure = j.sqlFailure as {
      resolutionRowAfter: string | null;
      threw: boolean;
      ttsProviderRowAfter: string | null;
    };
    check(
      "roundtrip: a REAL SQL failure on a LATER batch statement rolls back the earlier one (libsql batch atomicity)",
      sqlFailure.threw === true &&
        sqlFailure.resolutionRowAfter === null &&
        sqlFailure.ttsProviderRowAfter === null,
      JSON.stringify(sqlFailure)
    );
  }
  check(
    "roundtrip: ui-language writes through the central writer",
    j.uiLanguageRow === "en"
  );
}
// ── 9. Frontière server-fn RÉELLE (HTTP, runtime dev) ───────────────────────
// codex diff-review #1 : les createServerFn compilés ne s'exécutent que dans
// le runtime Start — on démarre donc un serveur dev ÉPHÉMÈRE et on scanne les
// OCTETS RÉELLEMENT SÉRIALISÉS sur le fil : la réponse RPC de
// getAppSettingsStatusFn, celle de saveAppSettingsFn, et la page SSR de
// /parents/reglages (loaders dehydratés). Secrets plantés côté DB ET env.

async function bodyOf(response: Response): Promise<string> {
  return await response.text();
}

{
  const httpSandbox = mkdtempSync(join(tmpdir(), "app-config-golden-http-"));
  // Port dédié hors des ports d'agents (3009 dev, 3011/3012 QA) ; on prend
  // le premier libre de la plage.
  let port = 3960;
  const portTaken = async (p: number) => {
    try {
      await fetch(`http://localhost:${p}/`, {
        signal: AbortSignal.timeout(700),
      });
      return true;
    } catch {
      return false;
    }
  };
  // biome-ignore lint/performance/noAwaitInLoops: sondage séquentiel de ports par nature.
  while ((await portTaken(port)) && port < 3980) {
    port += 1;
  }

  const serverEnv: NodeJS.ProcessEnv = { ...process.env };
  serverEnv.DATABASE_URL = undefined;
  Object.assign(serverEnv, {
    ANTHROPIC_API_KEY: PLANTED.anthropic,
    DATA_DIR: httpSandbox,
  });
  const server = spawn("bun", ["run", "dev", "--port", String(port)], {
    cwd: repoRoot,
    env: serverEnv,
    stdio: "ignore",
  });
  const base = `http://localhost:${port}`;
  let up = false;
  for (let i = 0; i < 60 && !up; i += 1) {
    try {
      // biome-ignore lint/performance/noAwaitInLoops: attente de démarrage.
      const r = await fetch(`${base}/`, { signal: AbortSignal.timeout(2000) });
      up = r.ok;
    } catch {
      // pas encore prêt
    }
    if (!up) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
  check("http boundary: ephemeral dev server boots", up, `port=${port}`);

  if (up) {
    // Secrets DB plantés par un processus frère sur le même DATA_DIR.
    const planted = runChild("child:plant-secrets", { DATA_DIR: httpSandbox });
    check(
      "http boundary: db secrets planted",
      planted.status === 0,
      planted.stderr
    );

    // Les functionIds RÉELS, extraits du module client transformé par vite —
    // jamais des ids devinés (ils encodent {file, export} en base64).
    const moduleSource = await bodyOf(
      await fetch(`${base}/src/server/settings-functions.ts`)
    );
    const ids = new Map<string, string>();
    for (const match of moduleSource.matchAll(
      /createClientRpc\("([^"]+)"\)/g
    )) {
      const [, id] = match;
      try {
        const meta = JSON.parse(atob(id)) as { export?: string };
        if (meta.export) {
          ids.set(meta.export, id);
        }
      } catch {
        // id illisible — ignoré, le check ci-dessous échouera si absent.
      }
    }
    const statusId = ids.get("getAppSettingsStatusFn_createServerFn_handler");
    const saveId = ids.get("saveAppSettingsFn_createServerFn_handler");
    check(
      "http boundary: both server-fn RPC ids resolved from the transformed module",
      Boolean(statusId && saveId),
      JSON.stringify([...ids.keys()])
    );

    const rpcHeaders = {
      accept:
        "application/x-tss-framed, application/x-ndjson, application/json",
      "sec-fetch-site": "same-origin",
      "x-tsr-serverFn": "true",
    };

    // 9a. La réponse RPC de getAppSettingsStatusFn (GET).
    const statusWire = statusId
      ? await bodyOf(
          await fetch(`${base}/_serverFn/${statusId}`, {
            headers: rpcHeaders,
          })
        )
      : "";

    // 9b. La réponse RPC de saveAppSettingsFn (POST, corps seroval — le même
    // encodage que serverFnFetcher côté client).
    const { toJSONAsync } = await import("seroval");
    const saveBody = JSON.stringify(
      await toJSONAsync({
        data: {
          operations: [
            {
              key: "text:anthropic-api-key",
              op: "set",
              value: PLANTED.anthropic,
            },
          ],
        },
      })
    );
    const saveWire = saveId
      ? await bodyOf(
          await fetch(`${base}/_serverFn/${saveId}`, {
            body: saveBody,
            headers: { ...rpcHeaders, "content-type": "application/json" },
            method: "POST",
          })
        )
      : "";

    // 9c. La page SSR /parents/reglages (loaders dehydratés dans le HTML).
    const pageWire = await bodyOf(await fetch(`${base}/parents/reglages`));

    const leaked: string[] = [];
    for (const [name, secret] of Object.entries(PLANTED)) {
      for (const [wireName, wire] of [
        ["status-rpc", statusWire],
        ["save-rpc", saveWire],
        ["ssr-page", pageWire],
      ] as const) {
        if (wire.includes(secret)) {
          leaked.push(`${name} in ${wireName}`);
        }
      }
    }
    check(
      "http boundary: NO planted secret (db gemini/elevenlabs, env+saved anthropic) in any wire response",
      statusWire.length > 0 &&
        saveWire.length > 0 &&
        pageWire.length > 0 &&
        leaked.length === 0,
      `leaked=${JSON.stringify(leaked)}`
    );
    check(
      "http boundary: the status RPC still proves configuration (masked hint of the db gemini key)",
      statusWire.includes("…0Xw"),
      statusWire.slice(0, 400)
    );
    check(
      "http boundary: the save RPC answers success + fresh masked status (hint of the just-saved key)",
      saveWire.includes("success") && saveWire.includes("…7Yq"),
      saveWire.slice(0, 400)
    );
  }

  server.kill();
  await new Promise((resolve) => setTimeout(resolve, 300));
  rmSync(httpSandbox, { force: true, recursive: true });
}

// ── 10. Concurrence RÉELLE : deux processus, deux clients, clés disjointes ──

{
  const concurrentSandbox = mkdtempSync(
    join(tmpdir(), "app-config-golden-concurrent-")
  );
  const env = { DATA_DIR: concurrentSandbox };
  // Boot séquentiel d'abord (migrations), pour que les deux écrivains ne se
  // disputent pas la première création du schéma.
  runChild("child:read-rows", env);
  const spawnWriter = (keysCsv: string, prefix: string) =>
    new Promise<number>((resolve) => {
      const childEnv: NodeJS.ProcessEnv = { ...process.env };
      childEnv.DATABASE_URL = undefined;
      Object.assign(childEnv, env);
      const child = spawn(
        "bun",
        [thisFile, "child:writer", keysCsv, prefix, "25"],
        { cwd: repoRoot, env: childEnv, stdio: "ignore" }
      );
      child.on("exit", (code) => resolve(code ?? 1));
    });
  const [codeA, codeB] = await Promise.all([
    spawnWriter("text:story-model,image:model", "a"),
    spawnWriter("branding:app-name,branding:story-label", "b"),
  ]);
  const finalRows = (
    runChild("child:read-rows", env).json() as {
      rows?: Record<string, string>;
    }
  ).rows;
  check(
    "concurrent: both writer processes finish cleanly (WAL + busy_timeout absorb the contention)",
    codeA === 0 && codeB === 0,
    `codes=${codeA},${codeB}`
  );
  check(
    "concurrent: disjoint keys from two clients never clobber each other (last write of EACH writer survives)",
    finalRows?.["text:story-model"] === "a-25" &&
      finalRows?.["image:model"] === "a-25" &&
      finalRows?.["branding:app-name"] === "b-25" &&
      finalRows?.["branding:story-label"] === "b-25",
    JSON.stringify(finalRows)
  );
  rmSync(concurrentSandbox, { force: true, recursive: true });
}

{
  const r = runChild("child:db-fails", {
    ANTHROPIC_API_KEY: "env-anthropic-key-123456",
    DATABASE_URL: "file:/dev/null/nope/app.db",
  });
  check(
    "db unreachable: getAppConfig never throws → env-only config, exit 0",
    r.status === 0 && r.json().anthropicKey === "env-anthropic-key-123456",
    r.stdout + r.stderr
  );
}

rmSync(importSandbox, { force: true, recursive: true });
rmSync(dbSandbox, { force: true, recursive: true });

if (failures > 0) {
  console.error(`\nAPP-CONFIG FAILED: ${failures} mismatch(es).`);
  process.exit(1);
}
console.log(
  "\nAPP-CONFIG OK: précédence db>env>défaut, quatre opérations secret, parsing invalid-means-fallback, masquage, scan de frontière, graphe d'imports db-free et patch transactionnel épinglés."
);
