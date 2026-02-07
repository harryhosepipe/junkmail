import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const DEFAULT_BATCH_SIZE = 256;
const MAX_BATCH_SIZE = 512;

const resolveBatchSize = (value?: number) => {
  const raw = Math.floor(value ?? DEFAULT_BATCH_SIZE);
  if (!Number.isFinite(raw) || raw < 1) return DEFAULT_BATCH_SIZE;
  return Math.min(raw, MAX_BATCH_SIZE);
};

export const clearVotesBatch = mutation({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = resolveBatchSize(args.limit);
    const rows = await ctx.db.query("votes").take(limit);
    await Promise.all(rows.map((row) => ctx.db.delete(row._id)));
    return { deleted: rows.length, hasMore: rows.length === limit };
  },
});

export const clearImageRatingsBatch = mutation({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = resolveBatchSize(args.limit);
    const rows = await ctx.db.query("imageRatings").take(limit);
    await Promise.all(rows.map((row) => ctx.db.delete(row._id)));
    return { deleted: rows.length, hasMore: rows.length === limit };
  },
});

export const clearUserProfilesBatch = mutation({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = resolveBatchSize(args.limit);
    const rows = await ctx.db.query("userProfiles").take(limit);
    await Promise.all(rows.map((row) => ctx.db.delete(row._id)));
    return { deleted: rows.length, hasMore: rows.length === limit };
  },
});

export const upsertImageRating = mutation({
  args: {
    imageId: v.string(),
    score: v.number(),
    uncertainty: v.number(),
    comparisonsCount: v.number(),
    updatedAt: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("imageRatings")
      .withIndex("by_image_id", (q) => q.eq("imageId", args.imageId))
      .unique();

    const payload = {
      score: args.score,
      uncertainty: args.uncertainty,
      comparisonsCount: args.comparisonsCount,
      updatedAt: args.updatedAt,
    };

    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return { ok: true };
    }

    await ctx.db.insert("imageRatings", {
      imageId: args.imageId,
      ...payload,
    });
    return { ok: true };
  },
});

export const insertVote = mutation({
  args: {
    imageAId: v.string(),
    imageBId: v.string(),
    winnerId: v.string(),
    voterHash: v.string(),
    ipHash: v.string(),
    createdAt: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("votes", args);
    return { ok: true };
  },
});

export const getCounts = query({
  args: {},
  handler: async (ctx) => {
    const [userProfiles, imageRatings, votes] = await Promise.all([
      ctx.db.query("userProfiles").collect(),
      ctx.db.query("imageRatings").collect(),
      ctx.db.query("votes").collect(),
    ]);

    return {
      userProfiles: userProfiles.length,
      imageRatings: imageRatings.length,
      votes: votes.length,
    };
  },
});
