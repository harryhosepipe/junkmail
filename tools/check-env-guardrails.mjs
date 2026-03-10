#!/usr/bin/env node

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const SOURCE_EXTENSIONS = ["*.ts", "*.tsx", "*.mts", "*.cts", "*.js", "*.mjs", "*.cjs"];

const OMITTED_FROM_API_ENV_EXAMPLE = new Set([
  "MAGIC_LINK_TTL_MINUTES",
  "SESSION_TTL_DAYS",
  "REALTIME_TEST_USERS",
  "REALTIME_TEST_VOTES_PER_USER",
  "REALTIME_TEST_PROBE_VOTES",
  "REALTIME_TEST_PROBE_TIMEOUT_MS",
  "REALTIME_TEST_PROBE_POLL_MS",
  "REALTIME_TEST_DISCOVERY_ROUNDS",
  "REALTIME_TEST_P95_TARGET_MS",
  "REALTIME_TEST_UPDATE_P95_TARGET_MS",
  "REALTIME_TEST_DRAIN_TIMEOUT_MS",
  "REALTIME_TEST_DRAIN_POLL_MS",
]);

const ALLOWED_PROCESS_ENV_FILES = new Set([
  "packages/config/src/env.ts",
  "packages/config/src/spawn.ts",
  "api/src/env.ts",
  "api/src/features/matchups/application/matchupConfig.ts",
  "api/src/features/voting/application/votingConfig.ts",
  "api/src/platform/queue/imagePipelineConfig.ts",
  "api/src/scripts/validateRealtimeVoting.ts",
  "api/src/shared/application/images/toplistConfig.ts",
  "web/astro.config.mjs",
  "web/env.mjs",
  "infra/cloudflared/dev-staging.mjs",
  "convex/env.ts",
  "tools/check-env-guardrails.mjs",
]);

const IGNORED_PATH_SNIPPETS = [
  "/node_modules/",
  "/dist/",
  "/.astro/",
  "/convex/_generated/",
  "/.beads/",
  "/LLM/",
];

const isEscapeHatchPath = (path) =>
  path.includes(".test.") ||
  path.includes("/__tests__/") ||
  path.includes("/migrations/") ||
  path.includes("/migration/");

const listSourceFiles = () => {
  const globs = SOURCE_EXTENSIONS.map((ext) => `-g '${ext}'`).join(" ");
  const output = execSync(`rg --files ${globs}`, { encoding: "utf8" });
  return output
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((path) => !IGNORED_PATH_SNIPPETS.some((snippet) => path.includes(snippet)));
};

const findProcessEnvViolations = () => {
  const violations = [];

  for (const path of listSourceFiles()) {
    const source = readFileSync(path, "utf8");
    if (!source.includes("process.env")) continue;
    if (ALLOWED_PROCESS_ENV_FILES.has(path)) continue;
    if (isEscapeHatchPath(path)) continue;

    const lines = source.split("\n");
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      if (!line.includes("process.env")) continue;
      if (line.includes("env-guard: allow")) continue;
      violations.push(`${path}:${i + 1}`);
    }
  }

  return violations;
};

const parseEnvSchemaKeys = () => {
  const schema = readFileSync("packages/config/src/env.schema.ts", "utf8");
  return new Set([...schema.matchAll(/^\s*([A-Z][A-Z0-9_]+):\s/gm)].map((m) => m[1]));
};

const parseEnvExampleKeys = () => {
  const example = readFileSync("api/.env.example", "utf8");
  return new Set([...example.matchAll(/^([A-Z][A-Z0-9_]+)=/gm)].map((m) => m[1]));
};

const compareKeySets = () => {
  const schemaKeys = parseEnvSchemaKeys();
  const exampleKeys = parseEnvExampleKeys();

  const missingInExample = [...schemaKeys]
    .filter((k) => !exampleKeys.has(k))
    .filter((k) => !OMITTED_FROM_API_ENV_EXAMPLE.has(k))
    .sort();
  const missingInSchema = [...exampleKeys].filter((k) => !schemaKeys.has(k)).sort();

  return { missingInExample, missingInSchema };
};

const processEnvViolations = findProcessEnvViolations();
const { missingInExample, missingInSchema } = compareKeySets();

let failed = false;

if (processEnvViolations.length) {
  failed = true;
  console.error("Env guard failed: direct process.env usage is restricted.");
  console.error("Allowed: shared loaders, tests, and migrations.");
  for (const violation of processEnvViolations) {
    console.error(`- ${violation}`);
  }
}

if (missingInExample.length || missingInSchema.length) {
  failed = true;
  console.error(
    "Env contract failed: api/.env.example must document required/default app env keys.",
  );
  if (missingInExample.length) {
    console.error("Missing in api/.env.example:");
    for (const key of missingInExample) console.error(`- ${key}`);
  }
  if (missingInSchema.length) {
    console.error("Missing in packages/config/src/env.schema.ts:");
    for (const key of missingInSchema) console.error(`- ${key}`);
  }
}

if (failed) {
  process.exit(1);
}

console.log("Env guardrails passed.");
