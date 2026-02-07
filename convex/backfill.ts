import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const resetData = mutation({
  args: {
    includeUsers: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const votes = await ctx.db.query("votes").collect();
    await Promise.all(votes.map((row) => ctx.db.delete(row._id)));

    const ratings = await ctx.db.query("imageRatings").collect();
    await Promise.all(ratings.map((row) => ctx.db.delete(row._id)));

    if (args.includeUsers) {
      const users = await ctx.db.query("userProfiles").collect();
      await Promise.all(users.map((row) => ctx.db.delete(row._id)));
    }

    return { ok: true };
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
