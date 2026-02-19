import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parse as dotenvParse } from "dotenv";
import { z } from "zod";

const __dirname = dirname(fileURLToPath(import.meta.url));

const AppEnvSchema = z.enum(["local", "staging", "production"]);

const ConvexEnvSchema = z.object({
  APP_ENV: AppEnvSchema.default("local"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

// Env ownership:
// - Required vars are validated by ConvexEnvSchema.
// - Defaults belong in convex/.env.defaults.
// - app-scoped overrides belong in convex/.env(.staging|.production).
// - process env wins last for CI/runtime injection.
function readEnvFile(path: string): Record<string, string> {
  try {
    return dotenvParse(readFileSync(path));
  } catch {
    return {};
  }
}

function envFileForAppEnv(appEnv: z.infer<typeof AppEnvSchema>) {
  if (appEnv === "local") return ".env";
  if (appEnv === "staging") return ".env.staging";
  return ".env.production";
}

function loadConvexEnv() {
  const defaults = readEnvFile(resolve(__dirname, ".env.defaults"));
  const appEnv = AppEnvSchema.catch("local").parse(process.env.APP_ENV ?? defaults.APP_ENV);
  const envFilePath = resolve(__dirname, envFileForAppEnv(appEnv));
  const fileValues = readEnvFile(envFilePath);
  const merged = { ...defaults, ...fileValues, ...process.env };

  const parsed = ConvexEnvSchema.safeParse(merged);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid convex env configuration:\n${issues}`);
  }
  return parsed.data;
}

const parsedEnv = loadConvexEnv();

export const env = {
  NODE_ENV: parsedEnv.NODE_ENV,
} as const;
