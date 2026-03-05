import { redis } from "../../../platform/queue/connection.js";
import { env } from "../../../env.js";

const RATE_LIMIT_BURST = env.VOTE_RATE_LIMIT_BURST ?? 20;
const RATE_LIMIT_BURST_WINDOW = env.VOTE_RATE_LIMIT_BURST_WINDOW ?? 60;
const RATE_LIMIT_SUSTAINED = env.VOTE_RATE_LIMIT_SUSTAINED ?? 240;
const RATE_LIMIT_SUSTAINED_WINDOW = env.VOTE_RATE_LIMIT_SUSTAINED_WINDOW ?? 3600;

const rateLimitKey = (prefix: string, hash: string, windowSeconds: number) =>
  `vote:${prefix}:${windowSeconds}:${hash}`;

const incrementWithTtl = async (key: string, ttlSeconds: number) => {
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, ttlSeconds);
  }
  return count;
};

type RateLimitResult = {
  allowed: boolean;
  retryAfterSeconds: number;
};

export const allowedByVoteRateLimit = async (
  hash: string,
  prefix: string,
): Promise<RateLimitResult> => {
  try {
    const burstKey = rateLimitKey(prefix, hash, RATE_LIMIT_BURST_WINDOW);
    const sustainedKey = rateLimitKey(prefix, hash, RATE_LIMIT_SUSTAINED_WINDOW);

    const burstCount = await incrementWithTtl(burstKey, RATE_LIMIT_BURST_WINDOW);
    if (burstCount > RATE_LIMIT_BURST) {
      const ttl = await redis.ttl(burstKey).catch(() => -1);
      return {
        allowed: false,
        retryAfterSeconds: ttl > 0 ? ttl : RATE_LIMIT_BURST_WINDOW,
      };
    }

    const sustainedCount = await incrementWithTtl(sustainedKey, RATE_LIMIT_SUSTAINED_WINDOW);
    if (sustainedCount > RATE_LIMIT_SUSTAINED) {
      const ttl = await redis.ttl(sustainedKey).catch(() => -1);
      return {
        allowed: false,
        retryAfterSeconds: ttl > 0 ? ttl : RATE_LIMIT_SUSTAINED_WINDOW,
      };
    }

    return {
      allowed: true,
      retryAfterSeconds: 0,
    };
  } catch {
    return {
      allowed: true,
      retryAfterSeconds: 0,
    };
  }
};
