import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { env } from "../env.js";

export const resolveConvexUrl = () =>
  env.CONVEX_URL || env.PUBLIC_CONVEX_URL || env.CONVEX_SELF_HOSTED_URL || "";

export const resolveConvexAdminKey = () =>
  env.CONVEX_ADMIN_KEY || env.CONVEX_SELF_HOSTED_ADMIN_KEY || "";

type ConvexHealth = {
  ok: boolean;
  timestamp: number;
  environment: string;
};

export type ConvexRating = {
  imageId: string;
  score: number;
  uncertainty: number;
  comparisonsCount: number;
  updatedAt: number;
};

type ConvexRatingsResponse = {
  ratings: ConvexRating[];
};

type IssueMatchupTokenArgs = {
  tokenId: string;
  voterHash: string;
  imageAId: string;
  imageBId: string;
  issuedAt: number;
  expiresAt: number;
};

type ValidateAndConsumeMatchupTokenArgs = {
  tokenId: string;
  voterHash: string;
  imageAId: string;
  imageBId: string;
  now?: number;
};

type ValidateAndConsumeMatchupTokenResult = {
  acceptedForScoring: boolean;
  validationStatus: string;
  rejectionReason?: string | null;
};

type CreateVoteEventArgs = {
  voteEventId: string;
  matchupTokenId: string;
  imageAId: string;
  imageBId: string;
  winnerId: string;
  voterHash: string;
  voterAuthUserId?: string;
  ipHash: string;
  createdAt: number;
  validationStatus: string;
  rejectionReason?: string;
};

type CreateVoteEventResult = {
  ok: boolean;
  alreadyExists: boolean;
};

type ProjectVoteEventArgs = {
  voteEventId: string;
  now?: number;
};

type ProjectVoteEventResult = {
  ok: boolean;
  projectionStatus: string;
};

type TopRatingsArgs = {
  limit: number;
  minComparisons: number;
};

type TopRatingItem = {
  imageId: string;
  score: number;
  uncertainty: number;
  comparisonsCount: number;
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

type UpsertUserProfileArgs = {
  authUserId: string;
  email: string;
  alias: string;
  role: string;
  inviteToken?: string;
  telegramUserId?: number;
  telegramUsername?: string;
  createdAt?: number;
  updatedAt?: number;
};

type BackfillUpsertImageRatingArgs = {
  imageId: string;
  score: number;
  uncertainty: number;
  comparisonsCount: number;
  updatedAt: number;
};

type BackfillInsertVoteArgs = {
  imageAId: string;
  imageBId: string;
  winnerId: string;
  voterHash: string;
  ipHash: string;
  createdAt: number;
};

type BackfillUpsertImageArgs = {
  imageId: string;
  uploaderAuthUserId: string;
  title?: string;
  description?: string;
  status: string;
  originalUrl?: string;
  variantUrls?: unknown;
  createdAt: number;
  updatedAt: number;
  publishedAt?: number;
};

type BackfillInsertImageCommentArgs = {
  commentId: string;
  imageId: string;
  userAuthUserId: string;
  userAlias: string;
  body: string;
  createdAt: number;
};

type BackfillCounts = {
  userProfiles: number;
  authTokens: number;
  sessions: number;
  matchupTokens: number;
  imageRatings: number;
  votes: number;
  images: number;
  imageComments: number;
};

type BackfillClearBatchArgs = {
  limit?: number;
};

type BackfillClearBatchResult = {
  deleted: number;
  hasMore: boolean;
};

export type ConvexImageContent = {
  imageId: string;
  uploaderAuthUserId: string;
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

const healthPingRef = makeFunctionReference<"query", Record<string, never>, ConvexHealth>(
  "health:ping",
);
const ratingsByImageIdsRef = makeFunctionReference<
  "query",
  { imageIds: string[] },
  ConvexRatingsResponse
>("voting:getRatingsByImageIds");
const issueMatchupTokenRef = makeFunctionReference<
  "mutation",
  IssueMatchupTokenArgs,
  { ok: boolean }
>("voting:issueMatchupToken");
const validateAndConsumeMatchupTokenRef = makeFunctionReference<
  "mutation",
  ValidateAndConsumeMatchupTokenArgs,
  ValidateAndConsumeMatchupTokenResult
>("voting:validateAndConsumeMatchupToken");
const createVoteEventRef = makeFunctionReference<
  "mutation",
  CreateVoteEventArgs,
  CreateVoteEventResult
>("voting:createVoteEvent");
const projectVoteEventRef = makeFunctionReference<
  "mutation",
  ProjectVoteEventArgs,
  ProjectVoteEventResult
>("voting:projectVoteEvent");
const topRatingsRef = makeFunctionReference<"query", TopRatingsArgs, TopRatingItem[]>(
  "voting:getTopRatings",
);
const voteCountByAuthUserIdRef = makeFunctionReference<
  "query",
  { authUserId: string },
  { count: number }
>("voting:getVoteCountByAuthUserId");
const voteCountForProfileRef = makeFunctionReference<
  "query",
  { authUserId: string; voterHash?: string },
  { count: number }
>("voting:getVoteCountForProfile");
const userProfileByEmailRef = makeFunctionReference<
  "query",
  { emailLower: string },
  ConvexUserProfile | null
>("users:getByEmail");
const userProfileByAuthIdRef = makeFunctionReference<
  "query",
  { authUserId: string },
  ConvexUserProfile | null
>("users:getByAuthUserId");
const userProfileByTelegramIdRef = makeFunctionReference<
  "query",
  { telegramUserId: number },
  ConvexUserProfile | null
>("users:getByTelegramUserId");
const upsertUserProfileRef = makeFunctionReference<
  "mutation",
  UpsertUserProfileArgs,
  { ok: boolean }
>("users:upsertByAuthUserId");
const updateUserAliasRef = makeFunctionReference<
  "mutation",
  { authUserId: string; alias: string; updatedAt?: number },
  { ok: boolean }
>("users:updateAlias");
const upsertTelegramUserRef = makeFunctionReference<
  "mutation",
  {
    telegramUserId: number;
    email: string;
    alias: string;
    role: string;
    telegramUsername?: string;
    inviteToken?: string;
    createdAt?: number;
    updatedAt?: number;
  },
  { authUserId: string }
>("users:upsertTelegramUser");
const backfillClearVotesBatchRef = makeFunctionReference<
  "mutation",
  BackfillClearBatchArgs,
  BackfillClearBatchResult
>("backfill:clearVotesBatch");
const backfillClearImageRatingsBatchRef = makeFunctionReference<
  "mutation",
  BackfillClearBatchArgs,
  BackfillClearBatchResult
>("backfill:clearImageRatingsBatch");
const backfillClearUserProfilesBatchRef = makeFunctionReference<
  "mutation",
  BackfillClearBatchArgs,
  BackfillClearBatchResult
>("backfill:clearUserProfilesBatch");
const backfillClearAuthTokensBatchRef = makeFunctionReference<
  "mutation",
  BackfillClearBatchArgs,
  BackfillClearBatchResult
>("backfill:clearAuthTokensBatch");
const backfillClearSessionsBatchRef = makeFunctionReference<
  "mutation",
  BackfillClearBatchArgs,
  BackfillClearBatchResult
>("backfill:clearSessionsBatch");
const backfillClearMatchupTokensBatchRef = makeFunctionReference<
  "mutation",
  BackfillClearBatchArgs,
  BackfillClearBatchResult
>("backfill:clearMatchupTokensBatch");
const backfillClearImagesBatchRef = makeFunctionReference<
  "mutation",
  BackfillClearBatchArgs,
  BackfillClearBatchResult
>("backfill:clearImagesBatch");
const backfillClearImageCommentsBatchRef = makeFunctionReference<
  "mutation",
  BackfillClearBatchArgs,
  BackfillClearBatchResult
>("backfill:clearImageCommentsBatch");
const backfillUpsertImageRatingRef = makeFunctionReference<
  "mutation",
  BackfillUpsertImageRatingArgs,
  { ok: boolean }
>("backfill:upsertImageRating");
const backfillUpsertImageRef = makeFunctionReference<
  "mutation",
  BackfillUpsertImageArgs,
  { ok: boolean }
>("backfill:upsertImage");
const backfillInsertVoteRef = makeFunctionReference<
  "mutation",
  BackfillInsertVoteArgs,
  { ok: boolean }
>("backfill:insertVote");
const backfillInsertImageCommentRef = makeFunctionReference<
  "mutation",
  BackfillInsertImageCommentArgs,
  { ok: boolean }
>("backfill:insertImageComment");
const backfillGetCountsRef = makeFunctionReference<"query", Record<string, never>, BackfillCounts>(
  "backfill:getCounts",
);
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
const createAuthTokenRef = makeFunctionReference<
  "mutation",
  {
    tokenHash: string;
    userAuthUserId: string;
    expiresAt: number;
    createdAt?: number;
  },
  { ok: boolean }
>("auth:createAuthToken");
const consumeAuthTokenRef = makeFunctionReference<
  "mutation",
  { tokenHash: string; now?: number },
  { userAuthUserId: string } | null
>("auth:consumeAuthToken");
const createSessionRef = makeFunctionReference<
  "mutation",
  { tokenHash: string; userAuthUserId: string; expiresAt: number; createdAt?: number },
  { ok: boolean }
>("auth:createSession");
const deleteSessionByTokenHashRef = makeFunctionReference<
  "mutation",
  { tokenHash: string },
  { ok: boolean }
>("auth:deleteSessionByTokenHash");
const getSessionUserAuthUserIdRef = makeFunctionReference<
  "query",
  { tokenHash: string; now?: number },
  { userAuthUserId: string } | null
>("auth:getSessionUserAuthUserId");

const createConvexClient = () => {
  const url = resolveConvexUrl();
  if (!url) {
    throw new Error(
      "Convex URL is missing. Set CONVEX_URL (or PUBLIC_CONVEX_URL / CONVEX_SELF_HOSTED_URL).",
    );
  }

  const client = new ConvexHttpClient(url);
  const adminKey = resolveConvexAdminKey();
  if (adminKey) {
    // Convex runtime supports setAdminAuth, but this method is currently missing
    // from the published TypeScript type for ConvexHttpClient.
    (client as unknown as { setAdminAuth?: (token: string) => void }).setAdminAuth?.(adminKey);
  }

  return { client, url };
};

export const queryConvexHealth = async () => {
  const { client, url } = createConvexClient();
  const result = await client.query(healthPingRef, {});
  return { url, result };
};

export const queryConvexRatingsByImageIds = async (imageIds: string[]) => {
  if (!imageIds.length) {
    return [] as ConvexRating[];
  }
  const { client } = createConvexClient();
  const result = await client.query(ratingsByImageIdsRef, { imageIds });
  return result.ratings || [];
};

export const mutateConvexIssueMatchupToken = async (args: IssueMatchupTokenArgs) => {
  const { client } = createConvexClient();
  return client.mutation(issueMatchupTokenRef, args);
};

export const mutateConvexValidateAndConsumeMatchupToken = async (
  args: ValidateAndConsumeMatchupTokenArgs,
) => {
  const { client } = createConvexClient();
  return client.mutation(validateAndConsumeMatchupTokenRef, args);
};

export const mutateConvexCreateVoteEvent = async (args: CreateVoteEventArgs) => {
  const { client } = createConvexClient();
  return client.mutation(createVoteEventRef, args);
};

export const mutateConvexProjectVoteEvent = async (args: ProjectVoteEventArgs) => {
  const { client } = createConvexClient();
  return client.mutation(projectVoteEventRef, args);
};

export const isConvexOptimisticConcurrencyError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error || "");
  return message.includes("OptimisticConcurrencyControlFailure");
};

export const queryConvexTopRatings = async (args: TopRatingsArgs) => {
  const { client } = createConvexClient();
  return client.query(topRatingsRef, args);
};

export const queryConvexVoteCountByAuthUserId = async (authUserId: string) => {
  const { client } = createConvexClient();
  return client.query(voteCountByAuthUserIdRef, { authUserId });
};

export const queryConvexVoteCountForProfile = async (args: {
  authUserId: string;
  voterHash?: string;
}) => {
  const { client } = createConvexClient();
  return client.query(voteCountForProfileRef, args);
};

export const queryConvexUserProfileByEmail = async (email: string) => {
  const { client } = createConvexClient();
  return client.query(userProfileByEmailRef, { emailLower: email.toLowerCase() });
};

export const queryConvexUserProfileByAuthUserId = async (authUserId: string) => {
  const { client } = createConvexClient();
  return client.query(userProfileByAuthIdRef, { authUserId });
};

export const queryConvexUserProfileByTelegramUserId = async (telegramUserId: number) => {
  const { client } = createConvexClient();
  return client.query(userProfileByTelegramIdRef, { telegramUserId });
};

export const mutateConvexUpsertUserProfile = async (args: UpsertUserProfileArgs) => {
  const { client } = createConvexClient();
  return client.mutation(upsertUserProfileRef, args);
};

export const mutateConvexUpdateUserAlias = async (args: {
  authUserId: string;
  alias: string;
  updatedAt?: number;
}) => {
  const { client } = createConvexClient();
  return client.mutation(updateUserAliasRef, args);
};

export const mutateConvexUpsertTelegramUser = async (args: {
  telegramUserId: number;
  email: string;
  alias: string;
  role: string;
  telegramUsername?: string;
  inviteToken?: string;
  createdAt?: number;
  updatedAt?: number;
}) => {
  const { client } = createConvexClient();
  return client.mutation(upsertTelegramUserRef, args);
};

export const mutateConvexBackfillClearVotesBatch = async (args: BackfillClearBatchArgs) => {
  const { client } = createConvexClient();
  return client.mutation(backfillClearVotesBatchRef, args);
};

export const mutateConvexBackfillClearImageRatingsBatch = async (args: BackfillClearBatchArgs) => {
  const { client } = createConvexClient();
  return client.mutation(backfillClearImageRatingsBatchRef, args);
};

export const mutateConvexBackfillClearUserProfilesBatch = async (args: BackfillClearBatchArgs) => {
  const { client } = createConvexClient();
  return client.mutation(backfillClearUserProfilesBatchRef, args);
};

export const mutateConvexBackfillClearAuthTokensBatch = async (args: BackfillClearBatchArgs) => {
  const { client } = createConvexClient();
  return client.mutation(backfillClearAuthTokensBatchRef, args);
};

export const mutateConvexBackfillClearSessionsBatch = async (args: BackfillClearBatchArgs) => {
  const { client } = createConvexClient();
  return client.mutation(backfillClearSessionsBatchRef, args);
};

export const mutateConvexBackfillClearMatchupTokensBatch = async (args: BackfillClearBatchArgs) => {
  const { client } = createConvexClient();
  return client.mutation(backfillClearMatchupTokensBatchRef, args);
};

export const mutateConvexBackfillClearImagesBatch = async (args: BackfillClearBatchArgs) => {
  const { client } = createConvexClient();
  return client.mutation(backfillClearImagesBatchRef, args);
};

export const mutateConvexBackfillClearImageCommentsBatch = async (args: BackfillClearBatchArgs) => {
  const { client } = createConvexClient();
  return client.mutation(backfillClearImageCommentsBatchRef, args);
};

export const mutateConvexBackfillUpsertImageRating = async (
  args: BackfillUpsertImageRatingArgs,
) => {
  const { client } = createConvexClient();
  return client.mutation(backfillUpsertImageRatingRef, args);
};

export const mutateConvexBackfillUpsertImage = async (args: BackfillUpsertImageArgs) => {
  const { client } = createConvexClient();
  return client.mutation(backfillUpsertImageRef, args);
};

export const mutateConvexBackfillInsertVote = async (args: BackfillInsertVoteArgs) => {
  const { client } = createConvexClient();
  return client.mutation(backfillInsertVoteRef, args);
};

export const mutateConvexBackfillInsertImageComment = async (
  args: BackfillInsertImageCommentArgs,
) => {
  const { client } = createConvexClient();
  return client.mutation(backfillInsertImageCommentRef, args);
};

export const queryConvexBackfillCounts = async () => {
  const { client } = createConvexClient();
  return client.query(backfillGetCountsRef, {});
};

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

export const mutateConvexCreateAuthToken = async (args: {
  tokenHash: string;
  userAuthUserId: string;
  expiresAt: number;
  createdAt?: number;
}) => {
  const { client } = createConvexClient();
  return client.mutation(createAuthTokenRef, args);
};

export const mutateConvexConsumeAuthToken = async (args: { tokenHash: string; now?: number }) => {
  const { client } = createConvexClient();
  return client.mutation(consumeAuthTokenRef, args);
};

export const mutateConvexCreateSession = async (args: {
  tokenHash: string;
  userAuthUserId: string;
  expiresAt: number;
  createdAt?: number;
}) => {
  const { client } = createConvexClient();
  return client.mutation(createSessionRef, args);
};

export const mutateConvexDeleteSessionByTokenHash = async (args: { tokenHash: string }) => {
  const { client } = createConvexClient();
  return client.mutation(deleteSessionByTokenHashRef, args);
};

export const queryConvexSessionUserAuthUserId = async (args: {
  tokenHash: string;
  now?: number;
}) => {
  const { client } = createConvexClient();
  return client.query(getSessionUserAuthUserIdRef, args);
};
