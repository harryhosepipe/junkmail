import { mutation, query } from "../_generated/server";
import { v } from "convex/values";

const normalizeText = (value?: string) => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length ? trimmed : undefined;
};

export const getImageFingerprintBySha256 = query({
  args: {
    sha256Pixels: v.string(),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("imageFingerprints")
      .withIndex("by_sha256_pixels", (q) => q.eq("sha256Pixels", args.sha256Pixels))
      .take(1);
    const row = rows[0];
    if (!row) return null;
    return row;
  },
});

export const listImageFingerprintsByPhashPrefix = query({
  args: {
    phashPrefix: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.max(1, Math.min(Math.floor(args.limit ?? 100), 500));
    return ctx.db
      .query("imageFingerprints")
      .withIndex("by_phash_prefix", (q) => q.eq("phashPrefix", args.phashPrefix))
      .take(limit);
  },
});

export const listRecentImageFingerprints = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.max(1, Math.min(Math.floor(args.limit ?? 500), 10000));
    return ctx.db.query("imageFingerprints").withIndex("by_created_at").order("desc").take(limit);
  },
});

export const upsertImageFingerprint = mutation({
  args: {
    imageId: v.string(),
    sha256Pixels: v.string(),
    phash64: v.string(),
    phashPrefix: v.string(),
    dhash64: v.optional(v.string()),
    canonicalWidth: v.optional(v.number()),
    canonicalHeight: v.optional(v.number()),
    cropBox: v.optional(v.any()),
    cropMeta: v.optional(v.any()),
    workerVersion: v.optional(v.string()),
    createdAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("imageFingerprints")
      .withIndex("by_image_id", (q) => q.eq("imageId", args.imageId))
      .take(1);
    const payload = {
      imageId: args.imageId,
      sha256Pixels: args.sha256Pixels,
      phash64: args.phash64,
      phashPrefix: args.phashPrefix,
      dhash64: normalizeText(args.dhash64),
      canonicalWidth: args.canonicalWidth,
      canonicalHeight: args.canonicalHeight,
      cropBox: args.cropBox,
      cropMeta: args.cropMeta,
      workerVersion: normalizeText(args.workerVersion),
      createdAt: args.createdAt ?? Date.now(),
    };

    if (existing.length > 0) {
      await ctx.db.patch(existing[0]._id, payload);
      return { ok: true };
    }

    await ctx.db.insert("imageFingerprints", payload);
    return { ok: true };
  },
});

export const recordImageFingerprint = upsertImageFingerprint;
