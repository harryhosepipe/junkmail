import { makeFunctionReference } from "convex/server";
import { createConvexClient } from "./core.js";
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
