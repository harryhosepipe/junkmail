export type ConvexRating = {
  imageId: string;
  score: number;
  uncertainty: number;
  comparisonsCount: number;
  updatedAt: number;
};

export type ConvexUserProfile = {
  authUserId: string;
  email: string;
  alias: string;
  role: string;
  inviteToken?: string;
  telegramUserId?: number;
  telegramUsername?: string;
  createdAt: number;
  updatedAt: number;
};

export type ConvexImageContent = {
  imageId: string;
  uploadId?: string;
  uploaderAuthUserId: string;
  uploadHash?: string;
  perceptualHashAnchor?: string;
  perceptualHashes?: unknown;
  title?: string;
  description?: string;
  status: string;
  originalUrl?: string;
  originalStorageId?: string;
  storageKeyOriginal?: string;
  storageKeyCanonical?: string;
  mime?: string;
  width?: number;
  height?: number;
  rejectReason?: string;
  matchedImageId?: string;
  dedupeScores?: unknown;
  category?: string;
  variantUrls?: unknown;
  createdAt: number;
  updatedAt: number;
  publishedAt?: number;
};

export type ConvexImageFingerprint = {
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
  createdAt: number;
};

export type ConvexImageComment = {
  commentId: string;
  imageId: string;
  userAuthUserId: string;
  userAlias: string;
  body: string;
  createdAt: number;
};
