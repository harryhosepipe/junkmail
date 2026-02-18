import { Hono } from "hono";
import type { Context } from "hono";
import { ensureSameOrigin } from "../auth/csrf.js";
import { generateToken } from "../auth/tokens.js";
import { getOrCreateVoterId, hashWithSalt } from "../auth/voter.js";
import { getSessionUser } from "../auth/session.js";
import {
  mutateConvexCreateVoteEvent,
  mutateConvexProjectVoteEvent,
  mutateConvexValidateAndConsumeMatchupToken,
  queryConvexPublicImagesByIds,
} from "../convex/client.js";
import { redis } from "../queue/connection.js";
import { voteQueue } from "../queue/index.js";
import { env } from "../env.js";

const votesRouter = new Hono();

const VOTE_HASH_SALT = env.VOTE_HASH_SALT ?? "junkmail-dev-vote";
const IP_HASH_SALT = env.IP_HASH_SALT ?? VOTE_HASH_SALT;

const RATE_LIMIT_BURST = env.VOTE_RATE_LIMIT_BURST ?? 20;
const RATE_LIMIT_BURST_WINDOW = env.VOTE_RATE_LIMIT_BURST_WINDOW ?? 60;
const RATE_LIMIT_SUSTAINED = env.VOTE_RATE_LIMIT_SUSTAINED ?? 240;
const RATE_LIMIT_SUSTAINED_WINDOW = env.VOTE_RATE_LIMIT_SUSTAINED_WINDOW ?? 3600;

const TOKEN_VALIDATION_ACCEPTED = "accepted";

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
  const matchupTokenId = normalizeBodyValue(body.matchup_token);

  if (!imageAId || !imageBId || !winnerId || !matchupTokenId) {
    return c.json({ error: { message: "Missing vote payload" } }, 400);
  }

  if (imageAId === imageBId) {
    return c.json({ error: { message: "Matchup must contain two images" } }, 400);
  }

  if (winnerId !== imageAId && winnerId !== imageBId) {
    return c.json({ error: { message: "Winner must be one of the matchup images" } }, 400);
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

  try {
    const imageRows = await queryConvexPublicImagesByIds([imageAId, imageBId]);
    if (imageRows.length !== 2) {
      return c.json({ error: { message: "Matchup unavailable" } }, 404);
    }
  } catch {
    return c.json({ error: { message: "Matchup lookup unavailable. Try again." } }, 503);
  }

  const validation = await mutateConvexValidateAndConsumeMatchupToken({
    tokenId: matchupTokenId,
    voterHash,
    imageAId,
    imageBId,
    now: Date.now(),
  });

  const voteEventId = generateToken();
  const createdAt = Date.now();
  await mutateConvexCreateVoteEvent({
    voteEventId,
    matchupTokenId,
    imageAId,
    imageBId,
    winnerId,
    voterHash,
    voterAuthUserId: sessionUser?.id,
    ipHash,
    createdAt,
    validationStatus: validation.validationStatus,
    rejectionReason: validation.rejectionReason || undefined,
  });

  if (validation.acceptedForScoring) {
    try {
      await voteQueue.add(
        "project",
        {
          voteEventId,
          createdAt,
        },
        {
          jobId: voteEventId,
        },
      );
    } catch {
      try {
        await mutateConvexProjectVoteEvent({ voteEventId, now: Date.now() });
      } catch {
        return c.json(
          { error: { message: "Vote accepted but projection unavailable. Retry later." } },
          503,
        );
      }
    }
  }

  return c.json({
    ok: true,
    eventId: voteEventId,
    acceptedForScoring: validation.acceptedForScoring,
    reason: validation.acceptedForScoring ? undefined : validation.validationStatus,
    validationStatus: validation.validationStatus,
  });
});

export default votesRouter;
