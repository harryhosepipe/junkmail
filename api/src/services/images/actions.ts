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
  mutateConvexDeleteImageGraph,
  mutateConvexSetImageStatus,
  mutateConvexUpsertImageContent,
  queryConvexImageById,
  queryConvexRecentImages,
  queryConvexImagesByPerceptualHashAnchor,
  queryConvexImageByUploadHash,
  queryConvexImageComments,
  queryConvexRatingsByImageIds,
} from "../../convex/client.js";
import { resolveAuthUserProfileById } from "../../auth/userProfile.js";
import {
  computeImageFingerprint,
  isNearDuplicate,
  similarityAnchor,
  type ImageFingerprint,
} from "./perceptualHash.js";

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png"] as const;
const PHASH_ANCHOR_LENGTH = 2;
const RECENT_DUPLICATE_CANDIDATE_LIMIT = 400;

const buildDuplicatePayload = async (args: {
  existing: {
    imageId: string;
    status: string;
    originalUrl?: string;
    createdAt?: number;
    uploaderAuthUserId: string;
    title?: string;
    description?: string;
  };
  duplicateType: "exact" | "near";
}) => {
  const { existing, duplicateType } = args;
  const uploader = await resolveAuthUserProfileById(existing.uploaderAuthUserId);
  const uploadedAtIso = new Date(existing.createdAt ?? Date.now()).toISOString();
  const uploaderName = uploader?.alias || "unknown";
  const message =
    duplicateType === "near"
      ? `sorry this junk was uploaded at this "${uploadedAtIso}" by "${uploaderName}" suck on it!`
      : "This image was already uploaded.";

  return {
    id: existing.imageId,
    status: existing.status,
    originalUrl: normalizePublicAssetUrl(existing.originalUrl || ""),
    duplicate: true as const,
    duplicateType,
    httpStatus: duplicateType === "near" ? 409 : 200,
    error: { message },
    existing: {
      id: existing.imageId,
      status: existing.status,
      originalUrl: normalizePublicAssetUrl(existing.originalUrl || ""),
      title: existing.title ?? null,
      createdAt: uploadedAtIso,
      uploaderAlias: uploader?.alias ?? null,
    },
  };
};

const findNearDuplicate = (incoming: ImageFingerprint, candidates: Array<Record<string, any>>) => {
  for (const candidate of candidates) {
    if (
      isNearDuplicate({
        incoming,
        existing: candidate.perceptualHashes as Partial<ImageFingerprint> | undefined,
      })
    ) {
      return candidate;
    }
  }
  return null;
};

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
  description?: string;
  upload: { arrayBuffer: () => Promise<ArrayBuffer> };
  type: string;
  ext: "jpg" | "png";
}) => {
  const { authUser, description, upload, type, ext } = args;
  const data = Buffer.from(await upload.arrayBuffer());
  const uploadHash = createHash("sha256").update(data).digest("hex");

  const existing = await queryConvexImageByUploadHash(uploadHash);
  if (existing) {
    return buildDuplicatePayload({ existing, duplicateType: "exact" });
  }
  const fingerprint = await computeImageFingerprint(data);
  const anchor = similarityAnchor(fingerprint, PHASH_ANCHOR_LENGTH);
  const candidates = await queryConvexImagesByPerceptualHashAnchor(anchor, 128);
  const seen = new Set<string>();
  const candidatePool: Array<Record<string, any>> = [];
  for (const candidate of candidates) {
    if (!candidate?.imageId || seen.has(candidate.imageId)) continue;
    seen.add(candidate.imageId);
    candidatePool.push(candidate);
  }

  // Fallback: broaden search to recent images to catch crop variants that miss anchor bucketing.
  const recent = await queryConvexRecentImages(RECENT_DUPLICATE_CANDIDATE_LIMIT);
  for (const candidate of recent) {
    if (!candidate?.imageId || seen.has(candidate.imageId)) continue;
    seen.add(candidate.imageId);
    candidatePool.push(candidate as Record<string, any>);
  }

  const nearDuplicate = findNearDuplicate(fingerprint, candidatePool);
  if (nearDuplicate) {
    return buildDuplicatePayload({ existing: nearDuplicate as any, duplicateType: "near" });
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
    perceptualHashAnchor: anchor,
    perceptualHashes: fingerprint,
    description: description?.length ? description : undefined,
    status: "processing",
    classificationStatus: "pending",
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
    duplicateType: null,
    httpStatus: 201,
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
    category: row.category ?? null,
    classificationStatus: row.classificationStatus ?? null,
    classificationError: row.classificationError ?? null,
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

const collectStorageKeys = (value: unknown, out: Set<string>) => {
  if (!value) return;
  if (typeof value === "string") {
    const key = extractStorageObjectKey(value);
    if (key) out.add(key);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) {
      collectStorageKeys(item, out);
    }
    return;
  }
  if (typeof value === "object") {
    for (const entry of Object.values(value as Record<string, unknown>)) {
      collectStorageKeys(entry, out);
    }
  }
};

export const deleteImage = async (imageId: string) => {
  const image = await queryConvexImageById(imageId);
  if (!image) {
    return { ok: false as const, status: 404 as const, message: "Image not found" };
  }

  const storageKeys = new Set<string>();
  if (image.storageKeyOriginal) storageKeys.add(image.storageKeyOriginal);
  if (image.storageKeyCanonical) storageKeys.add(image.storageKeyCanonical);
  if (image.originalUrl) collectStorageKeys(image.originalUrl, storageKeys);
  if (image.variantUrls) collectStorageKeys(image.variantUrls, storageKeys);

  const result = await mutateConvexDeleteImageGraph({ imageId });
  if (!result?.ok || !result?.deleted) {
    return { ok: false as const, status: 404 as const, message: "Image not found" };
  }

  return {
    ok: true as const,
    imageId,
    storageKeys: [...storageKeys],
    deletedCounts: result.deletedCounts ?? {},
  };
};
