#!/usr/bin/env node

import { readdirSync, readFileSync } from "node:fs";
import { basename } from "node:path";
import { execSync } from "node:child_process";

const LEGACY_ROUTES_DIR = "api/src/routes";
const FEATURE_ROUTE_GLOB = "api/src/features/*/routes.ts";
const ROUTE_TESTS_DIR = "api/src/tests/routes";

const TEST_PREFIXES_BY_FEATURE = {
  auth: ["auth."],
  convex: ["convex"],
  feed: ["feed"],
  featureRequests: ["featureRequests"],
  images: ["images."],
  matchups: ["matchups"],
  telegram: ["telegram."],
  uploads: ["uploads."],
  voting: ["votes"],
};

const listFiles = (cmd) =>
  execSync(cmd, { encoding: "utf8" })
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

const featureRouteFiles = listFiles(`rg --files -g '${FEATURE_ROUTE_GLOB}'`);
const legacyRouteFiles = readdirSync(LEGACY_ROUTES_DIR)
  .filter((file) => file.endsWith(".ts"))
  .map((file) => `${LEGACY_ROUTES_DIR}/${file}`)
  .sort();
const routeTestFiles = readdirSync(ROUTE_TESTS_DIR).filter((file) => file.endsWith(".test.ts"));

const violations = [];

for (const filePath of legacyRouteFiles) {
  const source = readFileSync(filePath, "utf8").trim();
  if (!source.startsWith('export { default } from "../features/')) {
    violations.push(`${filePath}: legacy route wrapper must re-export feature router only`);
  }
}

for (const filePath of featureRouteFiles) {
  const source = readFileSync(filePath, "utf8");

  if (source.includes("../../services/")) {
    violations.push(
      `${filePath}: routes must import feature-local services/use-cases instead of ../../services/*`,
    );
  }

  if (
    /c\.json\(\s*\{\s*error\b/s.test(source) ||
    /c\.json\(\s*\{\s*ok:\s*false\s*,\s*error\b/s.test(source)
  ) {
    violations.push(
      `${filePath}: use jsonError()/toErrorResponse() for error envelopes, do not inline error JSON`,
    );
  }
}

for (const filePath of featureRouteFiles) {
  const parts = filePath.split("/");
  const featureName = parts[3];
  const expectedPrefixes = TEST_PREFIXES_BY_FEATURE[featureName] || [featureName];

  const hasCoverage = routeTestFiles.some((testFile) =>
    expectedPrefixes.some((prefix) => basename(testFile).startsWith(prefix)),
  );

  if (!hasCoverage) {
    violations.push(
      `${filePath}: missing route test coverage in ${ROUTE_TESTS_DIR} (expected prefix: ${expectedPrefixes.join(", ")})`,
    );
  }
}

if (violations.length > 0) {
  console.error("API boundary guard failed.");
  for (const violation of violations) {
    console.error(`- ${violation}`);
  }
  process.exit(1);
}

console.log("API boundary guardrails passed.");
