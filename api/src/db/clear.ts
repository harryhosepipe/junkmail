import { DeleteObjectsCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { s3Client, storageBucket } from "../platform/storage/client.js";
import {
  mutateConvexBackfillClearAuthTokensBatch,
  mutateConvexBackfillClearImageCommentsBatch,
  mutateConvexBackfillClearImagesBatch,
  mutateConvexBackfillClearImageRatingsBatch,
  mutateConvexBackfillClearMatchupTokensBatch,
  mutateConvexBackfillClearSessionsBatch,
  mutateConvexBackfillClearUserProfilesBatch,
  mutateConvexBackfillClearVotesBatch,
} from "../platform/convex/client.js";
import { getEnv } from "../env.js";

const deleteAllObjects = async () => {
  let continuationToken: string | undefined;
  let deleted = 0;

  do {
    const response = await s3Client.send(
      new ListObjectsV2Command({
        Bucket: storageBucket,
        ContinuationToken: continuationToken,
      }),
    );

    const objects = (response.Contents ?? [])
      .map((item) => item.Key)
      .filter((key): key is string => Boolean(key))
      .map((key) => ({ Key: key }));

    if (objects.length) {
      await s3Client.send(
        new DeleteObjectsCommand({
          Bucket: storageBucket,
          Delete: { Objects: objects, Quiet: true },
        }),
      );
      deleted += objects.length;
    }

    continuationToken = response.IsTruncated ? response.NextContinuationToken : undefined;
  } while (continuationToken);

  return deleted;
};

const clearInBatches = async (
  clearBatch: (args: { limit?: number }) => Promise<{ deleted: number; hasMore: boolean }>,
  limit = 256,
) => {
  let hasMore = true;
  while (hasMore) {
    const result = await clearBatch({ limit });
    hasMore = result.hasMore;
  }
};

const run = async () => {
  getEnv();
  console.info("Clearing Convex tables");
  await clearInBatches(mutateConvexBackfillClearImageCommentsBatch);
  await clearInBatches(mutateConvexBackfillClearImagesBatch);
  await clearInBatches(mutateConvexBackfillClearVotesBatch);
  await clearInBatches(mutateConvexBackfillClearImageRatingsBatch);
  await clearInBatches(mutateConvexBackfillClearMatchupTokensBatch);
  await clearInBatches(mutateConvexBackfillClearSessionsBatch);
  await clearInBatches(mutateConvexBackfillClearAuthTokensBatch);
  await clearInBatches(mutateConvexBackfillClearUserProfilesBatch);

  console.info(`Clearing objects from bucket "${storageBucket}"`);
  const deletedObjects = await deleteAllObjects();
  console.info(`Deleted ${deletedObjects} objects`);
};

run().catch((err) => {
  console.error("Clear failed", err);
  process.exitCode = 1;
});
