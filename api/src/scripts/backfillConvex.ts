import { asc } from "drizzle-orm";
import { db, pool } from "../db/client.js";
import { ratings, users, votes } from "../db/schema.js";
import {
  mutateConvexBackfillInsertVote,
  mutateConvexBackfillResetData,
  mutateConvexBackfillUpsertImageRating,
  mutateConvexUpsertUserProfile,
  queryConvexBackfillCounts,
} from "../convex/client.js";
import "../env.js";

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

const run = async () => {
  const [pgUsers, pgRatings, pgVotes] = await Promise.all([
    db.select().from(users),
    db.select().from(ratings),
    db.select().from(votes).orderBy(asc(votes.createdAt)),
  ]);

  await mutateConvexBackfillResetData({ includeUsers: true });

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

  const counts = await queryConvexBackfillCounts();
  const summary = {
    postgres: {
      users: pgUsers.length,
      imageRatings: pgRatings.length,
      votes: pgVotes.length,
    },
    convex: counts,
  };

  const countsMatch =
    summary.postgres.users === summary.convex.userProfiles &&
    summary.postgres.imageRatings === summary.convex.imageRatings &&
    summary.postgres.votes === summary.convex.votes;

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
