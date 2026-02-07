import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { v } from "convex/values";

const LEARNING_RATE = Number(process.env.BRADLEY_TERRY_K) || 0.15;
const INITIAL_SCORE = Number(process.env.RATING_INITIAL_SCORE) || 0;
const INITIAL_UNCERTAINTY = Number(process.env.RATING_INITIAL_UNCERTAINTY) || 1;
const MIN_UNCERTAINTY = Number(process.env.RATING_MIN_UNCERTAINTY) || 0.15;

const updateUncertainty = (comparisonsCount: number) => {
  const next = 1 / Math.sqrt(comparisonsCount + 1);
  return Math.max(MIN_UNCERTAINTY, next);
};

const loadOrCreateRating = async (ctx: MutationCtx, imageId: string) => {
  const existing = await ctx.db
    .query("imageRatings")
    .withIndex("by_image_id", (q) => q.eq("imageId", imageId))
    .unique();
  if (existing) {
    return existing;
  }

  const now = Date.now();
  const insertedId = await ctx.db.insert("imageRatings", {
    imageId,
    score: INITIAL_SCORE,
    uncertainty: INITIAL_UNCERTAINTY,
    comparisonsCount: 0,
    updatedAt: now,
  });

  return {
    _id: insertedId,
    imageId,
    score: INITIAL_SCORE,
    uncertainty: INITIAL_UNCERTAINTY,
    comparisonsCount: 0,
    updatedAt: now,
  };
};

export const recordVote = mutation({
  args: {
    imageAId: v.string(),
    imageBId: v.string(),
    winnerId: v.string(),
    voterHash: v.string(),
    ipHash: v.string(),
    createdAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (args.imageAId === args.imageBId) {
      throw new Error("Matchup must contain two images");
    }

    if (args.winnerId !== args.imageAId && args.winnerId !== args.imageBId) {
      throw new Error("Winner must be one of the matchup images");
    }

    const ratingA = await loadOrCreateRating(ctx, args.imageAId);
    const ratingB = await loadOrCreateRating(ctx, args.imageBId);

    const scoreA = ratingA.score;
    const scoreB = ratingB.score;
    const probabilityA = 1 / (1 + Math.exp(-(scoreA - scoreB)));
    const outcomeA = args.winnerId === args.imageAId ? 1 : 0;
    const deltaA = LEARNING_RATE * (outcomeA - probabilityA);
    const deltaB = -deltaA;

    const nextComparisonsA = ratingA.comparisonsCount + 1;
    const nextComparisonsB = ratingB.comparisonsCount + 1;
    const now = args.createdAt ?? Date.now();

    await ctx.db.patch(ratingA._id, {
      score: scoreA + deltaA,
      comparisonsCount: nextComparisonsA,
      uncertainty: updateUncertainty(nextComparisonsA),
      updatedAt: now,
    });

    await ctx.db.patch(ratingB._id, {
      score: scoreB + deltaB,
      comparisonsCount: nextComparisonsB,
      uncertainty: updateUncertainty(nextComparisonsB),
      updatedAt: now,
    });

    await ctx.db.insert("votes", {
      imageAId: args.imageAId,
      imageBId: args.imageBId,
      winnerId: args.winnerId,
      voterHash: args.voterHash,
      ipHash: args.ipHash,
      createdAt: now,
    });

    return { ok: true };
  },
});

export const getRatingsByImageIds = query({
  args: {
    imageIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const uniqueIds = [...new Set(args.imageIds)].slice(0, 500);
    const rows = await Promise.all(
      uniqueIds.map(async (imageId) => {
        const rating = await ctx.db
          .query("imageRatings")
          .withIndex("by_image_id", (q) => q.eq("imageId", imageId))
          .unique();
        return {
          imageId,
          score: rating?.score ?? INITIAL_SCORE,
          uncertainty: rating?.uncertainty ?? INITIAL_UNCERTAINTY,
          comparisonsCount: rating?.comparisonsCount ?? 0,
          updatedAt: rating?.updatedAt ?? 0,
        };
      }),
    );

    return { ratings: rows };
  },
});

export const getTopRatings = query({
  args: {
    limit: v.number(),
    minComparisons: v.number(),
  },
  handler: async (ctx, args) => {
    const safeLimit = Math.max(1, Math.min(Math.floor(args.limit), 200));
    const minComparisons = Math.max(0, Math.floor(args.minComparisons));

    const rows = await ctx.db.query("imageRatings").collect();
    return rows
      .filter((row) => row.comparisonsCount >= minComparisons)
      .sort((a, b) => b.score - a.score)
      .slice(0, safeLimit)
      .map((row) => ({
        imageId: row.imageId,
        score: row.score,
        uncertainty: row.uncertainty,
        comparisonsCount: row.comparisonsCount,
      }));
  },
});
