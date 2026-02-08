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

type RecordVoteArgs = {
  imageAId: string;
  imageBId: string;
  winnerId: string;
  voterHash: string;
  voterAuthUserId?: string;
  ipHash: string;
  createdAt?: number;
};

type RecordVoteResult = {
  ok: boolean;
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
  createdAt: number;
  updatedAt: number;
};

type UpsertUserProfileArgs = {
  authUserId: string;
  email: string;
  alias: string;
  role: string;
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

type BackfillCounts = {
  userProfiles: number;
  imageRatings: number;
  votes: number;
};

type BackfillClearBatchArgs = {
  limit?: number;
};

type BackfillClearBatchResult = {
  deleted: number;
  hasMore: boolean;
};

const healthPingRef = makeFunctionReference<"query", Record<string, never>, ConvexHealth>(
  "health:ping",
);
const ratingsByImageIdsRef = makeFunctionReference<
  "query",
  { imageIds: string[] },
  ConvexRatingsResponse
>("voting:getRatingsByImageIds");
const recordVoteRef = makeFunctionReference<"mutation", RecordVoteArgs, RecordVoteResult>(
  "voting:recordVote",
);
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
const upsertUserProfileRef = makeFunctionReference<
  "mutation",
  UpsertUserProfileArgs,
  { ok: boolean }
>("users:upsertByAuthUserId");
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
const backfillUpsertImageRatingRef = makeFunctionReference<
  "mutation",
  BackfillUpsertImageRatingArgs,
  { ok: boolean }
>("backfill:upsertImageRating");
const backfillInsertVoteRef = makeFunctionReference<
  "mutation",
  BackfillInsertVoteArgs,
  { ok: boolean }
>("backfill:insertVote");
const backfillGetCountsRef = makeFunctionReference<"query", Record<string, never>, BackfillCounts>(
  "backfill:getCounts",
);

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

export const mutateConvexRecordVote = async (args: RecordVoteArgs) => {
  const { client } = createConvexClient();
  return client.mutation(recordVoteRef, args);
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

export const mutateConvexUpsertUserProfile = async (args: UpsertUserProfileArgs) => {
  const { client } = createConvexClient();
  return client.mutation(upsertUserProfileRef, args);
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

export const mutateConvexBackfillUpsertImageRating = async (
  args: BackfillUpsertImageRatingArgs,
) => {
  const { client } = createConvexClient();
  return client.mutation(backfillUpsertImageRatingRef, args);
};

export const mutateConvexBackfillInsertVote = async (args: BackfillInsertVoteArgs) => {
  const { client } = createConvexClient();
  return client.mutation(backfillInsertVoteRef, args);
};

export const queryConvexBackfillCounts = async () => {
  const { client } = createConvexClient();
  return client.query(backfillGetCountsRef, {});
};
