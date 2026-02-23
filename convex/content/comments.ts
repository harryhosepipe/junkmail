import { mutation, query } from "../_generated/server";
import { v } from "convex/values";

export const createImageComment = mutation({
  args: {
    commentId: v.string(),
    imageId: v.string(),
    userAuthUserId: v.string(),
    userAlias: v.string(),
    body: v.string(),
    createdAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("imageComments")
      .withIndex("by_comment_id", (q) => q.eq("commentId", args.commentId))
      .unique();
    if (existing) {
      throw new Error(`Comment already exists for commentId=${args.commentId}`);
    }

    await ctx.db.insert("imageComments", {
      commentId: args.commentId,
      imageId: args.imageId,
      userAuthUserId: args.userAuthUserId,
      userAlias: args.userAlias.trim(),
      body: args.body.trim(),
      createdAt: args.createdAt ?? Date.now(),
    });

    return { ok: true };
  },
});

export const listImageComments = query({
  args: {
    imageId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.max(1, Math.min(Math.floor(args.limit ?? 100), 200));
    const rows = await ctx.db
      .query("imageComments")
      .withIndex("by_image_created_at", (q) => q.eq("imageId", args.imageId))
      .order("asc")
      .take(limit);

    return rows.map((row) => ({
      commentId: row.commentId,
      imageId: row.imageId,
      userAuthUserId: row.userAuthUserId,
      userAlias: row.userAlias,
      body: row.body,
      createdAt: row.createdAt,
    }));
  },
});
