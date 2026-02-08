import { loadEnv, type Env } from "@repo/config/env";

let cached: Env | null = null;

export function getEnv(): Env {
  // Tests should not accidentally read local developer secrets from `.env.local`.
  // Also, tests mutate process.env, so don't cache in that case.
  if (process.env.NODE_ENV === "test") {
    return loadEnv({
      // Point to missing files (loadEnv will treat them as empty).
      localFile: "__missing__.env.local",
      stagingFile: "__missing__.env.staging",
      productionFile: "__missing__.env.production",
    });
  }
  if (cached) return cached;
  cached = loadEnv();
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
