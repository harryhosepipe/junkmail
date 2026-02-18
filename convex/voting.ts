import { mutation, query } from "./_generated/server";
import type { MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { env } from "./env";

const LEARNING_RATE = env.BRADLEY_TERRY_K;
const INITIAL_SCORE = env.RATING_INITIAL_SCORE;
const INITIAL_UNCERTAINTY = env.RATING_INITIAL_UNCERTAINTY;
const MIN_UNCERTAINTY = env.RATING_MIN_UNCERTAINTY;

export const TOKEN_VALIDATION_ACCEPTED = "accepted";
export const TOKEN_VALIDATION_INVALID = "rejected_invalid_token";
export const TOKEN_VALIDATION_EXPIRED = "rejected_expired";
export const TOKEN_VALIDATION_REPLAY = "rejected_replay";
export const TOKEN_VALIDATION_MISMATCH = "rejected_mismatch";

export const PROJECTION_PENDING = "pending";
export const PROJECTION_APPLIED = "applied";
export const PROJECTION_SKIPPED = "skipped";

const updateUncertainty = (comparisonsCount: number) => {
  const next = 1 / Math.sqrt(comparisonsCount + 1);
  return Math.max(MIN_UNCERTAINTY, next);
};

const loadOrCreateRating = async (ctx: MutationCtx, imageId: string) => {
  const existing = await ctx.db
    .query("imageRatings")
    .withIndex("by_image_id", (q) => q.eq("imageId", imageId))
    .unique();
  if (existing) {
    return existing;
  }

  const now = Date.now();
  const insertedId = await ctx.db.insert("imageRatings", {
    imageId,
    score: INITIAL_SCORE,
    uncertainty: INITIAL_UNCERTAINTY,
    comparisonsCount: 0,
    updatedAt: now,
  });

  return {
    _id: insertedId,
    imageId,
    score: INITIAL_SCORE,
    uncertainty: INITIAL_UNCERTAINTY,
    comparisonsCount: 0,
    updatedAt: now,
  };
};

export const issueMatchupToken = mutation({
  args: {
    tokenId: v.string(),
    voterHash: v.string(),
    imageAId: v.string(),
    imageBId: v.string(),
    issuedAt: v.number(),
    expiresAt: v.number(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("matchupTokens", args);
    return { ok: true };
  },
});

export const validateAndConsumeMatchupToken = mutation({
  args: {
    tokenId: v.string(),
    voterHash: v.string(),
    imageAId: v.string(),
    imageBId: v.string(),
    now: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const now = args.now ?? Date.now();
    const token = await ctx.db
      .query("matchupTokens")
      .withIndex("by_token_id", (q) => q.eq("tokenId", args.tokenId))
      .unique();

    if (!token) {
      return {
        acceptedForScoring: false,
        validationStatus: TOKEN_VALIDATION_INVALID,
        rejectionReason: "token_not_found",
      };
    }

    if (token.voterHash !== args.voterHash) {
      await ctx.db.patch(token._id, { lastSeenAt: now });
      return {
        acceptedForScoring: false,
        validationStatus: TOKEN_VALIDATION_MISMATCH,
        rejectionReason: "voter_mismatch",
      };
    }

    const pairMatches = token.imageAId === args.imageAId && token.imageBId === args.imageBId;
    if (!pairMatches) {
      await ctx.db.patch(token._id, { lastSeenAt: now });
      return {
        acceptedForScoring: false,
        validationStatus: TOKEN_VALIDATION_MISMATCH,
        rejectionReason: "pair_mismatch",
      };
    }

    if (token.expiresAt < now) {
      await ctx.db.patch(token._id, { lastSeenAt: now });
      return {
        acceptedForScoring: false,
        validationStatus: TOKEN_VALIDATION_EXPIRED,
        rejectionReason: "token_expired",
      };
    }

    if (token.usedAt) {
      await ctx.db.patch(token._id, { lastSeenAt: now });
      return {
        acceptedForScoring: false,
        validationStatus: TOKEN_VALIDATION_REPLAY,
        rejectionReason: "token_replayed",
      };
    }

    await ctx.db.patch(token._id, {
      usedAt: now,
      lastSeenAt: now,
    });

    return {
      acceptedForScoring: true,
      validationStatus: TOKEN_VALIDATION_ACCEPTED,
      rejectionReason: null,
    };
  },
});

export const createVoteEvent = mutation({
  args: {
    voteEventId: v.string(),
    matchupTokenId: v.string(),
    imageAId: v.string(),
    imageBId: v.string(),
    winnerId: v.string(),
    voterHash: v.string(),
    voterAuthUserId: v.optional(v.string()),
    ipHash: v.string(),
    createdAt: v.number(),
    validationStatus: v.string(),
    rejectionReason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("votes")
      .withIndex("by_vote_event_id", (q) => q.eq("voteEventId", args.voteEventId))
      .unique();
    if (existing) {
      return { ok: true, alreadyExists: true };
    }

    const projectionStatus =
      args.validationStatus === TOKEN_VALIDATION_ACCEPTED ? PROJECTION_PENDING : PROJECTION_SKIPPED;

    await ctx.db.insert("votes", {
      voteEventId: args.voteEventId,
      matchupTokenId: args.matchupTokenId,
      imageAId: args.imageAId,
      imageBId: args.imageBId,
      winnerId: args.winnerId,
      voterHash: args.voterHash,
      voterAuthUserId: args.voterAuthUserId,
      ipHash: args.ipHash,
      createdAt: args.createdAt,
      validationStatus: args.validationStatus,
      projectionStatus,
      projectionAttemptCount: 0,
      projectedAt: projectionStatus === PROJECTION_SKIPPED ? args.createdAt : undefined,
      rejectionReason: args.rejectionReason,
    });

    return { ok: true, alreadyExists: false };
  },
});

export const projectVoteEvent = mutation({
  args: {
    voteEventId: v.string(),
    now: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const event = await ctx.db
      .query("votes")
      .withIndex("by_vote_event_id", (q) => q.eq("voteEventId", args.voteEventId))
      .unique();
    if (!event) {
      throw new Error("Vote event not found");
    }

    if (
      event.projectionStatus === PROJECTION_APPLIED ||
      event.projectionStatus === PROJECTION_SKIPPED
    ) {
      return { ok: true, projectionStatus: event.projectionStatus };
    }

    const now = args.now ?? Date.now();
    const nextAttemptCount = (event.projectionAttemptCount ?? 0) + 1;

    if (event.validationStatus !== TOKEN_VALIDATION_ACCEPTED) {
      await ctx.db.patch(event._id, {
        projectionStatus: PROJECTION_SKIPPED,
        projectionAttemptCount: nextAttemptCount,
        projectedAt: now,
      });
      return { ok: true, projectionStatus: PROJECTION_SKIPPED };
    }

    const ratingA = await loadOrCreateRating(ctx, event.imageAId);
    const ratingB = await loadOrCreateRating(ctx, event.imageBId);

    const scoreA = ratingA.score;
    const scoreB = ratingB.score;
    const probabilityA = 1 / (1 + Math.exp(-(scoreA - scoreB)));
    const outcomeA = event.winnerId === event.imageAId ? 1 : 0;
    const deltaA = LEARNING_RATE * (outcomeA - probabilityA);
    const deltaB = -deltaA;

    const nextComparisonsA = ratingA.comparisonsCount + 1;
    const nextComparisonsB = ratingB.comparisonsCount + 1;

    await ctx.db.patch(ratingA._id, {
      score: scoreA + deltaA,
      comparisonsCount: nextComparisonsA,
      uncertainty: updateUncertainty(nextComparisonsA),
      updatedAt: now,
    });

    await ctx.db.patch(ratingB._id, {
      score: scoreB + deltaB,
      comparisonsCount: nextComparisonsB,
      uncertainty: updateUncertainty(nextComparisonsB),
      updatedAt: now,
    });

    await ctx.db.patch(event._id, {
      projectionStatus: PROJECTION_APPLIED,
      projectionAttemptCount: nextAttemptCount,
      projectedAt: now,
    });

    return { ok: true, projectionStatus: PROJECTION_APPLIED };
  },
});

export const getVoteCountByAuthUserId = query({
  args: {
    authUserId: v.string(),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("votes")
      .withIndex("by_voter_auth_user_id", (q) => q.eq("voterAuthUserId", args.authUserId))
      .collect();
    return { count: rows.length };
  },
});

export const getVoteCountForProfile = query({
  args: {
    authUserId: v.string(),
    voterHash: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const [authedVotes, hashVotes] = await Promise.all([
      ctx.db
        .query("votes")
        .withIndex("by_voter_auth_user_id", (q) => q.eq("voterAuthUserId", args.authUserId))
        .collect(),
      args.voterHash
        ? ctx.db
            .query("votes")
            .withIndex("by_voter_hash", (q) => q.eq("voterHash", args.voterHash!))
            .collect()
        : Promise.resolve([]),
    ]);

    const uniqueIds = new Set<string>();
    for (const vote of authedVotes) {
      uniqueIds.add(vote._id);
    }
    for (const vote of hashVotes) {
      uniqueIds.add(vote._id);
    }

    return { count: uniqueIds.size };
  },
});

export const getRatingsByImageIds = query({
  args: {
    imageIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const uniqueIds = [...new Set(args.imageIds)].slice(0, 500);
    const rows = await Promise.all(
      uniqueIds.map(async (imageId) => {
        const rating = await ctx.db
          .query("imageRatings")
          .withIndex("by_image_id", (q) => q.eq("imageId", imageId))
          .unique();
        return {
          imageId,
          score: rating?.score ?? INITIAL_SCORE,
          uncertainty: rating?.uncertainty ?? INITIAL_UNCERTAINTY,
          comparisonsCount: rating?.comparisonsCount ?? 0,
          updatedAt: rating?.updatedAt ?? 0,
        };
      }),
    );

    return { ratings: rows };
  },
});

export const getTopRatings = query({
  args: {
    limit: v.number(),
    minComparisons: v.number(),
  },
  handler: async (ctx, args) => {
    const safeLimit = Math.max(1, Math.min(Math.floor(args.limit), 200));
    const minComparisons = Math.max(0, Math.floor(args.minComparisons));

    // Avoid full-table scans: first sample strong candidates by comparisons,
    // then rank that candidate set by score.
    const scanLimit = Math.max(safeLimit * 8, 400);
    const rows = await ctx.db
      .query("imageRatings")
      .withIndex("by_comparisons")
      .order("desc")
      .take(scanLimit);
    return rows
      .filter((row) => row.comparisonsCount >= minComparisons)
      .sort((a, b) => b.score - a.score)
      .slice(0, safeLimit)
      .map((row) => ({
        imageId: row.imageId,
        score: row.score,
        uncertainty: row.uncertainty,
        comparisonsCount: row.comparisonsCount,
      }));
  },
});
