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
  uploaderAuthUserId: string;
  uploadHash?: string;
  title?: string;
  description?: string;
  status: string;
  originalUrl?: string;
  originalStorageId?: string;
  variantUrls?: unknown;
  createdAt: number;
  updatedAt: number;
  publishedAt?: number;
};

export type ConvexImageComment = {
  commentId: string;
  imageId: string;
  userAuthUserId: string;
  userAlias: string;
  body: string;
  createdAt: number;
};
