import { loadEnv } from "@repo/config/env";

// Transitional env bootstrap:
// - Root env files are loaded and validated by @repo/config
// - Existing API code can keep reading process.env until it is migrated
const validated = loadEnv();
for (const [k, v] of Object.entries(validated)) {
  if (process.env[k] == null) process.env[k] = String(v);
}
