import { createHash } from "crypto";
import { Hono } from "hono";
import type { Context } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { inArray } from "drizzle-orm";
import { db } from "../db/client.js";
import { images } from "../db/schema.js";
import { ensureSameOrigin } from "../auth/csrf.js";
import { generateToken } from "../auth/tokens.js";
import { getSessionUser } from "../auth/session.js";
import { redis } from "../queue/connection.js";
import { voteQueue } from "../queue/index.js";
import { env } from "../env.js";

const votesRouter = new Hono();

const VOTER_COOKIE_NAME = "jm_voter";
const VOTE_HASH_SALT = env.VOTE_HASH_SALT ?? "junkmail-dev-vote";
const IP_HASH_SALT = env.IP_HASH_SALT ?? VOTE_HASH_SALT;

const RATE_LIMIT_BURST = env.VOTE_RATE_LIMIT_BURST ?? 20;
const RATE_LIMIT_BURST_WINDOW = env.VOTE_RATE_LIMIT_BURST_WINDOW ?? 60;
const RATE_LIMIT_SUSTAINED = env.VOTE_RATE_LIMIT_SUSTAINED ?? 240;
const RATE_LIMIT_SUSTAINED_WINDOW = env.VOTE_RATE_LIMIT_SUSTAINED_WINDOW ?? 3600;

const hashValue = (value: string, salt: string) =>
  createHash("sha256").update(`${salt}:${value}`).digest("hex");

const getClientIp = (c: Context) => {
  const forwarded = c.req.header("x-forwarded-for") || c.req.header("x-real-ip");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }

  const raw = c.req.raw as { socket?: { remoteAddress?: string } };
  return raw.socket?.remoteAddress || "unknown";
};

const getVoterId = (c: Context) => {
  const existing = getCookie(c, VOTER_COOKIE_NAME);
  if (existing) {
    return existing;
  }

  const token = generateToken();
  setCookie(c, VOTER_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "Lax",
    secure: env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return token;
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

const normalizeBodyValue = (value: unknown) => (typeof value === "string" ? value.trim() : "");

votesRouter.post("/", async (c) => {
  const csrfError = ensureSameOrigin(c);
  if (csrfError) {
    return csrfError;
  }

  const body = await c.req.json().catch(() => ({}));
  const imageAId = normalizeBodyValue(body.image_a_id);
  const imageBId = normalizeBodyValue(body.image_b_id);
  const winnerId = normalizeBodyValue(body.winner_id);
  const seed = normalizeBodyValue(body.seed);

  if (!imageAId || !imageBId || !winnerId || !seed) {
    return c.json({ error: { message: "Missing vote payload" } }, 400);
  }

  if (imageAId === imageBId) {
    return c.json({ error: { message: "Matchup must contain two images" } }, 400);
  }

  if (winnerId !== imageAId && winnerId !== imageBId) {
    return c.json({ error: { message: "Winner must be one of the matchup images" } }, 400);
  }

  const voterId = getVoterId(c);
  const voterHash = hashValue(voterId, VOTE_HASH_SALT);
  const ipHash = hashValue(getClientIp(c), IP_HASH_SALT);
  const sessionUser = await getSessionUser(c);

  const allowedIp = await allowedByRateLimit(ipHash, "ip");
  const allowedVoter = await allowedByRateLimit(voterHash, "voter");
  if (!allowedIp || !allowedVoter) {
    const captchaRequired = false;
    return c.json(
      {
        error: {
          message: "Too many votes. Slow down.",
          code: captchaRequired ? "captcha_required" : "rate_limited",
        },
      },
      429,
    );
  }

  const imageRows = await db
    .select({ id: images.id, status: images.status })
    .from(images)
    .where(inArray(images.id, [imageAId, imageBId]));

  if (imageRows.length !== 2 || imageRows.some((row) => row.status !== "public")) {
    return c.json({ error: { message: "Matchup unavailable" } }, 404);
  }

  try {
    await voteQueue.add("record", {
      imageAId,
      imageBId,
      winnerId,
      voterHash,
      voterAuthUserId: sessionUser?.id,
      ipHash,
      createdAt: Date.now(),
    });
  } catch (error) {
    return c.json({ error: { message: "Vote queue unavailable. Try again." } }, 503);
  }

  return c.json({ ok: true });
});

export default votesRouter;
