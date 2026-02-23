import { z } from "zod";

const AppEnvSchema = z.enum(["local", "staging", "production"]);

const ConvexEnvSchema = z.object({
  APP_ENV: AppEnvSchema.default("local"),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

function loadConvexEnv() {
  const parsed = ConvexEnvSchema.safeParse({
    APP_ENV: process.env.APP_ENV ?? "local",
    NODE_ENV: process.env.NODE_ENV ?? "development",
  });
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
