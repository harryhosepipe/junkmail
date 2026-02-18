import { makeFunctionReference } from "convex/server";
import { createConvexClient } from "./core.js";
import type { ConvexImageComment, ConvexImageContent } from "./types.js";

const recentPublicImagesRef = makeFunctionReference<
  "query",
  { limit?: number },
  ConvexImageContent[]
>("content:listRecentPublicImages");
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
    uploaderAuthUserId: string;
    uploadHash?: string;
    title?: string;
    description?: string;
    status: string;
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
    updatedAt?: number;
    publishedAt?: number;
  },
  { ok: boolean }
>("content:setImageProcessingResult");

export const queryConvexRecentPublicImages = async (limit?: number) => {
  const { client } = createConvexClient();
  return client.query(recentPublicImagesRef, { limit });
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
  uploaderAuthUserId: string;
  uploadHash?: string;
  title?: string;
  description?: string;
  status: string;
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
  updatedAt?: number;
  publishedAt?: number;
}) => {
  const { client } = createConvexClient();
  return client.mutation(setImageProcessingResultRef, args);
};
