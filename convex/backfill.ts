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

export const clearAuthTokensBatch = mutation({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = resolveBatchSize(args.limit);
    const rows = await ctx.db.query("authTokens").take(limit);
    await Promise.all(rows.map((row) => ctx.db.delete(row._id)));
    return { deleted: rows.length, hasMore: rows.length === limit };
  },
});

export const clearSessionsBatch = mutation({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = resolveBatchSize(args.limit);
    const rows = await ctx.db.query("sessions").take(limit);
    await Promise.all(rows.map((row) => ctx.db.delete(row._id)));
    return { deleted: rows.length, hasMore: rows.length === limit };
  },
});

export const clearImagesBatch = mutation({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = resolveBatchSize(args.limit);
    const rows = await ctx.db.query("images").take(limit);
    await Promise.all(rows.map((row) => ctx.db.delete(row._id)));
    return { deleted: rows.length, hasMore: rows.length === limit };
  },
});

export const clearImageCommentsBatch = mutation({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = resolveBatchSize(args.limit);
    const rows = await ctx.db.query("imageComments").take(limit);
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

export const upsertImage = mutation({
  args: {
    imageId: v.string(),
    uploaderAuthUserId: v.string(),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    status: v.string(),
    originalUrl: v.optional(v.string()),
    variantUrls: v.optional(v.any()),
    createdAt: v.number(),
    updatedAt: v.number(),
    publishedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("images")
      .withIndex("by_image_id", (q) => q.eq("imageId", args.imageId))
      .unique();

    const payload = {
      imageId: args.imageId,
      uploaderAuthUserId: args.uploaderAuthUserId,
      title: args.title,
      description: args.description,
      status: args.status,
      originalUrl: args.originalUrl,
      variantUrls: args.variantUrls,
      createdAt: args.createdAt,
      updatedAt: args.updatedAt,
      publishedAt: args.publishedAt,
    };

    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return { ok: true };
    }

    await ctx.db.insert("images", payload);
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

export const insertImageComment = mutation({
  args: {
    commentId: v.string(),
    imageId: v.string(),
    userAuthUserId: v.string(),
    userAlias: v.string(),
    body: v.string(),
    createdAt: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("imageComments", args);
    return { ok: true };
  },
});

export const getCounts = query({
  args: {},
  handler: async (ctx) => {
    const [userProfiles, authTokens, sessions, imageRatings, votes, images, imageComments] =
      await Promise.all([
      ctx.db.query("userProfiles").collect(),
      ctx.db.query("authTokens").collect(),
      ctx.db.query("sessions").collect(),
      ctx.db.query("imageRatings").collect(),
      ctx.db.query("votes").collect(),
      ctx.db.query("images").collect(),
      ctx.db.query("imageComments").collect(),
      ]);

    return {
      userProfiles: userProfiles.length,
      authTokens: authTokens.length,
      sessions: sessions.length,
      imageRatings: imageRatings.length,
      votes: votes.length,
      images: images.length,
      imageComments: imageComments.length,
    };
  },
});
