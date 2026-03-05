#!/usr/bin/env node

import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

const BLOCKED_SEVERITIES = new Set(["high", "critical"]);
const ALLOWLIST_PATH = ".github/security/audit-allowlist.json";

const stripAnsi = (value) => {
  let result = "";
  let insideEscape = false;

  for (const char of value) {
    if (insideEscape) {
      if ((char >= "A" && char <= "Z") || (char >= "a" && char <= "z")) {
        insideEscape = false;
      }
      continue;
    }

    if (char === "\u001b") {
      insideEscape = true;
      continue;
    }

    result += char;
  }

  return result;
};

const parseAuditJson = (rawOutput) => {
  const sanitized = stripAnsi(rawOutput);
  const lines = sanitized
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const jsonStart = lines.findIndex((line) => line.startsWith("{"));
  if (jsonStart === -1) {
    throw new Error("bun audit --json did not emit JSON output");
  }

  const jsonPayload = lines.slice(jsonStart).join("\n");
  return JSON.parse(jsonPayload);
};

const parseAllowlist = () => {
  if (!existsSync(ALLOWLIST_PATH)) {
    return [];
  }

  const parsed = JSON.parse(readFileSync(ALLOWLIST_PATH, "utf8"));
  if (!Array.isArray(parsed.allowlistedAdvisories)) {
    throw new Error(`${ALLOWLIST_PATH} must contain allowlistedAdvisories[]`);
  }

  return parsed.allowlistedAdvisories.map((entry) => {
    const id = Number(entry.id);
    if (!Number.isFinite(id)) {
      throw new Error(`Invalid allowlist advisory id: ${entry.id}`);
    }

    if (typeof entry.package !== "string" || !entry.package.length) {
      throw new Error(`Allowlist entry ${id} must define a package name`);
    }

    if (typeof entry.reason !== "string" || !entry.reason.length) {
      throw new Error(`Allowlist entry ${id} must include a reason`);
    }

    if (typeof entry.reviewBy !== "string" || Number.isNaN(Date.parse(entry.reviewBy))) {
      throw new Error(`Allowlist entry ${id} has an invalid reviewBy date`);
    }

    if (typeof entry.trackingIssue !== "string" || !entry.trackingIssue.length) {
      throw new Error(`Allowlist entry ${id} must include a trackingIssue`);
    }

    return {
      id,
      package: entry.package,
      reason: entry.reason,
      reviewBy: entry.reviewBy,
      trackingIssue: entry.trackingIssue,
    };
  });
};

const allowlistKey = (id, packageName) => `${id}:${packageName}`;

const readAuditFindings = () => {
  let output;
  try {
    output = execSync("bun audit --json", {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    // bun audit exits non-zero when vulnerabilities are present, but still prints JSON.
    output =
      error && typeof error === "object" && "stdout" in error ? String(error.stdout ?? "") : "";
    if (!output.trim()) {
      throw error;
    }
  }

  const report = parseAuditJson(output);

  return Object.entries(report).flatMap(([packageName, advisories]) =>
    advisories.map((advisory) => ({
      package: packageName,
      id: Number(advisory.id),
      severity: String(advisory.severity || "unknown").toLowerCase(),
      title: advisory.title,
      url: advisory.url,
    })),
  );
};

const asDateOnly = (dateLike) => new Date(`${dateLike}T00:00:00.000Z`);

let findings = [];
try {
  findings = readAuditFindings();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Dependency guard failed: unable to run bun audit (${message})`);
  process.exit(1);
}

const allowlist = parseAllowlist();
const allowlistMap = new Map(
  allowlist.map((entry) => [allowlistKey(entry.id, entry.package), entry]),
);
const usedAllowlist = new Set();

const severityCounts = findings.reduce((counts, finding) => {
  counts[finding.severity] = (counts[finding.severity] ?? 0) + 1;
  return counts;
}, {});

const today = asDateOnly(new Date().toISOString().slice(0, 10));
const blockingFindings = [];

for (const finding of findings) {
  if (!BLOCKED_SEVERITIES.has(finding.severity)) continue;

  const key = allowlistKey(finding.id, finding.package);
  const allowlisted = allowlistMap.get(key);

  if (!allowlisted) {
    blockingFindings.push({
      ...finding,
      reason: "No allowlist entry",
    });
    continue;
  }

  usedAllowlist.add(key);

  const reviewByDate = asDateOnly(allowlisted.reviewBy);
  if (reviewByDate < today) {
    blockingFindings.push({
      ...finding,
      reason: `Allowlist entry expired on ${allowlisted.reviewBy}`,
    });
  }
}

const staleAllowlist = allowlist.filter(
  (entry) => !usedAllowlist.has(allowlistKey(entry.id, entry.package)),
);

if (blockingFindings.length > 0) {
  console.error("Dependency guard failed: unresolved high/critical vulnerabilities.");
  for (const finding of blockingFindings) {
    console.error(`- [${finding.severity}] ${finding.package}#${finding.id}: ${finding.title}`);
    console.error(`  ${finding.url}`);
    console.error(`  reason: ${finding.reason}`);
  }
  process.exit(1);
}

if (staleAllowlist.length > 0) {
  console.error("Dependency guard failed: stale allowlist entries found.");
  for (const entry of staleAllowlist) {
    console.error(`- ${entry.package}#${entry.id} (${entry.trackingIssue})`);
  }
  process.exit(1);
}

console.log("Dependency guardrails passed.");
if (Object.keys(severityCounts).length > 0) {
  console.log("Audit summary:");
  for (const [severity, count] of Object.entries(severityCounts).sort()) {
    console.log(`- ${severity}: ${count}`);
  }
}
