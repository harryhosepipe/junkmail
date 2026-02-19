import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as dotenvParse } from "dotenv";
import { z } from "zod";

const __dirname = dirname(fileURLToPath(import.meta.url));

const AppEnvSchema = z.enum(["local", "staging", "production"]);

const WebEnvSchema = z.object({
  APP_ENV: AppEnvSchema.default("local"),
  API_BASE_URL: z.string().url().default("http://localhost:8787"),
  API_PROXY_TARGET: z.string().url().optional(),
  API_PROXY_ORIGIN: z.string().url().optional(),
  WEB_ORIGIN: z.string().url().optional(),
  APP_ORIGIN: z.string().url().optional(),
  ASSETS_PROXY_TARGET: z.string().url().default("http://localhost:9010"),
  CONVEX_PROXY_TARGET: z.string().url().default("http://localhost:3210"),
});

// Env ownership:
// - Required vars are validated by WebEnvSchema.
// - Defaults belong in web/.env.defaults.
// - app-scoped overrides belong in web/.env(.staging|.production).
// - process env wins last for CI/runtime injection.
function readEnvFile(path) {
  try {
    return dotenvParse(readFileSync(path));
  } catch {
    return {};
  }
}

function envFileForAppEnv(appEnv) {
  if (appEnv === "local") return ".env";
  if (appEnv === "staging") return ".env.staging";
  return ".env.production";
}

function loadWebEnv() {
  const defaults = readEnvFile(resolve(__dirname, ".env.defaults"));
  const appEnv = AppEnvSchema.catch("local").parse(process.env.APP_ENV ?? defaults.APP_ENV);
  const envFilePath = resolve(__dirname, envFileForAppEnv(appEnv));
  const fileValues = readEnvFile(envFilePath);
  const merged = { ...defaults, ...fileValues, ...process.env };

  const parsed = WebEnvSchema.safeParse(merged);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid web env configuration:\n${issues}`);
  }

  return parsed.data;
}

export const webEnv = loadWebEnv();
