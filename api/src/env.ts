import { loadEnv, type Env } from "@repo/config/env";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

let cached: Env | null = null;
const appDir = resolve(fileURLToPath(new URL("..", import.meta.url)));
const REQUIRED_DEFAULT_KEYS: ReadonlyArray<keyof Env> = [
  "APP_ENV",
  "NODE_ENV",
  "PORT",
  "WEB_ORIGIN",
  "API_ORIGIN",
  "REDIS_URL",
  "CONVEX_URL",
  "PUBLIC_CONVEX_URL",
  "CONVEX_SELF_HOSTED_URL",
  "CONVEX_SITE_URL",
  "MINIO_ENDPOINT",
  "MINIO_PORT",
  "MINIO_ACCESS_KEY",
  "MINIO_SECRET_KEY",
  "MINIO_BUCKET",
  "MINIO_REGION",
  "MINIO_USE_SSL",
  "MINIO_PUBLIC_URL",
  "ASSETS_PROXY_BASE",
];

// API env ownership:
// - Required keys and typing are defined in packages/config/src/env.schema.ts.
// - Defaults live in api/.env.defaults.
// - app-scoped overrides live in api/.env(.staging|.production).
// - process env wins last for CI/runtime injection.
function loadApiEnv(includeLocalFile = true): Env {
  return loadEnv({
    // Keep env ownership in the API app boundary.
    rootDir: appDir,
    defaultsFile: resolve(appDir, ".env.defaults"),
    localFile: includeLocalFile ? resolve(appDir, ".env") : "__missing__.api.env",
    stagingFile: resolve(appDir, ".env.staging"),
    productionFile: resolve(appDir, ".env.production"),
    requiredDefaultKeys: REQUIRED_DEFAULT_KEYS,
  });
}

export function getEnv(): Env {
  // Tests should not accidentally read local developer secrets from `api/.env`.
  // Also, tests mutate process.env, so don't cache in that case.
  if (process.env.NODE_ENV === "test") {
    return loadApiEnv(false);
  }
  if (cached) return cached;
  cached = loadApiEnv(true);
  return cached;
}

export function resetEnv() {
  cached = null;
}

export const env: Env = new Proxy({} as Env, {
  get(_target, prop) {
    const e = getEnv();
    if (typeof prop !== "string") {
      return undefined;
    }
    return e[prop as keyof Env];
  },
});
