import { makeFunctionReference } from "convex/server";
import { createConvexClient } from "./core.js";

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
