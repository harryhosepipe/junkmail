#!/usr/bin/env node

import { execSync } from "node:child_process";

const PATCHED_MIN = {
  ajv: "8.18.0",
  lodash: "4.17.23",
};

const run = (command) => execSync(command, { encoding: "utf8" }).trim();

const parseJson = (value, label) => {
  try {
    return JSON.parse(value);
  } catch (error) {
    throw new Error(`Failed to parse ${label}`, {
      cause: error,
    });
  }
};

const parseSemver = (value) => {
  const [major, minor, patch] = value.split(".").map((part) => Number(part));
  if (![major, minor, patch].every(Number.isFinite)) {
    throw new Error(`Invalid semver: ${value}`);
  }
  return { major, minor, patch };
};

const isAtLeast = (value, minimum) => {
  const a = parseSemver(value);
  const b = parseSemver(minimum);
  if (a.major !== b.major) return a.major > b.major;
  if (a.minor !== b.minor) return a.minor > b.minor;
  return a.patch >= b.patch;
};

const lockVersionFor = (name) => {
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`"${escaped}": \\["[^@]+@([^"\\s]+)"`);
  const lock = run("cat bun.lock");
  const match = lock.match(regex);
  return match ? match[1] : null;
};

const compareSemver = (left, right) => {
  const a = parseSemver(left);
  const b = parseSemver(right);
  if (a.major !== b.major) return a.major - b.major;
  if (a.minor !== b.minor) return a.minor - b.minor;
  return a.patch - b.patch;
};

const npmVersion = (specifier) => {
  const raw = run(`npm view ${JSON.stringify(specifier)} version --json`);
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed === "string") return parsed;
    if (Array.isArray(parsed) && parsed.length) {
      return [...parsed].sort(compareSemver).at(-1);
    }
  } catch {
    // Fall through to regex extraction for non-JSON outputs.
  }

  const matches = [...raw.matchAll(/\d+\.\d+\.\d+/g)].map((match) => match[0]);
  if (matches.length === 0) {
    throw new Error(`Unable to resolve version for ${specifier}`);
  }
  return [...new Set(matches)].sort(compareSemver).at(-1);
};
const npmJson = (specifier, field) =>
  parseJson(run(`npm view ${JSON.stringify(specifier)} ${field} --json`), `${specifier} ${field}`);

const astroLangServerVersion = npmVersion("@astrojs/language-server");
const volarYamlVersion = npmVersion("volar-service-yaml");
const yamlLanguageServerLatestVersion = npmVersion("yaml-language-server");

const volarYamlDeps = npmJson(`volar-service-yaml@${volarYamlVersion}`, "dependencies");

const yamlRange = volarYamlDeps["yaml-language-server"];
if (!yamlRange) {
  throw new Error("volar-service-yaml does not declare yaml-language-server dependency");
}

const yamlLanguageServerResolvedVersion = npmVersion(`yaml-language-server@${yamlRange}`);
const yamlServerDeps = npmJson(
  `yaml-language-server@${yamlLanguageServerResolvedVersion}`,
  "dependencies",
);
const ajvRange = yamlServerDeps.ajv;
const lodashRange = yamlServerDeps.lodash;
if (!ajvRange) {
  throw new Error(
    `yaml-language-server@${yamlLanguageServerResolvedVersion} has no ajv dependency`,
  );
}

const resolvedAjv = npmVersion(`ajv@${ajvRange}`);
const resolvedLodash = lodashRange ? npmVersion(`lodash@${lodashRange}`) : null;

const lockAjv = lockVersionFor("yaml-language-server/ajv") || "unknown";
const lockLodash = lockVersionFor("lodash") || "unknown";

const upstreamFixed =
  isAtLeast(resolvedAjv, PATCHED_MIN.ajv) &&
  (!resolvedLodash || isAtLeast(resolvedLodash, PATCHED_MIN.lodash));

console.log("Upstream advisory tracker (language-server toolchain):");
console.log(`- @astrojs/language-server: ${astroLangServerVersion}`);
console.log(`- volar-service-yaml: ${volarYamlVersion} (yaml-language-server range: ${yamlRange})`);
console.log(
  `- yaml-language-server latest: ${yamlLanguageServerLatestVersion}, resolved from range: ${yamlLanguageServerResolvedVersion}`,
);
console.log(`- yaml-language-server -> ajv range ${ajvRange}, resolves to ${resolvedAjv}`);
console.log(
  `- yaml-language-server -> lodash range ${lodashRange || "(none)"}, resolves to ${resolvedLodash || "(none)"}`,
);
console.log(`- lockfile yaml-language-server/ajv: ${lockAjv}`);
console.log(`- lockfile lodash: ${lockLodash}`);

if (upstreamFixed) {
  console.error(
    "Upstream appears fixed. Action required: upgrade lockfile/dependencies and clear tracking issue.",
  );
  process.exit(1);
}

console.log("Upstream still unresolved; keep tracking issue open.");
