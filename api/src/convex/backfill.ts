import { runConvexMutation, runConvexQuery } from "./calls.js";
import { mutationRef, queryRef } from "./refs.js";

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

const backfillClearVotesBatchRef = mutationRef<BackfillClearBatchArgs, BackfillClearBatchResult>(
  "backfill:clearVotesBatch",
);
const backfillClearImageRatingsBatchRef = mutationRef<
  BackfillClearBatchArgs,
  BackfillClearBatchResult
>("backfill:clearImageRatingsBatch");
const backfillClearUserProfilesBatchRef = mutationRef<
  BackfillClearBatchArgs,
  BackfillClearBatchResult
>("backfill:clearUserProfilesBatch");
const backfillClearAuthTokensBatchRef = mutationRef<
  BackfillClearBatchArgs,
  BackfillClearBatchResult
>("backfill:clearAuthTokensBatch");
const backfillClearSessionsBatchRef = mutationRef<BackfillClearBatchArgs, BackfillClearBatchResult>(
  "backfill:clearSessionsBatch",
);
const backfillClearMatchupTokensBatchRef = mutationRef<
  BackfillClearBatchArgs,
  BackfillClearBatchResult
>("backfill:clearMatchupTokensBatch");
const backfillClearImagesBatchRef = mutationRef<BackfillClearBatchArgs, BackfillClearBatchResult>(
  "backfill:clearImagesBatch",
);
const backfillClearImageCommentsBatchRef = mutationRef<
  BackfillClearBatchArgs,
  BackfillClearBatchResult
>("backfill:clearImageCommentsBatch");
const backfillUpsertImageRatingRef = mutationRef<BackfillUpsertImageRatingArgs, { ok: boolean }>(
  "backfill:upsertImageRating",
);
const backfillUpsertImageRef = mutationRef<BackfillUpsertImageArgs, { ok: boolean }>(
  "backfill:upsertImage",
);
const backfillInsertVoteRef = mutationRef<BackfillInsertVoteArgs, { ok: boolean }>(
  "backfill:insertVote",
);
const backfillInsertImageCommentRef = mutationRef<BackfillInsertImageCommentArgs, { ok: boolean }>(
  "backfill:insertImageComment",
);
const backfillGetCountsRef = queryRef<Record<string, never>, BackfillCounts>("backfill:getCounts");

export const mutateConvexBackfillClearVotesBatch = async (args: BackfillClearBatchArgs) => {
  return runConvexMutation((client) => client.mutation(backfillClearVotesBatchRef, args));
};

export const mutateConvexBackfillClearImageRatingsBatch = async (args: BackfillClearBatchArgs) => {
  return runConvexMutation((client) => client.mutation(backfillClearImageRatingsBatchRef, args));
};

export const mutateConvexBackfillClearUserProfilesBatch = async (args: BackfillClearBatchArgs) => {
  return runConvexMutation((client) => client.mutation(backfillClearUserProfilesBatchRef, args));
};

export const mutateConvexBackfillClearAuthTokensBatch = async (args: BackfillClearBatchArgs) => {
  return runConvexMutation((client) => client.mutation(backfillClearAuthTokensBatchRef, args));
};

export const mutateConvexBackfillClearSessionsBatch = async (args: BackfillClearBatchArgs) => {
  return runConvexMutation((client) => client.mutation(backfillClearSessionsBatchRef, args));
};

export const mutateConvexBackfillClearMatchupTokensBatch = async (args: BackfillClearBatchArgs) => {
  return runConvexMutation((client) => client.mutation(backfillClearMatchupTokensBatchRef, args));
};

export const mutateConvexBackfillClearImagesBatch = async (args: BackfillClearBatchArgs) => {
  return runConvexMutation((client) => client.mutation(backfillClearImagesBatchRef, args));
};

export const mutateConvexBackfillClearImageCommentsBatch = async (args: BackfillClearBatchArgs) => {
  return runConvexMutation((client) => client.mutation(backfillClearImageCommentsBatchRef, args));
};

export const mutateConvexBackfillUpsertImageRating = async (
  args: BackfillUpsertImageRatingArgs,
) => {
  return runConvexMutation((client) => client.mutation(backfillUpsertImageRatingRef, args));
};

export const mutateConvexBackfillUpsertImage = async (args: BackfillUpsertImageArgs) => {
  return runConvexMutation((client) => client.mutation(backfillUpsertImageRef, args));
};

export const mutateConvexBackfillInsertVote = async (args: BackfillInsertVoteArgs) => {
  return runConvexMutation((client) => client.mutation(backfillInsertVoteRef, args));
};

export const mutateConvexBackfillInsertImageComment = async (
  args: BackfillInsertImageCommentArgs,
) => {
  return runConvexMutation((client) => client.mutation(backfillInsertImageCommentRef, args));
};

export const queryConvexBackfillCounts = async () => {
  return runConvexQuery((client) => client.query(backfillGetCountsRef, {}));
};
