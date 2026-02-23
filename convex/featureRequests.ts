import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const normalizeText = (value?: string) => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length ? trimmed : "";
};

export const createFeatureRequest = mutation({
  args: {
    requestId: v.string(),
    title: v.string(),
    description: v.string(),
    status: v.optional(v.string()),
    createdByAuthUserId: v.string(),
    createdByAlias: v.string(),
    createdAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("featureRequests")
      .withIndex("by_request_id", (q) => q.eq("requestId", args.requestId))
      .unique();
    if (existing) {
      throw new Error(`Feature request already exists for requestId=${args.requestId}`);
    }

    const now = args.updatedAt ?? Date.now();
    await ctx.db.insert("featureRequests", {
      requestId: args.requestId,
      title: normalizeText(args.title),
      description: normalizeText(args.description),
      status: normalizeText(args.status) || "open",
      createdByAuthUserId: args.createdByAuthUserId,
      createdByAlias: normalizeText(args.createdByAlias) || "unknown",
      createdAt: args.createdAt ?? now,
      updatedAt: now,
    });

    return { ok: true };
  },
});

export const listFeatureRequests = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.max(1, Math.min(Math.floor(args.limit ?? 50), 200));
    const rows = await ctx.db
      .query("featureRequests")
      .withIndex("by_created_at")
      .order("desc")
      .take(limit);

    return rows.map((row) => ({
      requestId: row.requestId,
      title: row.title,
      description: row.description,
      status: row.status,
      createdByAuthUserId: row.createdByAuthUserId,
      createdByAlias: row.createdByAlias,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  },
});
