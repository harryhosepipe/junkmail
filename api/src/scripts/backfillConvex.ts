import { asc, eq } from "drizzle-orm";
import { db, pool } from "../db/client.js";
import { imageComments, images, ratings, users, votes } from "../db/schema.js";
import {
  mutateConvexBackfillClearImageCommentsBatch,
  mutateConvexBackfillClearImagesBatch,
  mutateConvexBackfillClearImageRatingsBatch,
  mutateConvexBackfillClearUserProfilesBatch,
  mutateConvexBackfillClearVotesBatch,
  mutateConvexBackfillInsertImageComment,
  mutateConvexBackfillInsertVote,
  mutateConvexBackfillUpsertImage,
  mutateConvexBackfillUpsertImageRating,
  mutateConvexUpsertUserProfile,
  queryConvexBackfillCounts,
} from "../convex/client.js";
import { getEnv } from "../env.js";

const toMillis = (value: Date | null | undefined) => {
  if (!value) return Date.now();
  return new Date(value).getTime();
};

const chunked = <T>(items: T[], size: number) => {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

const clearInBatches = async (
  clearBatch: (args: { limit?: number }) => Promise<{ deleted: number; hasMore: boolean }>,
  limit = 256,
) => {
  let totalDeleted = 0;
  let hasMore = true;
  while (hasMore) {
    const result = await clearBatch({ limit });
    totalDeleted += result.deleted;
    hasMore = result.hasMore;
  }
  return totalDeleted;
};

const run = async () => {
  getEnv();
  const [pgUsers, pgRatings, pgVotes, pgImages, pgComments] = await Promise.all([
    db.select().from(users),
    db.select().from(ratings),
    db.select().from(votes).orderBy(asc(votes.createdAt)),
    db.select().from(images).orderBy(asc(images.createdAt)),
    db
      .select({
        id: imageComments.id,
        imageId: imageComments.imageId,
        body: imageComments.body,
        createdAt: imageComments.createdAt,
        userId: imageComments.userId,
        userAlias: users.alias,
      })
      .from(imageComments)
      .innerJoin(users, eq(imageComments.userId, users.id))
      .orderBy(asc(imageComments.createdAt)),
  ]);

  await clearInBatches(mutateConvexBackfillClearImageCommentsBatch);
  await clearInBatches(mutateConvexBackfillClearImagesBatch);
  await clearInBatches(mutateConvexBackfillClearVotesBatch);
  await clearInBatches(mutateConvexBackfillClearImageRatingsBatch);
  await clearInBatches(mutateConvexBackfillClearUserProfilesBatch);

  for (const user of pgUsers) {
    await mutateConvexUpsertUserProfile({
      authUserId: user.id,
      email: user.email,
      alias: user.alias,
      role: user.role,
      createdAt: toMillis(user.createdAt),
      updatedAt: toMillis(user.createdAt),
    });
  }

  for (const ratingChunk of chunked(pgRatings, 50)) {
    await Promise.all(
      ratingChunk.map((rating) =>
        mutateConvexBackfillUpsertImageRating({
          imageId: rating.imageId,
          score: Number(rating.score),
          uncertainty: Number(rating.uncertainty),
          comparisonsCount: Number(rating.comparisonsCount),
          updatedAt: toMillis(rating.updatedAt),
        }),
      ),
    );
  }

  for (const imageChunk of chunked(pgImages, 50)) {
    await Promise.all(
      imageChunk.map((image) =>
        mutateConvexBackfillUpsertImage({
          imageId: image.id,
          uploaderAuthUserId: image.uploaderId,
          title: image.title ?? undefined,
          description: image.description ?? undefined,
          status: image.status,
          originalUrl: image.originalUrl,
          variantUrls: image.variantUrls,
          createdAt: toMillis(image.createdAt),
          updatedAt: toMillis(image.createdAt),
          publishedAt: image.status === "public" ? toMillis(image.createdAt) : undefined,
        }),
      ),
    );
  }

  for (const voteChunk of chunked(pgVotes, 50)) {
    await Promise.all(
      voteChunk.map((vote) =>
        mutateConvexBackfillInsertVote({
          imageAId: vote.imageAId,
          imageBId: vote.imageBId,
          winnerId: vote.winnerId,
          voterHash: vote.voterHash,
          ipHash: vote.ipHash,
          createdAt: toMillis(vote.createdAt),
        }),
      ),
    );
  }

  for (const commentChunk of chunked(pgComments, 50)) {
    await Promise.all(
      commentChunk.map((comment) =>
        mutateConvexBackfillInsertImageComment({
          commentId: comment.id,
          imageId: comment.imageId,
          userAuthUserId: comment.userId,
          userAlias: comment.userAlias,
          body: comment.body,
          createdAt: toMillis(comment.createdAt),
        }),
      ),
    );
  }

  const counts = await queryConvexBackfillCounts();
  const summary = {
    postgres: {
      users: pgUsers.length,
      imageRatings: pgRatings.length,
      votes: pgVotes.length,
      images: pgImages.length,
      imageComments: pgComments.length,
    },
    convex: counts,
  };

  const countsMatch =
    summary.postgres.users === summary.convex.userProfiles &&
    summary.postgres.imageRatings === summary.convex.imageRatings &&
    summary.postgres.votes === summary.convex.votes &&
    summary.postgres.images === summary.convex.images &&
    summary.postgres.imageComments === summary.convex.imageComments;

  console.log(JSON.stringify({ ok: countsMatch, summary }, null, 2));

  if (!countsMatch) {
    throw new Error("Backfill verification failed: count mismatch between Postgres and Convex");
  }
};

run()
  .catch((error) => {
    const message = error instanceof Error ? error.message : "Convex backfill failed";
    console.error(JSON.stringify({ ok: false, error: message }, null, 2));
    process.exitCode = 1;
  })
  .finally(async () => {
    await pool.end();
  });
