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
      inviteToken: profile.inviteToken,
      telegramUserId: profile.telegramUserId,
      telegramUsername: profile.telegramUsername,
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
      inviteToken: profile.inviteToken,
      telegramUserId: profile.telegramUserId,
      telegramUsername: profile.telegramUsername,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
    };
  },
});

export const getByTelegramUserId = query({
  args: {
    telegramUserId: v.number(),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("userProfiles")
      .withIndex("by_telegram_user_id", (q) => q.eq("telegramUserId", args.telegramUserId))
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
      inviteToken: profile.inviteToken,
      telegramUserId: profile.telegramUserId,
      telegramUsername: profile.telegramUsername,
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
    inviteToken: v.optional(v.string()),
    telegramUserId: v.optional(v.number()),
    telegramUsername: v.optional(v.string()),
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
      inviteToken: args.inviteToken,
      telegramUserId: args.telegramUserId,
      telegramUsername: args.telegramUsername?.trim() || undefined,
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

export const updateAlias = mutation({
  args: {
    authUserId: v.string(),
    alias: v.string(),
    updatedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = args.updatedAt ?? Date.now();
    const profile = await ctx.db
      .query("userProfiles")
      .withIndex("by_auth_user_id", (q) => q.eq("authUserId", args.authUserId))
      .unique();
    if (!profile) {
      throw new Error(`User profile not found for authUserId=${args.authUserId}`);
    }

    await ctx.db.patch(profile._id, {
      alias: args.alias.trim() || fallbackAlias(profile.email, profile.authUserId),
      updatedAt: now,
    });
    return { ok: true };
  },
});

export const upsertTelegramUser = mutation({
  args: {
    telegramUserId: v.number(),
    email: v.string(),
    alias: v.string(),
    role: v.string(),
    telegramUsername: v.optional(v.string()),
    inviteToken: v.optional(v.string()),
    createdAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = args.updatedAt ?? Date.now();
    const existing = await ctx.db
      .query("userProfiles")
      .withIndex("by_telegram_user_id", (q) => q.eq("telegramUserId", args.telegramUserId))
      .unique();

    const authUserId = existing?.authUserId ?? `tg:${args.telegramUserId}`;
    const payload = {
      authUserId,
      email: args.email.toLowerCase(),
      emailLower: args.email.toLowerCase(),
      alias: args.alias.trim() || fallbackAlias(args.email, authUserId),
      role: args.role,
      inviteToken: args.inviteToken,
      telegramUserId: args.telegramUserId,
      telegramUsername: args.telegramUsername?.trim() || undefined,
      updatedAt: now,
    };

    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return { authUserId };
    }

    await ctx.db.insert("userProfiles", {
      ...payload,
      createdAt: args.createdAt ?? now,
    });
    return { authUserId };
  },
});
