import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";

export const resolveConvexUrl = () =>
  process.env.CONVEX_URL ||
  process.env.PUBLIC_CONVEX_URL ||
  process.env.CONVEX_SELF_HOSTED_URL ||
  "";

export const resolveConvexAdminKey = () =>
  process.env.CONVEX_ADMIN_KEY || process.env.CONVEX_SELF_HOSTED_ADMIN_KEY || "";

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
  role: string;
  createdAt: number;
  updatedAt: number;
};

type UpsertUserProfileArgs = {
  authUserId: string;
  email: string;
  role: string;
  createdAt?: number;
  updatedAt?: number;
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
