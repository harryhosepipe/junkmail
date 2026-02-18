import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const normalizeText = (value?: string) => {
  const trimmed = value?.trim();
  return trimmed && trimmed.length ? trimmed : undefined;
};

export const createImage = mutation({
  args: {
    imageId: v.string(),
    uploadId: v.optional(v.string()),
    uploaderAuthUserId: v.string(),
    uploadHash: v.optional(v.string()),
    perceptualHashAnchor: v.optional(v.string()),
    perceptualHashes: v.optional(v.any()),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    status: v.string(),
    storageKeyOriginal: v.optional(v.string()),
    storageKeyCanonical: v.optional(v.string()),
    mime: v.optional(v.string()),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    rejectReason: v.optional(v.string()),
    matchedImageId: v.optional(v.string()),
    dedupeScores: v.optional(v.any()),
    category: v.optional(v.string()),
    classificationStatus: v.optional(v.string()),
    classificationError: v.optional(v.string()),
    classificationModel: v.optional(v.string()),
    classifiedAt: v.optional(v.number()),
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
      uploadId: normalizeText(args.uploadId),
      uploaderAuthUserId: args.uploaderAuthUserId,
      uploadHash: normalizeText(args.uploadHash),
      perceptualHashAnchor: normalizeText(args.perceptualHashAnchor),
      perceptualHashes: args.perceptualHashes,
      title: normalizeText(args.title),
      description: normalizeText(args.description),
      status: args.status,
      storageKeyOriginal: normalizeText(args.storageKeyOriginal),
      storageKeyCanonical: normalizeText(args.storageKeyCanonical),
      mime: normalizeText(args.mime),
      width: args.width,
      height: args.height,
      rejectReason: normalizeText(args.rejectReason),
      matchedImageId: normalizeText(args.matchedImageId),
      dedupeScores: args.dedupeScores,
      category: normalizeText(args.category),
      classificationStatus: normalizeText(args.classificationStatus),
      classificationError: normalizeText(args.classificationError),
      classificationModel: normalizeText(args.classificationModel),
      classifiedAt: args.classifiedAt,
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
    uploadId: v.optional(v.string()),
    uploaderAuthUserId: v.string(),
    uploadHash: v.optional(v.string()),
    perceptualHashAnchor: v.optional(v.string()),
    perceptualHashes: v.optional(v.any()),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    status: v.string(),
    storageKeyOriginal: v.optional(v.string()),
    storageKeyCanonical: v.optional(v.string()),
    mime: v.optional(v.string()),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    rejectReason: v.optional(v.string()),
    matchedImageId: v.optional(v.string()),
    dedupeScores: v.optional(v.any()),
    category: v.optional(v.string()),
    classificationStatus: v.optional(v.string()),
    classificationError: v.optional(v.string()),
    classificationModel: v.optional(v.string()),
    classifiedAt: v.optional(v.number()),
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
      uploadId: normalizeText(args.uploadId),
      uploaderAuthUserId: args.uploaderAuthUserId,
      uploadHash: normalizeText(args.uploadHash),
      perceptualHashAnchor: normalizeText(args.perceptualHashAnchor),
      perceptualHashes: args.perceptualHashes,
      title: normalizeText(args.title),
      description: normalizeText(args.description),
      status: args.status,
      storageKeyOriginal: normalizeText(args.storageKeyOriginal),
      storageKeyCanonical: normalizeText(args.storageKeyCanonical),
      mime: normalizeText(args.mime),
      width: args.width,
      height: args.height,
      rejectReason: normalizeText(args.rejectReason),
      matchedImageId: normalizeText(args.matchedImageId),
      dedupeScores: args.dedupeScores,
      category: normalizeText(args.category),
      classificationStatus: normalizeText(args.classificationStatus),
      classificationError: normalizeText(args.classificationError),
      classificationModel: normalizeText(args.classificationModel),
      classifiedAt: args.classifiedAt,
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

export const setImagePerceptualHashes = mutation({
  args: {
    imageId: v.string(),
    perceptualHashAnchor: v.optional(v.string()),
    perceptualHashes: v.optional(v.any()),
    updatedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("images")
      .withIndex("by_image_id", (q) => q.eq("imageId", args.imageId))
      .unique();
    if (!existing) return { ok: false };

    await ctx.db.patch(existing._id, {
      perceptualHashAnchor: normalizeText(args.perceptualHashAnchor),
      perceptualHashes: args.perceptualHashes,
      updatedAt: args.updatedAt ?? Date.now(),
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
      uploadId: row.uploadId,
      uploaderAuthUserId: row.uploaderAuthUserId,
      uploadHash: row.uploadHash,
      perceptualHashAnchor: row.perceptualHashAnchor,
      perceptualHashes: row.perceptualHashes,
      title: row.title,
      description: row.description,
      category: row.category,
      classificationStatus: row.classificationStatus,
      classificationError: row.classificationError,
      classificationModel: row.classificationModel,
      classifiedAt: row.classifiedAt,
      status: row.status,
      storageKeyOriginal: row.storageKeyOriginal,
      storageKeyCanonical: row.storageKeyCanonical,
      mime: row.mime,
      width: row.width,
      height: row.height,
      rejectReason: row.rejectReason,
      matchedImageId: row.matchedImageId,
      dedupeScores: row.dedupeScores,
      originalUrl: row.originalUrl,
      originalStorageId: row.originalStorageId,
      variantUrls: row.variantUrls,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      publishedAt: row.publishedAt,
    };
  },
});

export const getImageByUploadHash = query({
  args: {
    uploadHash: v.string(),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("images")
      .withIndex("by_upload_hash", (q) => q.eq("uploadHash", args.uploadHash))
      .take(1);
    const row = rows[0];
    if (!row) return null;

    return {
      imageId: row.imageId,
      uploadId: row.uploadId,
      uploaderAuthUserId: row.uploaderAuthUserId,
      uploadHash: row.uploadHash,
      perceptualHashAnchor: row.perceptualHashAnchor,
      perceptualHashes: row.perceptualHashes,
      title: row.title,
      description: row.description,
      category: row.category,
      classificationStatus: row.classificationStatus,
      classificationError: row.classificationError,
      classificationModel: row.classificationModel,
      classifiedAt: row.classifiedAt,
      status: row.status,
      storageKeyOriginal: row.storageKeyOriginal,
      storageKeyCanonical: row.storageKeyCanonical,
      mime: row.mime,
      width: row.width,
      height: row.height,
      rejectReason: row.rejectReason,
      matchedImageId: row.matchedImageId,
      dedupeScores: row.dedupeScores,
      originalUrl: row.originalUrl,
      originalStorageId: row.originalStorageId,
      variantUrls: row.variantUrls,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      publishedAt: row.publishedAt,
    };
  },
});

export const getImageByUploadId = query({
  args: {
    uploadId: v.string(),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("images")
      .withIndex("by_upload_id", (q) => q.eq("uploadId", args.uploadId))
      .take(1);
    const row = rows[0];
    if (!row) return null;

    return {
      imageId: row.imageId,
      uploadId: row.uploadId,
      uploaderAuthUserId: row.uploaderAuthUserId,
      uploadHash: row.uploadHash,
      perceptualHashAnchor: row.perceptualHashAnchor,
      perceptualHashes: row.perceptualHashes,
      title: row.title,
      description: row.description,
      category: row.category,
      classificationStatus: row.classificationStatus,
      classificationError: row.classificationError,
      classificationModel: row.classificationModel,
      classifiedAt: row.classifiedAt,
      status: row.status,
      originalUrl: row.originalUrl,
      originalStorageId: row.originalStorageId,
      storageKeyOriginal: row.storageKeyOriginal,
      storageKeyCanonical: row.storageKeyCanonical,
      mime: row.mime,
      width: row.width,
      height: row.height,
      rejectReason: row.rejectReason,
      matchedImageId: row.matchedImageId,
      dedupeScores: row.dedupeScores,
      variantUrls: row.variantUrls,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      publishedAt: row.publishedAt,
    };
  },
});

export const createPendingImage = mutation({
  args: {
    imageId: v.string(),
    uploadId: v.string(),
    uploaderAuthUserId: v.string(),
    description: v.optional(v.string()),
    mime: v.optional(v.string()),
    createdAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("images")
      .withIndex("by_upload_id", (q) => q.eq("uploadId", args.uploadId))
      .take(1);
    if (existing.length > 0) {
      return { ok: true, imageId: existing[0].imageId, deduped: true };
    }

    const now = args.updatedAt ?? Date.now();
    await ctx.db.insert("images", {
      imageId: args.imageId,
      uploadId: normalizeText(args.uploadId),
      uploaderAuthUserId: args.uploaderAuthUserId,
      description: normalizeText(args.description),
      status: "pending",
      classificationStatus: "pending",
      mime: normalizeText(args.mime),
      createdAt: args.createdAt ?? now,
      updatedAt: now,
    });
    return { ok: true, imageId: args.imageId, deduped: false };
  },
});

export const markImageRejected = mutation({
  args: {
    imageId: v.string(),
    reason: v.string(),
    matchedImageId: v.optional(v.string()),
    scores: v.optional(v.any()),
    updatedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("images")
      .withIndex("by_image_id", (q) => q.eq("imageId", args.imageId))
      .unique();
    if (!existing) return { ok: false };

    await ctx.db.patch(existing._id, {
      status: "rejected",
      rejectReason: normalizeText(args.reason),
      matchedImageId: normalizeText(args.matchedImageId),
      dedupeScores: args.scores,
      updatedAt: args.updatedAt ?? Date.now(),
    });
    return { ok: true };
  },
});

export const markImageAccepted = mutation({
  args: {
    imageId: v.string(),
    status: v.optional(v.string()),
    storageKeyCanonical: v.optional(v.string()),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    variantUrls: v.optional(v.any()),
    updatedAt: v.optional(v.number()),
    publishedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("images")
      .withIndex("by_image_id", (q) => q.eq("imageId", args.imageId))
      .unique();
    if (!existing) return { ok: false };

    await ctx.db.patch(existing._id, {
      status: normalizeText(args.status) || "public",
      storageKeyCanonical: normalizeText(args.storageKeyCanonical),
      width: args.width,
      height: args.height,
      variantUrls: args.variantUrls,
      updatedAt: args.updatedAt ?? Date.now(),
      publishedAt: args.publishedAt ?? Date.now(),
    });
    return { ok: true };
  },
});

export const listImagesByPerceptualHashAnchor = query({
  args: {
    anchor: v.string(),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.max(1, Math.min(Math.floor(args.limit ?? 64), 256));
    const rows = await ctx.db
      .query("images")
      .withIndex("by_perceptual_hash_anchor", (q) => q.eq("perceptualHashAnchor", args.anchor))
      .take(limit);

    return rows.map((row) => ({
      imageId: row.imageId,
      uploaderAuthUserId: row.uploaderAuthUserId,
      uploadHash: row.uploadHash,
      perceptualHashAnchor: row.perceptualHashAnchor,
      perceptualHashes: row.perceptualHashes,
      title: row.title,
      description: row.description,
      category: row.category,
      classificationStatus: row.classificationStatus,
      classificationError: row.classificationError,
      classificationModel: row.classificationModel,
      classifiedAt: row.classifiedAt,
      status: row.status,
      originalUrl: row.originalUrl,
      originalStorageId: row.originalStorageId,
      variantUrls: row.variantUrls,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      publishedAt: row.publishedAt,
    }));
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
      uploadHash: row.uploadHash,
      perceptualHashAnchor: row.perceptualHashAnchor,
      perceptualHashes: row.perceptualHashes,
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

export const listRecentImages = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.max(1, Math.min(Math.floor(args.limit ?? 200), 1000));
    const rows = await ctx.db.query("images").order("desc").take(limit);

    return rows.map((row) => ({
      imageId: row.imageId,
      uploaderAuthUserId: row.uploaderAuthUserId,
      uploadHash: row.uploadHash,
      perceptualHashAnchor: row.perceptualHashAnchor,
      perceptualHashes: row.perceptualHashes,
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
      uploadHash: row.uploadHash,
      perceptualHashAnchor: row.perceptualHashAnchor,
      perceptualHashes: row.perceptualHashes,
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
        uploadHash: row.uploadHash,
        perceptualHashAnchor: row.perceptualHashAnchor,
        perceptualHashes: row.perceptualHashes,
        title: row.title,
        description: row.description,
        category: row.category,
        classificationStatus: row.classificationStatus,
        classificationError: row.classificationError,
        classificationModel: row.classificationModel,
        classifiedAt: row.classifiedAt,
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
      uploadHash: row.uploadHash,
      perceptualHashAnchor: row.perceptualHashAnchor,
      perceptualHashes: row.perceptualHashes,
      title: row.title,
      description: row.description,
      category: row.category,
      classificationStatus: row.classificationStatus,
      classificationError: row.classificationError,
      classificationModel: row.classificationModel,
      classifiedAt: row.classifiedAt,
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
    storageKeyCanonical: v.optional(v.string()),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
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
      storageKeyCanonical: normalizeText(args.storageKeyCanonical),
      width: args.width,
      height: args.height,
      updatedAt: args.updatedAt ?? Date.now(),
      publishedAt: args.publishedAt,
    });

    return { ok: true };
  },
});

export const setImageClassificationPending = mutation({
  args: {
    imageId: v.string(),
    model: v.optional(v.string()),
    updatedAt: v.optional(v.number()),
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
      classificationStatus: "pending",
      classificationError: undefined,
      classificationModel: normalizeText(args.model),
      updatedAt: args.updatedAt ?? Date.now(),
    });

    return { ok: true };
  },
});

export const setImageClassificationResult = mutation({
  args: {
    imageId: v.string(),
    title: v.string(),
    category: v.string(),
    model: v.optional(v.string()),
    classifiedAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("images")
      .withIndex("by_image_id", (q) => q.eq("imageId", args.imageId))
      .unique();
    if (!existing) {
      throw new Error(`Image not found for imageId=${args.imageId}`);
    }

    const now = args.updatedAt ?? Date.now();
    await ctx.db.patch(existing._id, {
      title: normalizeText(args.title),
      category: normalizeText(args.category),
      classificationStatus: "completed",
      classificationError: undefined,
      classificationModel: normalizeText(args.model),
      classifiedAt: args.classifiedAt ?? now,
      updatedAt: now,
    });

    return { ok: true };
  },
});

export const setImageClassificationFailed = mutation({
  args: {
    imageId: v.string(),
    error: v.string(),
    model: v.optional(v.string()),
    updatedAt: v.optional(v.number()),
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
      classificationStatus: "failed",
      classificationError: normalizeText(args.error),
      classificationModel: normalizeText(args.model),
      updatedAt: args.updatedAt ?? Date.now(),
    });

    return { ok: true };
  },
});

export const deleteImageGraph = mutation({
  args: {
    imageId: v.string(),
  },
  handler: async (ctx, args) => {
    const image = await ctx.db
      .query("images")
      .withIndex("by_image_id", (q) => q.eq("imageId", args.imageId))
      .unique();
    if (!image) {
      return { ok: false, deleted: false };
    }

    const ratings = await ctx.db
      .query("imageRatings")
      .withIndex("by_image_id", (q) => q.eq("imageId", args.imageId))
      .collect();
    const comments = await ctx.db
      .query("imageComments")
      .withIndex("by_image_created_at", (q) => q.eq("imageId", args.imageId))
      .collect();
    const fingerprints = await ctx.db
      .query("imageFingerprints")
      .withIndex("by_image_id", (q) => q.eq("imageId", args.imageId))
      .collect();
    const uploadEvents = await ctx.db
      .query("dedupeEvents")
      .withIndex("by_upload_image_id", (q) => q.eq("uploadImageId", args.imageId))
      .collect();
    const winnerVotes = await ctx.db
      .query("votes")
      .withIndex("by_winner_id", (q) => q.eq("winnerId", args.imageId))
      .collect();
    const matchupTokens = await ctx.db.query("matchupTokens").collect();
    const relatedTokens = matchupTokens.filter(
      (token) => token.imageAId === args.imageId || token.imageBId === args.imageId,
    );

    const deletions = [
      ...ratings.map((row) => row._id),
      ...comments.map((row) => row._id),
      ...fingerprints.map((row) => row._id),
      ...uploadEvents.map((row) => row._id),
      ...winnerVotes.map((row) => row._id),
      ...relatedTokens.map((row) => row._id),
      image._id,
    ];

    for (const id of deletions) {
      await ctx.db.delete(id);
    }

    return {
      ok: true,
      deleted: true,
      deletedCounts: {
        ratings: ratings.length,
        comments: comments.length,
        fingerprints: fingerprints.length,
        dedupeEvents: uploadEvents.length,
        winnerVotes: winnerVotes.length,
        matchupTokens: relatedTokens.length,
        images: 1,
      },
    };
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

export const createDedupeEvent = mutation({
  args: {
    uploadImageId: v.string(),
    decision: v.string(),
    reason: v.string(),
    matchedImageId: v.optional(v.string()),
    scores: v.optional(v.any()),
    metrics: v.optional(v.any()),
    workerVersion: v.optional(v.string()),
    createdAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("dedupeEvents", {
      uploadImageId: args.uploadImageId,
      decision: args.decision,
      reason: args.reason,
      matchedImageId: normalizeText(args.matchedImageId),
      scores: args.scores,
      metrics: args.metrics,
      workerVersion: normalizeText(args.workerVersion),
      createdAt: args.createdAt ?? Date.now(),
    });
    return { ok: true };
  },
});

export const listRecentDedupeEvents = query({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const limit = Math.max(1, Math.min(Math.floor(args.limit ?? 100), 500));
    return ctx.db.query("dedupeEvents").withIndex("by_created_at").order("desc").take(limit);
  },
});

export const getDedupeStats = query({
  args: {
    windowHours: v.optional(v.number()),
    sampleLimit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const windowHours = Math.max(1, Math.min(Math.floor(args.windowHours ?? 24), 24 * 30));
    const sampleLimit = Math.max(100, Math.min(Math.floor(args.sampleLimit ?? 2000), 10000));
    const cutoff = Date.now() - windowHours * 60 * 60 * 1000;
    const rows = await ctx.db
      .query("dedupeEvents")
      .withIndex("by_created_at")
      .order("desc")
      .take(sampleLimit);
    const inWindow = rows.filter((row) => row.createdAt >= cutoff);

    const byDecision: Record<string, number> = {};
    const byReason: Record<string, number> = {};
    let orbErrorCount = 0;
    const latencies: number[] = [];
    const phashDistances: number[] = [];
    const orbInliers: number[] = [];
    const orbRatios: number[] = [];

    for (const row of inWindow) {
      byDecision[row.decision] = (byDecision[row.decision] || 0) + 1;
      byReason[row.reason] = (byReason[row.reason] || 0) + 1;
      if (row.reason === "orb_error_fallback") orbErrorCount += 1;

      const duration = Number((row.metrics as any)?.durationMs);
      if (Number.isFinite(duration) && duration >= 0) latencies.push(duration);

      const phashDistance = Number((row.scores as any)?.phashDistance);
      if (Number.isFinite(phashDistance) && phashDistance >= 0) phashDistances.push(phashDistance);

      const inliers = Number((row.scores as any)?.inliers);
      if (Number.isFinite(inliers) && inliers >= 0) orbInliers.push(inliers);

      const inlierRatio = Number((row.scores as any)?.inlierRatio);
      if (Number.isFinite(inlierRatio) && inlierRatio >= 0) orbRatios.push(inlierRatio);
    }

    latencies.sort((a, b) => a - b);
    const percentile = (values: number[], p: number) => {
      if (!values.length) return null;
      const idx = Math.min(values.length - 1, Math.floor((values.length - 1) * p));
      return values[idx];
    };
    const avg = (values: number[]) =>
      values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;

    return {
      windowHours,
      sampleLimit,
      sampledRows: rows.length,
      inWindowRows: inWindow.length,
      byDecision,
      byReason,
      orbErrorCount,
      latencyMs: {
        p50: percentile(latencies, 0.5),
        p95: percentile(latencies, 0.95),
        avg: avg(latencies),
      },
      phashDistance: {
        avg: avg(phashDistances),
        min: phashDistances.length ? phashDistances[0] : null,
        max: phashDistances.length ? phashDistances[phashDistances.length - 1] : null,
      },
      orb: {
        avgInliers: avg(orbInliers),
        avgInlierRatio: avg(orbRatios),
      },
    };
  },
});
