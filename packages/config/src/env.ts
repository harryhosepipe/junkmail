import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parse as dotenvParse } from "dotenv";
import { AppEnvSchema, EnvSchema, type AppEnv, type Env } from "./env.schema.js";

export type { AppEnv, Env } from "./env.schema.js";

export type LoadEnvOptions = {
  rootDir?: string;
  appEnv?: AppEnv;
  defaultsFile?: string;
  localFile?: string;
  stagingFile?: string;
  productionFile?: string;
};

let cached: Env | null = null;

function envFileForAppEnv(appEnv: AppEnv, opts: Required<LoadEnvOptions>) {
  if (appEnv === "local") return opts.localFile;
  if (appEnv === "staging") return opts.stagingFile;
  return opts.productionFile;
}

function readEnvFile(path: string): Record<string, string> {
  try {
    const raw = readFileSync(path);
    return dotenvParse(raw);
  } catch {
    return {};
  }
}

function findRepoRoot(startDir: string) {
  // Walk upward looking for a marker file at the monorepo root.
  // This avoids relying on the current working directory (apps may run from web/ or api/).
  let dir = resolve(startDir);
  while (true) {
    const hasAgents = existsSync(resolve(dir, "AGENTS.md"));
    const hasRootPkg = existsSync(resolve(dir, "package.json"));
    if (hasAgents && hasRootPkg) return dir;

    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return startDir;
}

function normalizeRootDir(rootDir?: string) {
  return rootDir ? resolve(rootDir) : findRepoRoot(process.cwd());
}

export function loadEnv(options: LoadEnvOptions = {}): Env {
  const rootDir = normalizeRootDir(options.rootDir);

  // Defaults match the policy in LLM/organize.md.
  const opts: Required<LoadEnvOptions> = {
    rootDir,
    appEnv: options.appEnv ?? "local",
    defaultsFile: options.defaultsFile ?? resolve(rootDir, ".env.defaults"),
    localFile: options.localFile ?? resolve(rootDir, ".env.local"),
    stagingFile: options.stagingFile ?? resolve(rootDir, ".env.staging"),
    productionFile: options.productionFile ?? resolve(rootDir, ".env.production")
  };

  const appEnv = AppEnvSchema.catch("local").parse(process.env.APP_ENV ?? opts.appEnv);
  const specificFile = envFileForAppEnv(appEnv, opts);

  // Layer: defaults -> environment-specific -> actual process env (wins)
  const defaults = readEnvFile(opts.defaultsFile);
  const specific = readEnvFile(specificFile);

  const merged: Record<string, string | undefined> = {
    ...defaults,
    ...specific,
    ...process.env
  };

  // Zod expects strings. Strip undefined and keep only string values.
  const input: Record<string, string> = {};
  for (const [k, v] of Object.entries(merged)) {
    if (typeof v === "string") input[k] = v;
  }

  const parsed = EnvSchema.safeParse(input);
  if (!parsed.success) {
    const msg = parsed.error.issues
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${msg}`);
  }

  return parsed.data;
}

export function getEnv(options: LoadEnvOptions = {}): Env {
  if (cached) return cached;
  cached = loadEnv(options);
  return cached;
}

export const env: Env = new Proxy({} as Env, {
  get(_target, prop) {
    const e = getEnv();
    return (e as any)[prop];
  }
});

export function assertAppEnv(value: unknown): AppEnv {
  const parsed = AppEnvSchema.safeParse(value);
  if (!parsed.success) {
    throw new Error(`Invalid APP_ENV: ${String(value)}`);
  }
  return parsed.data;
}
