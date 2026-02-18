import { makeFunctionReference } from "convex/server";
import { createConvexClient } from "./core.js";
import type { ConvexImageComment, ConvexImageContent, ConvexImageFingerprint } from "./types.js";

const recentPublicImagesRef = makeFunctionReference<
  "query",
  { limit?: number },
  ConvexImageContent[]
>("content:listRecentPublicImages");
const recentImagesRef = makeFunctionReference<"query", { limit?: number }, ConvexImageContent[]>(
  "content:listRecentImages",
);
const publicImagesRef = makeFunctionReference<"query", { limit?: number }, ConvexImageContent[]>(
  "content:listPublicImages",
);
const publicImagesByIdsRef = makeFunctionReference<
  "query",
  { imageIds: string[] },
  ConvexImageContent[]
>("content:listPublicImagesByIds");
const imageByIdRef = makeFunctionReference<"query", { imageId: string }, ConvexImageContent | null>(
  "content:getImageById",
);
const imageByUploadHashRef = makeFunctionReference<
  "query",
  { uploadHash: string },
  ConvexImageContent | null
>("content:getImageByUploadHash");
const imageByUploadIdRef = makeFunctionReference<
  "query",
  { uploadId: string },
  ConvexImageContent | null
>("content:getImageByUploadId");
const imagesByPerceptualHashAnchorRef = makeFunctionReference<
  "query",
  { anchor: string; limit?: number },
  ConvexImageContent[]
>("content:listImagesByPerceptualHashAnchor");
const imageCommentsRef = makeFunctionReference<
  "query",
  { imageId: string; limit?: number },
  ConvexImageComment[]
>("content:listImageComments");
const uploaderImageCountRef = makeFunctionReference<
  "query",
  { uploaderAuthUserId: string },
  { count: number }
>("content:countUploaderImages");
const createImageCommentRef = makeFunctionReference<
  "mutation",
  {
    commentId: string;
    imageId: string;
    userAuthUserId: string;
    userAlias: string;
    body: string;
    createdAt?: number;
  },
  { ok: boolean }
>("content:createImageComment");
const upsertImageRef = makeFunctionReference<
  "mutation",
  {
    imageId: string;
    uploadId?: string;
    uploaderAuthUserId: string;
    uploadHash?: string;
    perceptualHashAnchor?: string;
    perceptualHashes?: unknown;
    title?: string;
    description?: string;
    status: string;
    storageKeyOriginal?: string;
    storageKeyCanonical?: string;
    mime?: string;
    width?: number;
    height?: number;
    rejectReason?: string;
    matchedImageId?: string;
    dedupeScores?: unknown;
    category?: string;
    classificationStatus?: string;
    classificationError?: string;
    classificationModel?: string;
    classifiedAt?: number;
    originalUrl?: string;
    originalStorageId?: string;
    variantUrls?: unknown;
    createdAt?: number;
    updatedAt?: number;
    publishedAt?: number;
  },
  { ok: boolean }
>("content:upsertImage");
const setImageStatusRef = makeFunctionReference<
  "mutation",
  { imageId: string; status: string; updatedAt?: number; publishedAt?: number },
  { ok: boolean }
>("content:setImageStatus");
const setImageProcessingResultRef = makeFunctionReference<
  "mutation",
  {
    imageId: string;
    status: string;
    variantUrls?: unknown;
    storageKeyCanonical?: string;
    width?: number;
    height?: number;
    updatedAt?: number;
    publishedAt?: number;
  },
  { ok: boolean }
>("content:setImageProcessingResult");
const deleteImageGraphRef = makeFunctionReference<
  "mutation",
  { imageId: string },
  {
    ok: boolean;
    deleted: boolean;
    deletedCounts?: Record<string, number>;
  }
>("content:deleteImageGraph");
const setImagePerceptualHashesRef = makeFunctionReference<
  "mutation",
  {
    imageId: string;
    perceptualHashAnchor?: string;
    perceptualHashes?: unknown;
    updatedAt?: number;
  },
  { ok: boolean }
>("content:setImagePerceptualHashes");
const createPendingImageRef = makeFunctionReference<
  "mutation",
  {
    imageId: string;
    uploadId: string;
    uploaderAuthUserId: string;
    description?: string;
    mime?: string;
    createdAt?: number;
    updatedAt?: number;
  },
  { ok: boolean; imageId: string; deduped: boolean }
>("content:createPendingImage");
const markImageRejectedRef = makeFunctionReference<
  "mutation",
  {
    imageId: string;
    reason: string;
    matchedImageId?: string;
    scores?: unknown;
    updatedAt?: number;
  },
  { ok: boolean }
>("content:markImageRejected");
const markImageAcceptedRef = makeFunctionReference<
  "mutation",
  {
    imageId: string;
    status?: string;
    storageKeyCanonical?: string;
    width?: number;
    height?: number;
    variantUrls?: unknown;
    updatedAt?: number;
    publishedAt?: number;
  },
  { ok: boolean }
>("content:markImageAccepted");
const setImageClassificationPendingRef = makeFunctionReference<
  "mutation",
  {
    imageId: string;
    model?: string;
    updatedAt?: number;
  },
  { ok: boolean }
>("content:setImageClassificationPending");
const setImageClassificationResultRef = makeFunctionReference<
  "mutation",
  {
    imageId: string;
    title: string;
    category: string;
    description?: string;
    model?: string;
    classifiedAt?: number;
    updatedAt?: number;
  },
  { ok: boolean }
>("content:setImageClassificationResult");
const setImageClassificationFailedRef = makeFunctionReference<
  "mutation",
  {
    imageId: string;
    error: string;
    model?: string;
    updatedAt?: number;
  },
  { ok: boolean }
>("content:setImageClassificationFailed");
const fingerprintByShaRef = makeFunctionReference<
  "query",
  { sha256Pixels: string },
  ConvexImageFingerprint | null
>("content:getImageFingerprintBySha256");
const fingerprintsByPrefixRef = makeFunctionReference<
  "query",
  { phashPrefix: string; limit?: number },
  ConvexImageFingerprint[]
>("content:listImageFingerprintsByPhashPrefix");
const recentFingerprintsRef = makeFunctionReference<
  "query",
  { limit?: number },
  ConvexImageFingerprint[]
>("content:listRecentImageFingerprints");
const upsertImageFingerprintRef = makeFunctionReference<
  "mutation",
  {
    imageId: string;
    sha256Pixels: string;
    phash64: string;
    phashPrefix: string;
    dhash64?: string;
    canonicalWidth?: number;
    canonicalHeight?: number;
    cropBox?: unknown;
    cropMeta?: unknown;
    workerVersion?: string;
    createdAt?: number;
  },
  { ok: boolean }
>("content:upsertImageFingerprint");
const createDedupeEventRef = makeFunctionReference<
  "mutation",
  {
    uploadImageId: string;
    decision: string;
    reason: string;
    matchedImageId?: string;
    scores?: unknown;
    metrics?: unknown;
    workerVersion?: string;
    createdAt?: number;
  },
  { ok: boolean }
>("content:createDedupeEvent");
const recentDedupeEventsRef = makeFunctionReference<
  "query",
  { limit?: number },
  Array<Record<string, unknown>>
>("content:listRecentDedupeEvents");
const dedupeStatsRef = makeFunctionReference<
  "query",
  { windowHours?: number; sampleLimit?: number },
  Record<string, unknown>
>("content:getDedupeStats");

export const queryConvexRecentPublicImages = async (limit?: number) => {
  const { client } = createConvexClient();
  return client.query(recentPublicImagesRef, { limit });
};

export const queryConvexRecentImages = async (limit?: number) => {
  const { client } = createConvexClient();
  return client.query(recentImagesRef, { limit });
};

export const queryConvexPublicImages = async (limit?: number) => {
  const { client } = createConvexClient();
  return client.query(publicImagesRef, { limit });
};

export const queryConvexPublicImagesByIds = async (imageIds: string[]) => {
  if (!imageIds.length) return [] as ConvexImageContent[];
  const { client } = createConvexClient();
  return client.query(publicImagesByIdsRef, { imageIds });
};

export const queryConvexImageById = async (imageId: string) => {
  const { client } = createConvexClient();
  return client.query(imageByIdRef, { imageId });
};

export const queryConvexImageByUploadHash = async (uploadHash: string) => {
  const { client } = createConvexClient();
  return client.query(imageByUploadHashRef, { uploadHash });
};

export const queryConvexImageByUploadId = async (uploadId: string) => {
  const { client } = createConvexClient();
  return client.query(imageByUploadIdRef, { uploadId });
};

export const queryConvexImagesByPerceptualHashAnchor = async (anchor: string, limit?: number) => {
  const { client } = createConvexClient();
  return client.query(imagesByPerceptualHashAnchorRef, { anchor, limit });
};

export const queryConvexImageComments = async (args: { imageId: string; limit?: number }) => {
  const { client } = createConvexClient();
  return client.query(imageCommentsRef, args);
};

export const queryConvexUploaderImageCount = async (uploaderAuthUserId: string) => {
  const { client } = createConvexClient();
  return client.query(uploaderImageCountRef, { uploaderAuthUserId });
};

export const mutateConvexCreateImageComment = async (args: {
  commentId: string;
  imageId: string;
  userAuthUserId: string;
  userAlias: string;
  body: string;
  createdAt?: number;
}) => {
  const { client } = createConvexClient();
  return client.mutation(createImageCommentRef, args);
};

export const mutateConvexUpsertImageContent = async (args: {
  imageId: string;
  uploadId?: string;
  uploaderAuthUserId: string;
  uploadHash?: string;
  perceptualHashAnchor?: string;
  perceptualHashes?: unknown;
  title?: string;
  description?: string;
  status: string;
  storageKeyOriginal?: string;
  storageKeyCanonical?: string;
  mime?: string;
  width?: number;
  height?: number;
  rejectReason?: string;
  matchedImageId?: string;
  dedupeScores?: unknown;
  category?: string;
  classificationStatus?: string;
  classificationError?: string;
  classificationModel?: string;
  classifiedAt?: number;
  originalUrl?: string;
  originalStorageId?: string;
  variantUrls?: unknown;
  createdAt?: number;
  updatedAt?: number;
  publishedAt?: number;
}) => {
  const { client } = createConvexClient();
  return client.mutation(upsertImageRef, args);
};

export const mutateConvexSetImageStatus = async (args: {
  imageId: string;
  status: string;
  updatedAt?: number;
  publishedAt?: number;
}) => {
  const { client } = createConvexClient();
  return client.mutation(setImageStatusRef, args);
};

export const mutateConvexSetImageProcessingResult = async (args: {
  imageId: string;
  status: string;
  variantUrls?: unknown;
  storageKeyCanonical?: string;
  width?: number;
  height?: number;
  updatedAt?: number;
  publishedAt?: number;
}) => {
  const { client } = createConvexClient();
  return client.mutation(setImageProcessingResultRef, args);
};

export const mutateConvexDeleteImageGraph = async (args: { imageId: string }) => {
  const { client } = createConvexClient();
  return client.mutation(deleteImageGraphRef, args);
};

export const mutateConvexSetImagePerceptualHashes = async (args: {
  imageId: string;
  perceptualHashAnchor?: string;
  perceptualHashes?: unknown;
  updatedAt?: number;
}) => {
  const { client } = createConvexClient();
  return client.mutation(setImagePerceptualHashesRef, args);
};

export const mutateConvexCreatePendingImage = async (args: {
  imageId: string;
  uploadId: string;
  uploaderAuthUserId: string;
  description?: string;
  mime?: string;
  createdAt?: number;
  updatedAt?: number;
}) => {
  const { client } = createConvexClient();
  return client.mutation(createPendingImageRef, args);
};

export const mutateConvexMarkImageRejected = async (args: {
  imageId: string;
  reason: string;
  matchedImageId?: string;
  scores?: unknown;
  updatedAt?: number;
}) => {
  const { client } = createConvexClient();
  return client.mutation(markImageRejectedRef, args);
};

export const mutateConvexMarkImageAccepted = async (args: {
  imageId: string;
  status?: string;
  storageKeyCanonical?: string;
  width?: number;
  height?: number;
  variantUrls?: unknown;
  updatedAt?: number;
  publishedAt?: number;
}) => {
  const { client } = createConvexClient();
  return client.mutation(markImageAcceptedRef, args);
};

export const mutateConvexSetImageClassificationPending = async (args: {
  imageId: string;
  model?: string;
  updatedAt?: number;
}) => {
  const { client } = createConvexClient();
  return client.mutation(setImageClassificationPendingRef, args);
};

export const mutateConvexSetImageClassificationResult = async (args: {
  imageId: string;
  title: string;
  category: string;
  description?: string;
  model?: string;
  classifiedAt?: number;
  updatedAt?: number;
}) => {
  const { client } = createConvexClient();
  return client.mutation(setImageClassificationResultRef, args);
};

export const mutateConvexSetImageClassificationFailed = async (args: {
  imageId: string;
  error: string;
  model?: string;
  updatedAt?: number;
}) => {
  const { client } = createConvexClient();
  return client.mutation(setImageClassificationFailedRef, args);
};

export const queryConvexImageFingerprintBySha256 = async (sha256Pixels: string) => {
  const { client } = createConvexClient();
  return client.query(fingerprintByShaRef, { sha256Pixels });
};

export const queryConvexImageFingerprintsByPhashPrefix = async (
  phashPrefix: string,
  limit?: number,
) => {
  const { client } = createConvexClient();
  return client.query(fingerprintsByPrefixRef, { phashPrefix, limit });
};

export const queryConvexRecentImageFingerprints = async (limit?: number) => {
  const { client } = createConvexClient();
  return client.query(recentFingerprintsRef, { limit });
};

export const mutateConvexUpsertImageFingerprint = async (args: {
  imageId: string;
  sha256Pixels: string;
  phash64: string;
  phashPrefix: string;
  dhash64?: string;
  canonicalWidth?: number;
  canonicalHeight?: number;
  cropBox?: unknown;
  cropMeta?: unknown;
  workerVersion?: string;
  createdAt?: number;
}) => {
  const { client } = createConvexClient();
  return client.mutation(upsertImageFingerprintRef, args);
};

export const mutateConvexCreateDedupeEvent = async (args: {
  uploadImageId: string;
  decision: string;
  reason: string;
  matchedImageId?: string;
  scores?: unknown;
  metrics?: unknown;
  workerVersion?: string;
  createdAt?: number;
}) => {
  const { client } = createConvexClient();
  return client.mutation(createDedupeEventRef, args);
};

export const queryConvexRecentDedupeEvents = async (limit?: number) => {
  const { client } = createConvexClient();
  return client.query(recentDedupeEventsRef, { limit });
};

export const queryConvexDedupeStats = async (args?: {
  windowHours?: number;
  sampleLimit?: number;
}) => {
  const { client } = createConvexClient();
  return client.query(dedupeStatsRef, args || {});
};
