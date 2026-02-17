import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const createAuthToken = mutation({
  args: {
    tokenHash: v.string(),
    userAuthUserId: v.string(),
    expiresAt: v.number(),
    createdAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = args.createdAt ?? Date.now();
    await ctx.db.insert("authTokens", {
      tokenHash: args.tokenHash,
      userAuthUserId: args.userAuthUserId,
      expiresAt: args.expiresAt,
      createdAt: now,
      usedAt: undefined,
    });
    return { ok: true };
  },
});

export const consumeAuthToken = mutation({
  args: {
    tokenHash: v.string(),
    now: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const current = args.now ?? Date.now();
    const token = await ctx.db
      .query("authTokens")
      .withIndex("by_token_hash", (q) => q.eq("tokenHash", args.tokenHash))
      .unique();

    if (!token || token.usedAt || token.expiresAt <= current) {
      return null;
    }

    await ctx.db.patch(token._id, { usedAt: current });
    return { userAuthUserId: token.userAuthUserId };
  },
});

export const createSession = mutation({
  args: {
    tokenHash: v.string(),
    userAuthUserId: v.string(),
    expiresAt: v.number(),
    createdAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("sessions", {
      tokenHash: args.tokenHash,
      userAuthUserId: args.userAuthUserId,
      expiresAt: args.expiresAt,
      createdAt: args.createdAt ?? Date.now(),
    });
    return { ok: true };
  },
});

export const deleteSessionByTokenHash = mutation({
  args: {
    tokenHash: v.string(),
  },
  handler: async (ctx, args) => {
    const token = await ctx.db
      .query("sessions")
      .withIndex("by_token_hash", (q) => q.eq("tokenHash", args.tokenHash))
      .unique();
    if (!token) {
      return { ok: true };
    }
    await ctx.db.delete(token._id);
    return { ok: true };
  },
});

export const getSessionUserAuthUserId = query({
  args: {
    tokenHash: v.string(),
    now: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const current = args.now ?? Date.now();
    const token = await ctx.db
      .query("sessions")
      .withIndex("by_token_hash", (q) => q.eq("tokenHash", args.tokenHash))
      .unique();
    if (!token || token.expiresAt <= current) {
      return null;
    }
    return { userAuthUserId: token.userAuthUserId };
  },
});
