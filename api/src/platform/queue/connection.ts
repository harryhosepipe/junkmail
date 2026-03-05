import { Redis } from "ioredis";
import { env, getEnv } from "../../env.js";

getEnv();
const redisUrl = env.REDIS_URL ?? "redis://localhost:6379";

export const redis = new Redis(redisUrl, {
  maxRetriesPerRequest: null,
});
