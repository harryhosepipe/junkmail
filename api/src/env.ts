import { loadEnv, type Env } from "@repo/config/env";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

let cached: Env | null = null;
const appDir = resolve(fileURLToPath(new URL("..", import.meta.url)));

function loadApiEnv(includeLocalFile = true): Env {
  return loadEnv({
    // Keep env ownership in the API app boundary.
    rootDir: appDir,
    defaultsFile: resolve(appDir, ".env.defaults"),
    localFile: includeLocalFile ? resolve(appDir, ".env") : "__missing__.api.env",
    stagingFile: resolve(appDir, ".env.staging"),
    productionFile: resolve(appDir, ".env.production"),
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
    return (e as any)[prop];
  },
});
