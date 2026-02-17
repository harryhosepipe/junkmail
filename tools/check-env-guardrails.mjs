#!/usr/bin/env node

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const SOURCE_EXTENSIONS = ["*.ts", "*.tsx", "*.mts", "*.cts", "*.js", "*.mjs", "*.cjs"];

const ALLOWED_PROCESS_ENV_FILES = new Set([
  "packages/config/src/env.ts",
  "packages/config/src/spawn.ts",
  "api/src/env.ts",
  "web/astro.config.mjs",
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
  const example = readFileSync(".env.example", "utf8");
  return new Set([...example.matchAll(/^([A-Z][A-Z0-9_]+)=/gm)].map((m) => m[1]));
};

const compareKeySets = () => {
  const schemaKeys = parseEnvSchemaKeys();
  const exampleKeys = parseEnvExampleKeys();

  const missingInExample = [...schemaKeys].filter((k) => !exampleKeys.has(k)).sort();
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
  console.error("Env contract failed: .env.example and EnvSchema must stay aligned.");
  if (missingInExample.length) {
    console.error("Missing in .env.example:");
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
