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

import { spawnSync } from "node:child_process";
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

  // Patch INVALIDE (clé inconnue) : jette, et l'opération valide du même
  // patch n'est PAS appliquée — un patch qui échoue ne change rien.
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
      uiLanguageRow: rows.get("ui-language") ?? null,
    })
  );
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
    "roundtrip: invalid patch throws and writes NOTHING",
    j.invalidPatchThrew === true &&
      j.afterInvalidPatchStoryModel === "claude-test-model",
    JSON.stringify(j)
  );
  check(
    "roundtrip: ui-language writes through the central writer",
    j.uiLanguageRow === "en"
  );
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
