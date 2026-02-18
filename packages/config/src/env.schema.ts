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

// Keep this permissive initially to avoid breaking dev unexpectedly.
// Tighten required fields as we migrate each service to the shared env.
export const EnvSchema = z.object({
  APP_ENV: AppEnvSchema.default("local"),

  // Origins and routing
  APP_ORIGIN: z.string().url().optional(),
  WEB_ORIGIN: z.string().url().optional(),
  API_ORIGIN: z.string().url().optional(),
  API_BASE_URL: z.string().url().optional(), // legacy name (migrate to API_ORIGIN)
  WEB_BASE_URL: z.string().url().optional(), // legacy name (migrate to WEB_ORIGIN)
  PUBLIC_API_BASE_URL: z.string().url().optional(), // legacy public API alias
  CORS_ORIGIN: z.string().optional(), // legacy API setting

  // Convex
  CONVEX_URL: z.string().url().optional(),
  PUBLIC_CONVEX_URL: z.string().url().optional(),
  CONVEX_SELF_HOSTED_URL: z.string().url().optional(),
  CONVEX_SITE_URL: z.string().url().optional(),
  CONVEX_ADMIN_KEY: z.string().optional(),
  CONVEX_SELF_HOSTED_ADMIN_KEY: z.string().optional(),

  // API runtime
  NODE_ENV: z.enum(["development", "test", "production"]).optional(),
  PORT: NumFromString.optional(),

  // Redis / BullMQ
  REDIS_URL: z.string().optional(),

  // MinIO / S3
  MINIO_ENDPOINT: z.string().optional(),
  MINIO_PORT: NumFromString.optional(),
  MINIO_USE_SSL: BoolFromString.optional(),
  MINIO_PUBLIC_URL: z.string().url().optional(),
  MINIO_BUCKET: z.string().optional(),
  MINIO_REGION: z.string().optional(),
  MINIO_ACCESS_KEY: z.string().optional(),
  MINIO_SECRET_KEY: z.string().optional(),
  ASSETS_PROXY_BASE: z.string().optional(),

  // Email (optional)
  EMAIL_PROVIDER: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  EMAIL_API_KEY: z.string().optional(),

  // Auth/session (optional)
  SESSION_TTL_DAYS: NumFromString.optional(),
  MAGIC_LINK_TTL_MINUTES: NumFromString.optional(),

  // Voting and rate limits
  VOTE_HASH_SALT: z.string().optional(),
  IP_HASH_SALT: z.string().optional(),
  VOTE_RATE_LIMIT_BURST: NumFromString.optional(),
  VOTE_RATE_LIMIT_BURST_WINDOW: NumFromString.optional(),
  VOTE_RATE_LIMIT_SUSTAINED: NumFromString.optional(),
  VOTE_RATE_LIMIT_SUSTAINED_WINDOW: NumFromString.optional(),

  // Matchup tuning
  MATCHUP_NEW_EXPOSURE: NumFromString.optional(),
  MATCHUP_CLOSE_SAMPLE: NumFromString.optional(),
  MATCHUP_CLOSE_CANDIDATE_PAIRS: NumFromString.optional(),
  MATCHUP_REPEAT_TTL_SECONDS: NumFromString.optional(),
  MATCHUP_POOL_TTL_SECONDS: NumFromString.optional(),
  MATCHUP_PAIR_COOLDOWN_MS: NumFromString.optional(),
  MATCHUP_WEIGHT_NEW: NumFromString.optional(),
  MATCHUP_WEIGHT_CLOSE: NumFromString.optional(),
  MATCHUP_WEIGHT_RANDOM: NumFromString.optional(),

  // Toplist tuning
  TOPLIST_MIN_COMPARISONS: NumFromString.optional(),
  TOPLIST_CACHE_SECONDS: NumFromString.optional(),

  // Image border crop tuning
  IMAGE_CROP_ENABLED: BoolFromString.optional(),
  IMAGE_CROP_ANALYSIS_MAX_DIM: NumFromString.optional(),
  IMAGE_CROP_WHITE_THRESHOLD: NumFromString.optional(),
  IMAGE_CROP_BLACK_THRESHOLD: NumFromString.optional(),
  IMAGE_CROP_LINE_DOMINANCE: NumFromString.optional(),
  IMAGE_CROP_LINE_STDDEV_MAX: NumFromString.optional(),
  IMAGE_CROP_MAX_TRIM_RATIO_PER_SIDE: NumFromString.optional(),
  IMAGE_CROP_MIN_REMAINING_RATIO: NumFromString.optional(),
  IMAGE_CROP_MIN_CONFIDENCE: NumFromString.optional(),
  IMAGE_CROP_MIN_TRIM_PIXELS: NumFromString.optional(),
  IMAGE_CROP_MIN_AREA_REMOVED_RATIO: NumFromString.optional(),
  IMAGE_CROP_RECT_DETECT_ENABLED: BoolFromString.optional(),
  IMAGE_CROP_RECT_ANALYSIS_MAX_DIM: NumFromString.optional(),
  IMAGE_CROP_RECT_MIN_AREA_RATIO: NumFromString.optional(),
  IMAGE_CROP_RECT_MIN_CONFIDENCE: NumFromString.optional(),
  IMAGE_CROP_RECT_ASPECT_MIN: NumFromString.optional(),
  IMAGE_CROP_RECT_ASPECT_MAX: NumFromString.optional(),
  IMAGE_CROP_RECT_ROW_FOREGROUND_RATIO: NumFromString.optional(),
  IMAGE_CROP_RECT_COL_FOREGROUND_RATIO: NumFromString.optional(),
  IMAGE_CROP_RECT_COLOR_DISTANCE: NumFromString.optional(),
  IMAGE_CROP_RECT_LUMA_DISTANCE: NumFromString.optional(),
  IMAGE_CROP_RECT_CENTER_WEIGHT: NumFromString.optional(),
  IMAGE_DEDUPE_V2_ENABLED: BoolFromString.optional(),
  IMAGE_DEDUPE_ORB_ENABLED: BoolFromString.optional(),
  IMAGE_DEDUPE_ORB_REQUIRED: BoolFromString.optional(),
  IMAGE_DEDUPE_ORB_VERIFIER_URL: z.string().url().optional(),
  IMAGE_DEDUPE_ORB_SHARED_SECRET: z.string().optional(),
  IMAGE_DEDUPE_ORB_TIMEOUT_MS: NumFromString.optional(),
  IMAGE_DEDUPE_ORB_RETRIES: NumFromString.optional(),
  IMAGE_DEDUPE_PHASH_PREFIX_RADIUS: NumFromString.optional(),
  IMAGE_DEDUPE_PHASH_MAX_DISTANCE_STRONG: NumFromString.optional(),
  IMAGE_DEDUPE_PHASH_MAX_DISTANCE_WEAK: NumFromString.optional(),
  IMAGE_DEDUPE_ORB_MIN_INLIERS: NumFromString.optional(),
  IMAGE_DEDUPE_ORB_MIN_INLIER_RATIO: NumFromString.optional(),
  IMAGE_DEDUPE_ORB_MIN_MATCHES: NumFromString.optional(),
  IMAGE_DEDUPE_ORB_FORCE_ALL_CANDIDATES: BoolFromString.optional(),
  IMAGE_DEDUPE_ORB_FORCE_MAX_CANDIDATES: NumFromString.optional(),
  IMAGE_CLASSIFICATION_ENABLED: BoolFromString.optional(),
  IMAGE_CLASSIFICATION_TIMEOUT_MS: NumFromString.optional(),
  IMAGE_CLASSIFICATION_MAX_RETRIES: NumFromString.optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENAI_MODEL_VISION: z.string().optional(),

  // Telegram ingest (optional)
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  TELEGRAM_ALLOWED_CHAT_IDS: z.string().optional(),
  TELEGRAM_WEBHOOK_SECRET_TOKEN: z.string().optional(),

  // Realtime voting validation script
  REALTIME_TEST_USERS: NumFromString.optional(),
  REALTIME_TEST_VOTES_PER_USER: NumFromString.optional(),
  REALTIME_TEST_PROBE_VOTES: NumFromString.optional(),
  REALTIME_TEST_PROBE_TIMEOUT_MS: NumFromString.optional(),
  REALTIME_TEST_PROBE_POLL_MS: NumFromString.optional(),
  REALTIME_TEST_DISCOVERY_ROUNDS: NumFromString.optional(),
  REALTIME_TEST_P95_TARGET_MS: NumFromString.optional(),
  REALTIME_TEST_UPDATE_P95_TARGET_MS: NumFromString.optional(),
  REALTIME_TEST_DRAIN_TIMEOUT_MS: NumFromString.optional(),
  REALTIME_TEST_DRAIN_POLL_MS: NumFromString.optional(),

  // Convex rating params (currently used from convex/ directly)
  BRADLEY_TERRY_K: NumFromString.optional(),
  RATING_INITIAL_SCORE: NumFromString.optional(),
  RATING_INITIAL_UNCERTAINTY: NumFromString.optional(),
  RATING_MIN_UNCERTAINTY: NumFromString.optional(),
});

export type Env = z.infer<typeof EnvSchema>;
