import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const normalizeText = (value?: string) => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length ? trimmed : undefined;
};

export const createImage = mutation({
  args: {
    imageId: v.string(),
    uploaderAuthUserId: v.string(),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    status: v.string(),
    originalUrl: v.optional(v.string()),
    originalStorageId: v.optional(v.string()),
    variantUrls: v.optional(v.any()),
    createdAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
    publishedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("images")
      .withIndex("by_image_id", (q) => q.eq("imageId", args.imageId))
      .unique();
    if (existing) {
      throw new Error(`Image already exists for imageId=${args.imageId}`);
    }

    const now = args.updatedAt ?? Date.now();
    await ctx.db.insert("images", {
      imageId: args.imageId,
      uploaderAuthUserId: args.uploaderAuthUserId,
      title: normalizeText(args.title),
      description: normalizeText(args.description),
      status: args.status,
      originalUrl: normalizeText(args.originalUrl),
      originalStorageId: normalizeText(args.originalStorageId),
      variantUrls: args.variantUrls,
      createdAt: args.createdAt ?? now,
      updatedAt: now,
      publishedAt: args.publishedAt,
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
    originalStorageId: v.optional(v.string()),
    variantUrls: v.optional(v.any()),
    createdAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
    publishedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = args.updatedAt ?? Date.now();
    const existing = await ctx.db
      .query("images")
      .withIndex("by_image_id", (q) => q.eq("imageId", args.imageId))
      .unique();

    const next = {
      uploaderAuthUserId: args.uploaderAuthUserId,
      title: normalizeText(args.title),
      description: normalizeText(args.description),
      status: args.status,
      originalUrl: normalizeText(args.originalUrl),
      originalStorageId: normalizeText(args.originalStorageId),
      variantUrls: args.variantUrls,
      updatedAt: now,
      publishedAt: args.publishedAt,
    };

    if (existing) {
      await ctx.db.patch(existing._id, next);
      return { ok: true };
    }

    await ctx.db.insert("images", {
      imageId: args.imageId,
      createdAt: args.createdAt ?? now,
      ...next,
    });

    return { ok: true };
  },
});

export const getImageById = query({
  args: {
    imageId: v.string(),
  },
  handler: async (ctx, args) => {
    const row = await ctx.db
      .query("images")
      .withIndex("by_image_id", (q) => q.eq("imageId", args.imageId))
      .unique();
    if (!row) {
      return null;
    }

    return {
      imageId: row.imageId,
      uploaderAuthUserId: row.uploaderAuthUserId,
      title: row.title,
      description: row.description,
      status: row.status,
      originalUrl: row.originalUrl,
      originalStorageId: row.originalStorageId,
      variantUrls: row.variantUrls,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      publishedAt: row.publishedAt,
    };
  },
});

export const listRecentPublicImages = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.max(1, Math.min(Math.floor(args.limit ?? 24), 100));
    const rows = await ctx.db
      .query("images")
      .withIndex("by_status_created_at", (q) => q.eq("status", "public"))
      .order("desc")
      .take(limit);

    return rows.map((row) => ({
      imageId: row.imageId,
      uploaderAuthUserId: row.uploaderAuthUserId,
      title: row.title,
      description: row.description,
      status: row.status,
      originalUrl: row.originalUrl,
      variantUrls: row.variantUrls,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      publishedAt: row.publishedAt,
    }));
  },
});

export const listPublicImages = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.max(1, Math.min(Math.floor(args.limit ?? 500), 2000));
    const rows = await ctx.db
      .query("images")
      .withIndex("by_status_created_at", (q) => q.eq("status", "public"))
      .order("desc")
      .take(limit);

    return rows.map((row) => ({
      imageId: row.imageId,
      uploaderAuthUserId: row.uploaderAuthUserId,
      title: row.title,
      description: row.description,
      status: row.status,
      originalUrl: row.originalUrl,
      variantUrls: row.variantUrls,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      publishedAt: row.publishedAt,
    }));
  },
});

export const listPublicImagesByIds = query({
  args: {
    imageIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const ids = [...new Set(args.imageIds)].slice(0, 500);
    const rows = await Promise.all(
      ids.map((imageId) =>
        ctx.db
          .query("images")
          .withIndex("by_image_id", (q) => q.eq("imageId", imageId))
          .unique(),
      ),
    );

    return rows
      .filter((row): row is NonNullable<typeof row> => Boolean(row))
      .filter((row) => row.status === "public")
      .map((row) => ({
        imageId: row.imageId,
        uploaderAuthUserId: row.uploaderAuthUserId,
        title: row.title,
        description: row.description,
        status: row.status,
        originalUrl: row.originalUrl,
        variantUrls: row.variantUrls,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        publishedAt: row.publishedAt,
      }));
  },
});

export const listUploaderImages = query({
  args: {
    uploaderAuthUserId: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.max(1, Math.min(Math.floor(args.limit ?? 50), 200));
    const rows = await ctx.db
      .query("images")
      .withIndex("by_uploader_created_at", (q) =>
        q.eq("uploaderAuthUserId", args.uploaderAuthUserId),
      )
      .order("desc")
      .take(limit);

    return rows.map((row) => ({
      imageId: row.imageId,
      uploaderAuthUserId: row.uploaderAuthUserId,
      title: row.title,
      description: row.description,
      status: row.status,
      originalUrl: row.originalUrl,
      variantUrls: row.variantUrls,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      publishedAt: row.publishedAt,
    }));
  },
});

export const countUploaderImages = query({
  args: {
    uploaderAuthUserId: v.string(),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("images")
      .withIndex("by_uploader_created_at", (q) =>
        q.eq("uploaderAuthUserId", args.uploaderAuthUserId),
      )
      .collect();
    return { count: rows.length };
  },
});

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

export const setImageStatus = mutation({
  args: {
    imageId: v.string(),
    status: v.string(),
    updatedAt: v.optional(v.number()),
    publishedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("images")
      .withIndex("by_image_id", (q) => q.eq("imageId", args.imageId))
      .unique();
    if (!existing) {
      throw new Error(`Image not found for imageId=${args.imageId}`);
    }

    await ctx.db.patch(existing._id, {
      status: args.status,
      updatedAt: args.updatedAt ?? Date.now(),
      publishedAt: args.publishedAt,
    });

    return { ok: true };
  },
});

export const setImageProcessingResult = mutation({
  args: {
    imageId: v.string(),
    status: v.string(),
    variantUrls: v.optional(v.any()),
    updatedAt: v.optional(v.number()),
    publishedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("images")
      .withIndex("by_image_id", (q) => q.eq("imageId", args.imageId))
      .unique();
    if (!existing) {
      throw new Error(`Image not found for imageId=${args.imageId}`);
    }

    await ctx.db.patch(existing._id, {
      status: args.status,
      variantUrls: args.variantUrls,
      updatedAt: args.updatedAt ?? Date.now(),
      publishedAt: args.publishedAt,
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
