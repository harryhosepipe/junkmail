import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import {
  computeImageFingerprint,
  hammingDistanceHex,
  isNearDuplicate,
} from "../services/images/perceptualHash.js";

type FixtureVariant = {
  path: string;
  label?: string;
  expectDuplicate?: boolean;
};

type FixtureCase = {
  id: string;
  original: string;
  variants: FixtureVariant[];
};

type FixtureManifest = {
  cases: FixtureCase[];
};

const DEFAULT_FIXTURE_DIR = path.resolve(process.cwd(), "testing/duplicate-fixtures");

const parseArg = (name: string) => {
  const index = process.argv.findIndex((arg) => arg === name);
  if (index === -1) return undefined;
  return process.argv[index + 1];
};

const resolveFixtureDir = () => {
  const fromFlag = parseArg("--dir");
  return path.resolve(fromFlag || DEFAULT_FIXTURE_DIR);
};

const resolveManifestPath = (fixtureDir: string) => {
  const fromFlag = parseArg("--manifest");
  return path.resolve(fromFlag || path.join(fixtureDir, "manifest.json"));
};

const loadManifest = async (manifestPath: string): Promise<FixtureManifest> => {
  const raw = await readFile(manifestPath, "utf8");
  const parsed = JSON.parse(raw) as Partial<FixtureManifest>;
  if (!Array.isArray(parsed.cases)) {
    throw new Error(`Invalid manifest (missing \"cases\" array): ${manifestPath}`);
  }
  return { cases: parsed.cases as FixtureCase[] };
};

const run = async () => {
  const fixtureDir = resolveFixtureDir();
  const manifestPath = resolveManifestPath(fixtureDir);
  const manifest = await loadManifest(manifestPath);

  if (manifest.cases.length === 0) {
    console.info("No fixture cases found.");
    return;
  }

  let total = 0;
  let failed = 0;

  console.info(`Using fixtures: ${fixtureDir}`);
  console.info(`Using manifest: ${manifestPath}`);

  for (const fixtureCase of manifest.cases) {
    const originalPath = path.resolve(fixtureDir, fixtureCase.original);
    const originalBuffer = await readFile(originalPath);
    const originalFingerprint = await computeImageFingerprint(originalBuffer);

    console.info(`\nCase: ${fixtureCase.id}`);
    console.info(`  original: ${fixtureCase.original}`);

    for (const variant of fixtureCase.variants || []) {
      total += 1;
      const expected = variant.expectDuplicate ?? true;
      const variantPath = path.resolve(fixtureDir, variant.path);
      const variantBuffer = await readFile(variantPath);
      const variantFingerprint = await computeImageFingerprint(variantBuffer);
      const actual = isNearDuplicate({
        incoming: variantFingerprint,
        existing: originalFingerprint,
      });

      const full = hammingDistanceHex(variantFingerprint.full, originalFingerprint.full);
      const center = hammingDistanceHex(variantFingerprint.center, originalFingerprint.center);
      const inner = hammingDistanceHex(variantFingerprint.inner, originalFingerprint.inner);

      const pass = actual === expected;
      if (!pass) failed += 1;

      const tag = pass ? "PASS" : "FAIL";
      const label = variant.label ? ` (${variant.label})` : "";
      console.info(
        `  [${tag}] ${variant.path}${label} expected=${expected} actual=${actual} dist(full=${full},center=${center},inner=${inner})`,
      );
    }
  }

  console.info(`\nSummary: total=${total} passed=${total - failed} failed=${failed}`);
  if (failed > 0) {
    process.exitCode = 1;
  }
};

run().catch((error) => {
  console.error(error instanceof Error ? error.message : "Fixture evaluation failed");
  process.exitCode = 1;
});
