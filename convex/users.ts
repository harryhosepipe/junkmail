import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const fallbackAlias = (email: string, authUserId: string) => {
  const base = email.split("@")[0]?.trim();
  return base || `user-${authUserId.slice(0, 8)}`;
};

export const getByAuthUserId = query({
  args: {
    authUserId: v.string(),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("userProfiles")
      .withIndex("by_auth_user_id", (q) => q.eq("authUserId", args.authUserId))
      .collect();

    const profile = rows[0];
    if (!profile) {
      return null;
    }

    return {
      authUserId: profile.authUserId,
      email: profile.email,
      alias: profile.alias || fallbackAlias(profile.email, profile.authUserId),
      role: profile.role,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    };
  },
});

export const getByEmail = query({
  args: {
    emailLower: v.string(),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("userProfiles")
      .withIndex("by_email_lower", (q) => q.eq("emailLower", args.emailLower))
      .collect();

    const profile = rows[0];
    if (!profile) {
      return null;
    }

    return {
      authUserId: profile.authUserId,
      email: profile.email,
      alias: profile.alias || fallbackAlias(profile.email, profile.authUserId),
      role: profile.role,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    };
  },
});

export const upsertByAuthUserId = mutation({
  args: {
    authUserId: v.string(),
    email: v.string(),
    alias: v.string(),
    role: v.string(),
    createdAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = args.updatedAt ?? Date.now();
    const rows = await ctx.db
      .query("userProfiles")
      .withIndex("by_auth_user_id", (q) => q.eq("authUserId", args.authUserId))
      .collect();
    const profile = rows[0];
    const next = {
      email: args.email,
      emailLower: args.email.toLowerCase(),
      alias: args.alias.trim() || fallbackAlias(args.email, args.authUserId),
      role: args.role,
      updatedAt: now,
    };

    if (profile) {
      await ctx.db.patch(profile._id, next);
      return { ok: true };
    }

    await ctx.db.insert("userProfiles", {
      authUserId: args.authUserId,
      createdAt: args.createdAt ?? now,
      ...next,
    });

    return { ok: true };
  },
});
