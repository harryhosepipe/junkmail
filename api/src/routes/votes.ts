import { createHash } from "crypto";
import { Hono } from "hono";
import type { Context } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { eq, inArray } from "drizzle-orm";
import { db } from "../db/client.js";
import { images, ratings, votes } from "../db/schema.js";
import { ensureSameOrigin } from "../auth/csrf.js";
import { generateToken } from "../auth/tokens.js";
import { redis } from "../queue/connection.js";

const votesRouter = new Hono();

const VOTER_COOKIE_NAME = "jm_voter";
const VOTE_HASH_SALT = process.env.VOTE_HASH_SALT || "junkmail-dev-vote";
const IP_HASH_SALT = process.env.IP_HASH_SALT || VOTE_HASH_SALT;

const RATE_LIMIT_BURST = Number(process.env.VOTE_RATE_LIMIT_BURST) || 20;
const RATE_LIMIT_BURST_WINDOW = Number(process.env.VOTE_RATE_LIMIT_BURST_WINDOW) || 60;
const RATE_LIMIT_SUSTAINED = Number(process.env.VOTE_RATE_LIMIT_SUSTAINED) || 240;
const RATE_LIMIT_SUSTAINED_WINDOW = Number(process.env.VOTE_RATE_LIMIT_SUSTAINED_WINDOW) || 3600;

const LEARNING_RATE = Number(process.env.BRADLEY_TERRY_K) || 0.15;
const INITIAL_SCORE = Number(process.env.RATING_INITIAL_SCORE) || 0;
const INITIAL_UNCERTAINTY = Number(process.env.RATING_INITIAL_UNCERTAINTY) || 1;
const MIN_UNCERTAINTY = Number(process.env.RATING_MIN_UNCERTAINTY) || 0.15;

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
    secure: process.env.NODE_ENV === "production",
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

const updateUncertainty = (comparisonsCount: number) => {
  const next = 1 / Math.sqrt(comparisonsCount + 1);
  return Math.max(MIN_UNCERTAINTY, next);
};

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

  const now = new Date();

  await db.transaction(async (tx) => {
    await tx
      .insert(ratings)
      .values([
        {
          imageId: imageAId,
          score: INITIAL_SCORE,
          uncertainty: INITIAL_UNCERTAINTY,
          comparisonsCount: 0,
        },
        {
          imageId: imageBId,
          score: INITIAL_SCORE,
          uncertainty: INITIAL_UNCERTAINTY,
          comparisonsCount: 0,
        },
      ])
      .onConflictDoNothing();

    const ratingRows = await tx
      .select({
        imageId: ratings.imageId,
        score: ratings.score,
        uncertainty: ratings.uncertainty,
        comparisonsCount: ratings.comparisonsCount,
      })
      .from(ratings)
      .where(inArray(ratings.imageId, [imageAId, imageBId]));

    const ratingA = ratingRows.find((row) => row.imageId === imageAId);
    const ratingB = ratingRows.find((row) => row.imageId === imageBId);

    if (!ratingA || !ratingB) {
      throw new Error("Ratings unavailable");
    }

    const scoreA = ratingA.score;
    const scoreB = ratingB.score;
    const probabilityA = 1 / (1 + Math.exp(-(scoreA - scoreB)));
    const outcomeA = winnerId === imageAId ? 1 : 0;
    const deltaA = LEARNING_RATE * (outcomeA - probabilityA);
    const deltaB = -deltaA;

    const nextComparisonsA = ratingA.comparisonsCount + 1;
    const nextComparisonsB = ratingB.comparisonsCount + 1;

    await tx
      .update(ratings)
      .set({
        score: scoreA + deltaA,
        comparisonsCount: nextComparisonsA,
        uncertainty: updateUncertainty(nextComparisonsA),
        updatedAt: now,
      })
      .where(eq(ratings.imageId, imageAId));

    await tx
      .update(ratings)
      .set({
        score: scoreB + deltaB,
        comparisonsCount: nextComparisonsB,
        uncertainty: updateUncertainty(nextComparisonsB),
        updatedAt: now,
      })
      .where(eq(ratings.imageId, imageBId));

    await tx.insert(votes).values({
      imageAId,
      imageBId,
      winnerId,
      voterHash,
      ipHash,
      createdAt: now,
    });
  });

  return c.json({ ok: true });
});

export default votesRouter;
