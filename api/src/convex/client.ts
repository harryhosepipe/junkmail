import { ConvexHttpClient } from "convex/browser";
import { makeFunctionReference } from "convex/server";
import { desc, eq, gte, inArray } from "drizzle-orm";
import { db } from "../db/client.js";
import { ratings, votes } from "../db/schema.js";

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

  try {
    const { client } = createConvexClient();
    const result = await client.query(ratingsByImageIdsRef, { imageIds });
    return result.ratings || [];
  } catch {
    const uniqueIds = [...new Set(imageIds)].slice(0, 500);
    const rows = uniqueIds.length
      ? await db
          .select({
            imageId: ratings.imageId,
            score: ratings.score,
            uncertainty: ratings.uncertainty,
            comparisonsCount: ratings.comparisonsCount,
            updatedAt: ratings.updatedAt,
          })
          .from(ratings)
          .where(inArray(ratings.imageId, uniqueIds))
      : [];
    const byId = new Map(rows.map((row) => [row.imageId, row]));
    const initialScore = Number(process.env.RATING_INITIAL_SCORE) || 0;
    const initialUncertainty = Number(process.env.RATING_INITIAL_UNCERTAINTY) || 1;
    return uniqueIds.map((imageId) => {
      const row = byId.get(imageId);
      return {
        imageId,
        score: row?.score ?? initialScore,
        uncertainty: row?.uncertainty ?? initialUncertainty,
        comparisonsCount: row?.comparisonsCount ?? 0,
        updatedAt: row?.updatedAt ? new Date(row.updatedAt).getTime() : 0,
      } satisfies ConvexRating;
    });
  }
};

export const mutateConvexRecordVote = async (args: RecordVoteArgs) => {
  try {
    const { client } = createConvexClient();
    return await client.mutation(recordVoteRef, args);
  } catch {
    const learningRate = Number(process.env.BRADLEY_TERRY_K) || 0.15;
    const initialScore = Number(process.env.RATING_INITIAL_SCORE) || 0;
    const initialUncertainty = Number(process.env.RATING_INITIAL_UNCERTAINTY) || 1;
    const minUncertainty = Number(process.env.RATING_MIN_UNCERTAINTY) || 0.15;

    const updateUncertainty = (comparisonsCount: number) => {
      const next = 1 / Math.sqrt(comparisonsCount + 1);
      return Math.max(minUncertainty, next);
    };

    const now = args.createdAt ?? Date.now();

    await db.transaction(async (tx) => {
      // Ensure ratings rows exist.
      await tx
        .insert(ratings)
        .values([
          {
            imageId: args.imageAId,
            score: initialScore,
            uncertainty: initialUncertainty,
            comparisonsCount: 0,
            updatedAt: new Date(now),
          },
          {
            imageId: args.imageBId,
            score: initialScore,
            uncertainty: initialUncertainty,
            comparisonsCount: 0,
            updatedAt: new Date(now),
          },
        ])
        .onConflictDoNothing();

      const current = await tx
        .select({
          imageId: ratings.imageId,
          score: ratings.score,
          uncertainty: ratings.uncertainty,
          comparisonsCount: ratings.comparisonsCount,
        })
        .from(ratings)
        .where(inArray(ratings.imageId, [args.imageAId, args.imageBId]));

      const byId = new Map(current.map((row) => [row.imageId, row]));
      const ratingA = byId.get(args.imageAId) ?? {
        imageId: args.imageAId,
        score: initialScore,
        uncertainty: initialUncertainty,
        comparisonsCount: 0,
      };
      const ratingB = byId.get(args.imageBId) ?? {
        imageId: args.imageBId,
        score: initialScore,
        uncertainty: initialUncertainty,
        comparisonsCount: 0,
      };

      const scoreA = ratingA.score;
      const scoreB = ratingB.score;
      const probabilityA = 1 / (1 + Math.exp(-(scoreA - scoreB)));
      const outcomeA = args.winnerId === args.imageAId ? 1 : 0;
      const deltaA = learningRate * (outcomeA - probabilityA);
      const deltaB = -deltaA;

      const nextComparisonsA = (ratingA.comparisonsCount ?? 0) + 1;
      const nextComparisonsB = (ratingB.comparisonsCount ?? 0) + 1;

      await tx
        .update(ratings)
        .set({
          score: scoreA + deltaA,
          comparisonsCount: nextComparisonsA,
          uncertainty: updateUncertainty(nextComparisonsA),
          updatedAt: new Date(now),
        })
        .where(eq(ratings.imageId, args.imageAId));

      await tx
        .update(ratings)
        .set({
          score: scoreB + deltaB,
          comparisonsCount: nextComparisonsB,
          uncertainty: updateUncertainty(nextComparisonsB),
          updatedAt: new Date(now),
        })
        .where(eq(ratings.imageId, args.imageBId));

      await tx.insert(votes).values({
        imageAId: args.imageAId,
        imageBId: args.imageBId,
        winnerId: args.winnerId,
        voterHash: args.voterHash,
        ipHash: args.ipHash,
        createdAt: new Date(now),
      });
    });

    return { ok: true };
  }
};

export const isConvexOptimisticConcurrencyError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error || "");
  return message.includes("OptimisticConcurrencyControlFailure");
};

export const queryConvexTopRatings = async (args: TopRatingsArgs) => {
  try {
    const { client } = createConvexClient();
    return await client.query(topRatingsRef, args);
  } catch {
    const safeLimit = Math.max(1, Math.min(Math.floor(args.limit), 200));
    const minComparisons = Math.max(0, Math.floor(args.minComparisons));
    const rows = await db
      .select({
        imageId: ratings.imageId,
        score: ratings.score,
        uncertainty: ratings.uncertainty,
        comparisonsCount: ratings.comparisonsCount,
      })
      .from(ratings)
      .where(gte(ratings.comparisonsCount, minComparisons))
      .orderBy(desc(ratings.score))
      .limit(safeLimit);

    return rows.map((row) => ({
      imageId: row.imageId,
      score: row.score,
      uncertainty: row.uncertainty,
      comparisonsCount: row.comparisonsCount,
    }));
  }
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
