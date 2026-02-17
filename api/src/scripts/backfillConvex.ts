import { asc } from "drizzle-orm";
import { db, pool } from "../db/client.js";
import { users } from "../db/schema.js";
import {
  mutateConvexBackfillClearUserProfilesBatch,
  mutateConvexUpsertUserProfile,
  queryConvexBackfillCounts,
} from "../convex/client.js";
import { getEnv } from "../env.js";

const toMillis = (value: Date | null | undefined) => {
  if (!value) return Date.now();
  return new Date(value).getTime();
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
  const pgUsers = await db.select().from(users).orderBy(asc(users.createdAt));

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

  const counts = await queryConvexBackfillCounts();
  const summary = {
    postgres: {
      users: pgUsers.length,
    },
    convex: {
      userProfiles: counts.userProfiles,
    },
  };

  const countsMatch = summary.postgres.users === summary.convex.userProfiles;

  console.log(JSON.stringify({ ok: countsMatch, summary }, null, 2));

  if (!countsMatch) {
    throw new Error("Backfill verification failed: user profile count mismatch");
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
