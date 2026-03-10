import { z } from "zod";

export const AppEnvSchema = z.enum(["local", "staging", "production"]);
export type AppEnv = z.infer<typeof AppEnvSchema>;

const NumFromString = z
  .string()
  .transform((v) => (v.trim() === "" ? NaN : Number(v)))
  .pipe(z.number());

const BoolFromString = z
  .string()
  .transform((v) => v.toLowerCase())
  .pipe(z.enum(["true", "false"]))
  .transform((v) => v === "true");

const OptionalUrl = z.string().url().optional();
const OptionalString = z.string().optional();
const OptionalNum = NumFromString.optional();
const OptionalBool = BoolFromString.optional();

const originEnvShape = {
  WEB_ORIGIN: OptionalUrl,
  API_ORIGIN: OptionalUrl,
} satisfies z.ZodRawShape;

const convexEnvShape = {
  CONVEX_URL: OptionalUrl,
  PUBLIC_CONVEX_URL: OptionalUrl,
  CONVEX_SELF_HOSTED_URL: OptionalUrl,
  CONVEX_SITE_URL: OptionalUrl,
  CONVEX_ADMIN_KEY: OptionalString,
  CONVEX_SELF_HOSTED_ADMIN_KEY: OptionalString,
} satisfies z.ZodRawShape;

const apiRuntimeEnvShape = {
  NODE_ENV: z.enum(["development", "test", "production"]).optional(),
  PORT: OptionalNum,
} satisfies z.ZodRawShape;

const storageEnvShape = {
  REDIS_URL: OptionalString,
  MINIO_ENDPOINT: OptionalString,
  MINIO_PORT: OptionalNum,
  MINIO_USE_SSL: OptionalBool,
  MINIO_PUBLIC_URL: OptionalUrl,
  MINIO_BUCKET: OptionalString,
  MINIO_REGION: OptionalString,
  MINIO_ACCESS_KEY: OptionalString,
  MINIO_SECRET_KEY: OptionalString,
  ASSETS_PROXY_BASE: OptionalString,
} satisfies z.ZodRawShape;

const authEnvShape = {
  EMAIL_PROVIDER: OptionalString,
  EMAIL_FROM: OptionalString,
  EMAIL_API_KEY: OptionalString,
  SESSION_TTL_DAYS: OptionalNum,
  MAGIC_LINK_TTL_MINUTES: OptionalNum,
} satisfies z.ZodRawShape;

const telegramEnvShape = {
  TELEGRAM_BOT_TOKEN: OptionalString,
  TELEGRAM_ALLOWED_CHAT_IDS: OptionalString,
  TELEGRAM_WEBHOOK_SECRET_TOKEN: OptionalString,
} satisfies z.ZodRawShape;

// Keep this permissive initially to avoid breaking dev unexpectedly.
// Tighten required fields as we migrate each service to the shared env.
export const EnvSchema = z.object({
  APP_ENV: AppEnvSchema.default("local"),
  ...originEnvShape,
  ...convexEnvShape,
  ...apiRuntimeEnvShape,
  ...storageEnvShape,
  ...authEnvShape,
  ...telegramEnvShape,
});

export type Env = z.infer<typeof EnvSchema>;
