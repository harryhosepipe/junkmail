import { runConvexMutation, runConvexQuery } from "./calls.js";
import { mutationRef, queryRef } from "./refs.js";
import type { ConvexRating } from "./types.js";

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

const ratingsByImageIdsRef = queryRef<{ imageIds: string[] }, ConvexRatingsResponse>(
  "voting:getRatingsByImageIds",
);
const issueMatchupTokenRef = mutationRef<IssueMatchupTokenArgs, { ok: boolean }>(
  "voting:issueMatchupToken",
);
const validateAndConsumeMatchupTokenRef = mutationRef<
  ValidateAndConsumeMatchupTokenArgs,
  ValidateAndConsumeMatchupTokenResult
>("voting:validateAndConsumeMatchupToken");
const createVoteEventRef = mutationRef<CreateVoteEventArgs, CreateVoteEventResult>(
  "voting:createVoteEvent",
);
const projectVoteEventRef = mutationRef<ProjectVoteEventArgs, ProjectVoteEventResult>(
  "voting:projectVoteEvent",
);
const topRatingsRef = queryRef<TopRatingsArgs, TopRatingItem[]>("voting:getTopRatings");
const voteCountByAuthUserIdRef = queryRef<{ authUserId: string }, { count: number }>(
  "voting:getVoteCountByAuthUserId",
);
const voteCountForProfileRef = queryRef<
  { authUserId: string; voterHash?: string },
  { count: number }
>("voting:getVoteCountForProfile");

export const queryConvexRatingsByImageIds = async (imageIds: string[]) => {
  if (!imageIds.length) {
    return [] as ConvexRating[];
  }
  const result = await runConvexQuery((client) => client.query(ratingsByImageIdsRef, { imageIds }));
  return result.ratings || [];
};

export const mutateConvexIssueMatchupToken = async (args: IssueMatchupTokenArgs) => {
  return runConvexMutation((client) => client.mutation(issueMatchupTokenRef, args));
};

export const mutateConvexValidateAndConsumeMatchupToken = async (
  args: ValidateAndConsumeMatchupTokenArgs,
) => {
  return runConvexMutation((client) => client.mutation(validateAndConsumeMatchupTokenRef, args));
};

export const mutateConvexCreateVoteEvent = async (args: CreateVoteEventArgs) => {
  return runConvexMutation((client) => client.mutation(createVoteEventRef, args));
};

export const mutateConvexProjectVoteEvent = async (args: ProjectVoteEventArgs) => {
  return runConvexMutation((client) => client.mutation(projectVoteEventRef, args));
};

export const isConvexOptimisticConcurrencyError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error || "");
  return message.includes("OptimisticConcurrencyControlFailure");
};

export const queryConvexTopRatings = async (args: TopRatingsArgs) => {
  return runConvexQuery((client) => client.query(topRatingsRef, args));
};

export const queryConvexVoteCountByAuthUserId = async (authUserId: string) => {
  return runConvexQuery((client) => client.query(voteCountByAuthUserIdRef, { authUserId }));
};

export const queryConvexVoteCountForProfile = async (args: {
  authUserId: string;
  voterHash?: string;
}) => {
  return runConvexQuery((client) => client.query(voteCountForProfileRef, args));
};
