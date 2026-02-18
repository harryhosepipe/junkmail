import { Hono } from "hono";
import type { Context } from "hono";
import { ensureSameOrigin } from "../auth/csrf.js";
import { getOrCreateVoterId, hashWithSalt } from "../auth/voter.js";
import { getSessionUser } from "../auth/session.js";
import { parseVotePayload, type VotePayload } from "../contracts/votes.js";
import { redis } from "../queue/connection.js";
import { env } from "../env.js";
import { AppError } from "../http/errors.js";
import { submitVote } from "../services/votes/submitVote.js";

const votesRouter = new Hono();

const VOTE_HASH_SALT = env.VOTE_HASH_SALT ?? "junkmail-dev-vote";
const IP_HASH_SALT = env.IP_HASH_SALT ?? VOTE_HASH_SALT;

const RATE_LIMIT_BURST = env.VOTE_RATE_LIMIT_BURST ?? 20;
const RATE_LIMIT_BURST_WINDOW = env.VOTE_RATE_LIMIT_BURST_WINDOW ?? 60;
const RATE_LIMIT_SUSTAINED = env.VOTE_RATE_LIMIT_SUSTAINED ?? 240;
const RATE_LIMIT_SUSTAINED_WINDOW = env.VOTE_RATE_LIMIT_SUSTAINED_WINDOW ?? 3600;

const getClientIp = (c: Context) => {
  const forwarded = c.req.header("x-forwarded-for") || c.req.header("x-real-ip");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }

  const raw = c.req.raw as { socket?: { remoteAddress?: string } };
  return raw.socket?.remoteAddress || "unknown";
};

const rateLimitKey = (prefix: string, hash: string, windowSeconds: number) =>
  `vote:${prefix}:${windowSeconds}:${hash}`;

const incrementWithTtl = async (key: string, ttlSeconds: number) => {
  const count = await redis.incr(key);
  if (count === 1) {
    await redis.expire(key, ttlSeconds);
  }
  return count;
};

const allowedByRateLimit = async (hash: string, prefix: string) => {
  try {
    const burstKey = rateLimitKey(prefix, hash, RATE_LIMIT_BURST_WINDOW);
    const sustainedKey = rateLimitKey(prefix, hash, RATE_LIMIT_SUSTAINED_WINDOW);
    const burstCount = await incrementWithTtl(burstKey, RATE_LIMIT_BURST_WINDOW);
    if (burstCount > RATE_LIMIT_BURST) {
      return false;
    }
    const sustainedCount = await incrementWithTtl(sustainedKey, RATE_LIMIT_SUSTAINED_WINDOW);
    if (sustainedCount > RATE_LIMIT_SUSTAINED) {
      return false;
    }
    return true;
  } catch {
    return true;
  }
};

votesRouter.post("/", async (c) => {
  const csrfError = ensureSameOrigin(c);
  if (csrfError) {
    return csrfError;
  }

  const body = await c.req.json().catch(() => ({}));
  let payload: VotePayload;
  try {
    payload = parseVotePayload(body);
  } catch (err) {
    if (err instanceof AppError) {
      return c.json({ error: { message: err.message } }, err.status as any);
    }
    throw err;
  }

  const voterId = getOrCreateVoterId(c);
  const voterHash = hashWithSalt(voterId, VOTE_HASH_SALT);
  const ipHash = hashWithSalt(getClientIp(c), IP_HASH_SALT);
  const sessionUser = await getSessionUser(c);

  const allowedIp = await allowedByRateLimit(ipHash, "ip");
  const allowedVoter = await allowedByRateLimit(voterHash, "voter");
  if (!allowedIp || !allowedVoter) {
    return c.json(
      {
        error: {
          message: "Too many votes. Slow down.",
          code: "rate_limited",
        },
      },
      429,
    );
  }

  const result = await submitVote({
    payload,
    voterHash,
    ipHash,
    sessionUserId: sessionUser?.id,
  });

  return c.json(result.body, result.status);
});

export default votesRouter;
