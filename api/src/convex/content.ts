import { runConvexMutation, runConvexQuery } from "./calls.js";
import { mutationRef, queryRef } from "./refs.js";
import type { ConvexImageComment, ConvexImageContent, ConvexImageFingerprint } from "./types.js";

const recentPublicImagesRef = queryRef<{ limit?: number }, ConvexImageContent[]>(
  "content:listRecentPublicImages",
);
const recentImagesRef = queryRef<{ limit?: number }, ConvexImageContent[]>(
  "content:listRecentImages",
);
const publicImagesRef = queryRef<{ limit?: number }, ConvexImageContent[]>(
  "content:listPublicImages",
);
const publicImagesByIdsRef = queryRef<{ imageIds: string[] }, ConvexImageContent[]>(
  "content:listPublicImagesByIds",
);
const imageByIdRef = queryRef<{ imageId: string }, ConvexImageContent | null>(
  "content:getImageById",
);
const imageByUploadHashRef = queryRef<{ uploadHash: string }, ConvexImageContent | null>(
  "content:getImageByUploadHash",
);
const imageByUploadIdRef = queryRef<{ uploadId: string }, ConvexImageContent | null>(
  "content:getImageByUploadId",
);
const imagesByPerceptualHashAnchorRef = queryRef<
  { anchor: string; limit?: number },
  ConvexImageContent[]
>("content:listImagesByPerceptualHashAnchor");
const imageCommentsRef = queryRef<{ imageId: string; limit?: number }, ConvexImageComment[]>(
  "content:listImageComments",
);
const uploaderImageCountRef = queryRef<{ uploaderAuthUserId: string }, { count: number }>(
  "content:countUploaderImages",
);
const createImageCommentRef = mutationRef<
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
const recordImageUploadProcessingRef = mutationRef<
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
    originalUrl?: string;
    originalStorageId?: string;
    variantUrls?: unknown;
    createdAt?: number;
    updatedAt?: number;
    publishedAt?: number;
  },
  { ok: boolean }
>("content:recordImageUploadProcessing");
const markImageProcessingRequestedRef = mutationRef<
  { imageId: string; status: string; updatedAt?: number; publishedAt?: number },
  { ok: boolean }
>("content:markImageProcessingRequested");
const markImageProcessingCompleteRef = mutationRef<
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
>("content:markImageProcessingComplete");
const deleteImageGraphRef = mutationRef<
  { imageId: string },
  {
    ok: boolean;
    deleted: boolean;
    deletedCounts?: Record<string, number>;
  }
>("content:deleteImageGraph");
const recordImagePerceptualHashesRef = mutationRef<
  {
    imageId: string;
    perceptualHashAnchor?: string;
    perceptualHashes?: unknown;
    updatedAt?: number;
  },
  { ok: boolean }
>("content:recordImagePerceptualHashes");
const recordImageUploadReceivedRef = mutationRef<
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
>("content:recordImageUploadReceived");
const markImageRejectedRef = mutationRef<
  {
    imageId: string;
    reason: string;
    matchedImageId?: string;
    scores?: unknown;
    updatedAt?: number;
  },
  { ok: boolean }
>("content:markImageRejected");
const markImageAcceptedRef = mutationRef<
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
const fingerprintByShaRef = queryRef<{ sha256Pixels: string }, ConvexImageFingerprint | null>(
  "content:getImageFingerprintBySha256",
);
const fingerprintsByPrefixRef = queryRef<
  { phashPrefix: string; limit?: number },
  ConvexImageFingerprint[]
>("content:listImageFingerprintsByPhashPrefix");
const recentFingerprintsRef = queryRef<{ limit?: number }, ConvexImageFingerprint[]>(
  "content:listRecentImageFingerprints",
);
const recordImageFingerprintRef = mutationRef<
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
>("content:recordImageFingerprint");
const createDedupeEventRef = mutationRef<
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
const recentDedupeEventsRef = queryRef<{ limit?: number }, Array<Record<string, unknown>>>(
  "content:listRecentDedupeEvents",
);
const dedupeStatsRef = queryRef<
  { windowHours?: number; sampleLimit?: number },
  Record<string, unknown>
>("content:getDedupeStats");

export const queryConvexRecentPublicImages = async (limit?: number) => {
  return runConvexQuery((client) => client.query(recentPublicImagesRef, { limit }));
};

export const queryConvexRecentImages = async (limit?: number) => {
  return runConvexQuery((client) => client.query(recentImagesRef, { limit }));
};

export const queryConvexPublicImages = async (limit?: number) => {
  return runConvexQuery((client) => client.query(publicImagesRef, { limit }));
};

export const queryConvexPublicImagesByIds = async (imageIds: string[]) => {
  if (!imageIds.length) return [] as ConvexImageContent[];
  return runConvexQuery((client) => client.query(publicImagesByIdsRef, { imageIds }));
};

export const queryConvexImageById = async (imageId: string) => {
  return runConvexQuery((client) => client.query(imageByIdRef, { imageId }));
};

export const queryConvexImageByUploadHash = async (uploadHash: string) => {
  return runConvexQuery((client) => client.query(imageByUploadHashRef, { uploadHash }));
};

export const queryConvexImageByUploadId = async (uploadId: string) => {
  return runConvexQuery((client) => client.query(imageByUploadIdRef, { uploadId }));
};

export const queryConvexImagesByPerceptualHashAnchor = async (anchor: string, limit?: number) => {
  return runConvexQuery((client) =>
    client.query(imagesByPerceptualHashAnchorRef, { anchor, limit }),
  );
};

export const queryConvexImageComments = async (args: { imageId: string; limit?: number }) => {
  return runConvexQuery((client) => client.query(imageCommentsRef, args));
};

export const queryConvexUploaderImageCount = async (uploaderAuthUserId: string) => {
  return runConvexQuery((client) => client.query(uploaderImageCountRef, { uploaderAuthUserId }));
};

export const mutateConvexCreateImageComment = async (args: {
  commentId: string;
  imageId: string;
  userAuthUserId: string;
  userAlias: string;
  body: string;
  createdAt?: number;
}) => {
  return runConvexMutation((client) => client.mutation(createImageCommentRef, args));
};

export const mutateConvexRecordImageUploadProcessing = async (args: {
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
  originalUrl?: string;
  originalStorageId?: string;
  variantUrls?: unknown;
  createdAt?: number;
  updatedAt?: number;
  publishedAt?: number;
}) => {
  return runConvexMutation((client) => client.mutation(recordImageUploadProcessingRef, args));
};

export const mutateConvexMarkImageProcessingRequested = async (args: {
  imageId: string;
  status: string;
  updatedAt?: number;
  publishedAt?: number;
}) => {
  return runConvexMutation((client) => client.mutation(markImageProcessingRequestedRef, args));
};

export const mutateConvexMarkImageProcessingComplete = async (args: {
  imageId: string;
  status: string;
  variantUrls?: unknown;
  storageKeyCanonical?: string;
  width?: number;
  height?: number;
  updatedAt?: number;
  publishedAt?: number;
}) => {
  return runConvexMutation((client) => client.mutation(markImageProcessingCompleteRef, args));
};

export const mutateConvexDeleteImageGraph = async (args: { imageId: string }) => {
  return runConvexMutation((client) => client.mutation(deleteImageGraphRef, args));
};

export const mutateConvexRecordImagePerceptualHashes = async (args: {
  imageId: string;
  perceptualHashAnchor?: string;
  perceptualHashes?: unknown;
  updatedAt?: number;
}) => {
  return runConvexMutation((client) => client.mutation(recordImagePerceptualHashesRef, args));
};

export const mutateConvexRecordImageUploadReceived = async (args: {
  imageId: string;
  uploadId: string;
  uploaderAuthUserId: string;
  description?: string;
  mime?: string;
  createdAt?: number;
  updatedAt?: number;
}) => {
  return runConvexMutation((client) => client.mutation(recordImageUploadReceivedRef, args));
};

export const mutateConvexMarkImageRejected = async (args: {
  imageId: string;
  reason: string;
  matchedImageId?: string;
  scores?: unknown;
  updatedAt?: number;
}) => {
  return runConvexMutation((client) => client.mutation(markImageRejectedRef, args));
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
  return runConvexMutation((client) => client.mutation(markImageAcceptedRef, args));
};

export const queryConvexImageFingerprintBySha256 = async (sha256Pixels: string) => {
  return runConvexQuery((client) => client.query(fingerprintByShaRef, { sha256Pixels }));
};

export const queryConvexImageFingerprintsByPhashPrefix = async (
  phashPrefix: string,
  limit?: number,
) => {
  return runConvexQuery((client) => client.query(fingerprintsByPrefixRef, { phashPrefix, limit }));
};

export const queryConvexRecentImageFingerprints = async (limit?: number) => {
  return runConvexQuery((client) => client.query(recentFingerprintsRef, { limit }));
};

export const mutateConvexRecordImageFingerprint = async (args: {
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
  return runConvexMutation((client) => client.mutation(recordImageFingerprintRef, args));
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
  return runConvexMutation((client) => client.mutation(createDedupeEventRef, args));
};

export const queryConvexRecentDedupeEvents = async (limit?: number) => {
  return runConvexQuery((client) => client.query(recentDedupeEventsRef, { limit }));
};

export const queryConvexDedupeStats = async (args?: {
  windowHours?: number;
  sampleLimit?: number;
}) => {
  return runConvexQuery((client) => client.query(dedupeStatsRef, args || {}));
};
