import { createHash } from "crypto";
import { Hono } from "hono";
import type { Context } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { images } from "../db/schema.js";
import { generateToken } from "../auth/tokens.js";
import { redis } from "../queue/connection.js";
import { queryConvexRatingsByImageIds } from "../convex/client.js";

const matchupsRouter = new Hono();

const VOTER_COOKIE_NAME = "jm_voter";
const VOTE_HASH_SALT = process.env.VOTE_HASH_SALT || "junkmail-dev-vote";

const NEW_EXPOSURE_THRESHOLD = Number(process.env.MATCHUP_NEW_EXPOSURE) || 5;
const CLOSE_SAMPLE_SIZE = Number(process.env.MATCHUP_CLOSE_SAMPLE) || 24;
const CLOSE_CANDIDATE_PAIRS = Number(process.env.MATCHUP_CLOSE_CANDIDATE_PAIRS) || 6;
const REPEAT_TTL_SECONDS = Number(process.env.MATCHUP_REPEAT_TTL_SECONDS) || 120;
const MATCHUP_POOL_TTL_SECONDS = Number(process.env.MATCHUP_POOL_TTL_SECONDS) || 10;
const MATCHUP_PAIR_COOLDOWN_MS = Number(process.env.MATCHUP_PAIR_COOLDOWN_MS) || 900;

const WEIGHT_NEW = Number(process.env.MATCHUP_WEIGHT_NEW) || 0.45;
const WEIGHT_CLOSE = Number(process.env.MATCHUP_WEIGHT_CLOSE) || 0.4;
const WEIGHT_RANDOM = Number(process.env.MATCHUP_WEIGHT_RANDOM) || 0.15;

const hashValue = (value: string, salt: string) =>
  createHash("sha256").update(`${salt}:${value}`).digest("hex");

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

const pickRandomPair = <T>(items: T[]) => {
  if (items.length < 2) return null;
  const indexA = Math.floor(Math.random() * items.length);
  let indexB = Math.floor(Math.random() * (items.length - 1));
  if (indexB >= indexA) indexB += 1;
  return [items[indexA], items[indexB]] as const;
};

const sampleItems = <T>(items: T[], count: number) => {
  if (items.length <= count) return [...items];
  const copy = [...items];
  const sample: T[] = [];
  while (sample.length < count && copy.length) {
    const index = Math.floor(Math.random() * copy.length);
    sample.push(copy.splice(index, 1)[0]);
  }
  return sample;
};

const pickClosePair = <T extends { score: number }>(items: T[]) => {
  if (items.length < 2) return null;
  const pool = sampleItems(items, CLOSE_SAMPLE_SIZE);
  if (pool.length < 2) return null;
  const sorted = [...pool].sort((a, b) => a.score - b.score);
  const candidates: Array<{ a: T; b: T; diff: number }> = [];
  for (let i = 0; i < sorted.length - 1; i += 1) {
    candidates.push({
      a: sorted[i],
      b: sorted[i + 1],
      diff: Math.abs(sorted[i + 1].score - sorted[i].score),
    });
  }
  if (!candidates.length) return null;
  const ranked = candidates.sort((a, b) => a.diff - b.diff);
  const top = ranked.slice(0, Math.max(1, CLOSE_CANDIDATE_PAIRS));
  const picked = top[Math.floor(Math.random() * top.length)];
  return [picked.a, picked.b] as const;
};

const pickWeightedReason = (options: Array<{ key: string; weight: number }>) => {
  const total = options.reduce((sum, option) => sum + option.weight, 0);
  if (total <= 0) return options[options.length - 1]?.key;
  let roll = Math.random() * total;
  for (const option of options) {
    roll -= option.weight;
    if (roll <= 0) return option.key;
  }
  return options[options.length - 1]?.key;
};

const isSamePair = (a: string, b: string, prev?: { a: string; b: string } | null) => {
  if (!prev) return false;
  return (a === prev.a && b === prev.b) || (a === prev.b && b === prev.a);
};

const orderedPairKey = (a: string, b: string) => {
  const [left, right] = [a, b].sort();
  return `${left}:${right}`;
};

const claimGlobalPairCooldown = async (a: string, b: string) => {
  if (MATCHUP_PAIR_COOLDOWN_MS <= 0) {
    return true;
  }

  const key = `matchup:pair:${orderedPairKey(a, b)}`;
  try {
    const claimed = await redis.set(key, "1", "PX", MATCHUP_PAIR_COOLDOWN_MS, "NX");
    return claimed === "OK";
  } catch {
    // Do not block matchups on cache failures.
    return true;
  }
};

type MatchupItem = {
  id: string;
  title: string | null;
  description: string | null;
  originalUrl: string;
  variantUrls: unknown;
  createdAt: string | Date;
  score: number;
  comparisonsCount: number;
};

type MatchupPair = [MatchupItem, MatchupItem];

const loadMatchupPool = async (): Promise<MatchupItem[]> => {
  const cacheKey = "matchup:pool";
  if (MATCHUP_POOL_TTL_SECONDS > 0) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached) as MatchupItem[];
        if (Array.isArray(parsed)) {
          return parsed.map((item) => ({
            ...item,
            score: Number(item.score) || 0,
            comparisonsCount: Number(item.comparisonsCount) || 0,
          }));
        }
      }
    } catch {
      // ignore cache errors
    }
  }

  const rows = await db
    .select({
      id: images.id,
      title: images.title,
      description: images.description,
      originalUrl: images.originalUrl,
      variantUrls: images.variantUrls,
      createdAt: images.createdAt,
    })
    .from(images)
    .where(eq(images.status, "public"));

  const ratingRows = await queryConvexRatingsByImageIds(rows.map((row) => row.id));
  const ratingByImageId = new Map(
    ratingRows.map((rating) => [
      rating.imageId,
      {
        score: rating.score ?? 0,
        comparisonsCount: rating.comparisonsCount ?? 0,
      },
    ]),
  );

  const items = rows.map((row) => {
    const rating = ratingByImageId.get(row.id);
    return {
      ...row,
      score: rating?.score ?? 0,
      comparisonsCount: rating?.comparisonsCount ?? 0,
    };
  });

  if (MATCHUP_POOL_TTL_SECONDS > 0) {
    try {
      await redis.set(cacheKey, JSON.stringify(items), "EX", MATCHUP_POOL_TTL_SECONDS);
    } catch {
      // ignore cache errors
    }
  }

  return items;
};

export const createMatchupPayload = async (c: Context) => {
  const voterId = getVoterId(c);
  const voterHash = hashValue(voterId, VOTE_HASH_SALT);
  const repeatKey = `matchup:last:${voterHash}`;
  const items = await loadMatchupPool();

  if (items.length < 2) {
    return null;
  }

  const newItems = items.filter((item) => item.comparisonsCount <= NEW_EXPOSURE_THRESHOLD);
  const availableReasons = [
    newItems.length ? { key: "new", weight: WEIGHT_NEW } : null,
    items.length > 1 ? { key: "close", weight: WEIGHT_CLOSE } : null,
    items.length > 1 ? { key: "random", weight: WEIGHT_RANDOM } : null,
  ].filter(Boolean) as Array<{ key: string; weight: number }>;

  let lastPair: { a: string; b: string } | null = null;
  try {
    const cached = await redis.get(repeatKey);
    if (cached) {
      lastPair = JSON.parse(cached);
    }
  } catch {
    lastPair = null;
  }

  let reason = pickWeightedReason(availableReasons) || "random";
  let selected: MatchupPair | null = null;

  const pickByReason = (key: string) => {
    if (key === "new") {
      if (newItems.length >= 2) {
        return pickRandomPair(newItems);
      }
      if (newItems.length === 1) {
        const otherPool = items.filter((item) => item.id !== newItems[0].id);
        const otherPair = pickRandomPair(otherPool);
        if (!otherPair) return null;
        return [newItems[0], otherPair[0]] as const;
      }
    }
    if (key === "close") {
      return pickClosePair(items);
    }
    return pickRandomPair(items);
  };

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const picked = pickByReason(reason);
    if (picked) {
      const [a, b] = picked;
      if (!isSamePair(a.id, b.id, lastPair) && (await claimGlobalPairCooldown(a.id, b.id))) {
        selected = picked as MatchupPair;
        break;
      }
    }
    reason = "random";
  }

  if (!selected) {
    const fallback = pickRandomPair(items);
    if (!fallback) {
      return null;
    }
    selected = fallback as MatchupPair;
    reason = "random";
  }

  const [a, b] = selected;
  const seed = generateToken();

  try {
    await redis.set(
      repeatKey,
      JSON.stringify({ a: a.id, b: b.id, seed }),
      "EX",
      REPEAT_TTL_SECONDS,
    );
  } catch {
    // ignore cache errors
  }

  console.info("[matchup]", {
    reason,
    a: a.id,
    b: b.id,
    exposureA: a.comparisonsCount,
    exposureB: b.comparisonsCount,
    scoreDiff: Math.abs(a.score - b.score),
    poolNew: newItems.length,
    poolTotal: items.length,
  });

  return {
    a,
    b,
    seed,
    reason,
  };
};

matchupsRouter.get("/next", async (c) => {
  const payload = await createMatchupPayload(c);
  if (!payload) {
    return c.json({ error: { message: "Not enough images" } }, 404);
  }

  return c.json(payload);
});

export default matchupsRouter;
