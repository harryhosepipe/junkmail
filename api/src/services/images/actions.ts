import { PutObjectCommand } from "@aws-sdk/client-s3";
import { createHash, randomUUID } from "crypto";
import { imageQueue } from "../../queue/index.js";
import { originalKey } from "../../storage/paths.js";
import { publicObjectUrl, s3Client, storageBucket } from "../../storage/client.js";
import {
  extractStorageObjectKey,
  normalizePublicAssetData,
  normalizePublicAssetUrl,
} from "../../storage/publicUrls.js";
import {
  mutateConvexCreateImageComment,
  mutateConvexSetImageStatus,
  mutateConvexUpsertImageContent,
  queryConvexImageById,
  queryConvexImageByUploadHash,
  queryConvexImageComments,
  queryConvexRatingsByImageIds,
} from "../../convex/client.js";
import { resolveAuthUserProfileById } from "../../auth/userProfile.js";

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png"] as const;

export const validateUpload = (upload: unknown) => {
  if (!upload || typeof upload !== "object" || typeof (upload as any).arrayBuffer !== "function") {
    return { ok: false as const, status: 400, message: "File is required" };
  }

  const size = (upload as { size?: number }).size ?? 0;
  const type = (upload as { type?: string }).type ?? "";

  if (!ACCEPTED_TYPES.includes(type as (typeof ACCEPTED_TYPES)[number])) {
    return { ok: false as const, status: 415, message: "Only JPG and PNG are supported" };
  }

  if (size > MAX_UPLOAD_BYTES) {
    return { ok: false as const, status: 413, message: "File exceeds max size" };
  }

  return {
    ok: true as const,
    size,
    type,
    ext: type === "image/png" ? ("png" as const) : ("jpg" as const),
    upload: upload as { arrayBuffer: () => Promise<ArrayBuffer> },
  };
};

export const createImageUpload = async (args: {
  authUser: { id: string; email?: string; alias?: string };
  title?: string;
  description?: string;
  upload: { arrayBuffer: () => Promise<ArrayBuffer> };
  type: string;
  ext: "jpg" | "png";
}) => {
  const { authUser, title, description, upload, type, ext } = args;
  const data = Buffer.from(await upload.arrayBuffer());
  const uploadHash = createHash("sha256").update(data).digest("hex");

  const existing = await queryConvexImageByUploadHash(uploadHash);
  if (existing) {
    return {
      id: existing.imageId,
      status: existing.status,
      originalUrl: normalizePublicAssetUrl(existing.originalUrl || ""),
      duplicate: true as const,
    };
  }

  const imageId = randomUUID();
  const key = originalKey(imageId, ext);

  await s3Client.send(
    new PutObjectCommand({
      Bucket: storageBucket,
      Key: key,
      Body: data,
      ContentType: type,
    }),
  );

  const originalUrl = publicObjectUrl(key);

  console.info("[upload]", {
    imageId,
    uploaderId: authUser.id,
    uploaderEmail: authUser.email,
    uploaderAlias: authUser.alias,
  });

  await mutateConvexUpsertImageContent({
    imageId,
    uploaderAuthUserId: authUser.id,
    uploadHash,
    title: title?.length ? title : undefined,
    description: description?.length ? description : undefined,
    status: "processing",
    originalUrl,
    variantUrls: {},
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  await imageQueue.add(
    "process",
    {
      imageId,
      key,
      ext,
      contentType: type,
    },
    {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 5000,
      },
    },
  );

  return {
    id: imageId,
    status: "processing",
    originalUrl: normalizePublicAssetUrl(originalUrl),
    duplicate: false as const,
  };
};

export const loadImageDetail = async (imageId: string) => {
  const row = await queryConvexImageById(imageId);
  if (!row) return null;

  const [ratingRows, uploader, commentRows] = await Promise.all([
    queryConvexRatingsByImageIds([row.imageId]),
    resolveAuthUserProfileById(row.uploaderAuthUserId),
    queryConvexImageComments({ imageId: row.imageId, limit: 100 }),
  ]);
  const rating = ratingRows[0];

  return {
    id: row.imageId,
    status: row.status,
    title: row.title ?? null,
    description: row.description ?? null,
    originalUrl: normalizePublicAssetUrl(row.originalUrl || ""),
    variantUrls: normalizePublicAssetData(row.variantUrls),
    createdAt: new Date(row.createdAt),
    uploaderEmail: uploader?.email ?? null,
    uploaderAlias: uploader?.alias ?? null,
    score: rating?.score ?? 0,
    votes: rating?.comparisonsCount ?? 0,
    comments: commentRows.map((comment) => ({
      id: comment.commentId,
      body: comment.body,
      createdAt: new Date(comment.createdAt),
      userId: comment.userAuthUserId,
      userAlias: comment.userAlias,
    })),
  };
};

export const createComment = async (args: {
  imageId: string;
  user: { id: string; alias: string };
  text: string;
}) => {
  const { imageId, user, text } = args;
  const imageRow = await queryConvexImageById(imageId);
  if (!imageRow) {
    return null;
  }

  const commentId = randomUUID();
  const createdAt = Date.now();
  await mutateConvexCreateImageComment({
    commentId,
    imageId,
    userAuthUserId: user.id,
    userAlias: user.alias,
    body: text,
    createdAt,
  });

  return {
    id: commentId,
    body: text,
    createdAt: new Date(createdAt),
    userId: user.id,
    userAlias: user.alias,
  };
};

export const reprocessImage = async (imageId: string) => {
  const convexImage = await queryConvexImageById(imageId);
  const originalUrl = convexImage?.originalUrl;
  if (!originalUrl) {
    return { ok: false as const, status: 404, message: "Image not found" };
  }

  const key = extractStorageObjectKey(originalUrl);
  if (!key) {
    return { ok: false as const, status: 422, message: "Image storage key unavailable" };
  }

  const ext = key.endsWith(".png") ? "png" : "jpg";
  const contentType = ext === "png" ? "image/png" : "image/jpeg";

  await mutateConvexSetImageStatus({
    imageId,
    status: "processing",
    updatedAt: Date.now(),
    publishedAt: undefined,
  });

  await imageQueue.add(
    "process",
    {
      imageId,
      key,
      ext,
      contentType,
    },
    {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 5000,
      },
    },
  );

  return { ok: true as const };
};
