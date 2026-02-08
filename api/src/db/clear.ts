import { DeleteObjectsCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { s3Client, storageBucket } from "../storage/client.js";
import { db, pool } from "./client.js";
import { images, ratings, votes } from "./schema.js";
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

const run = async () => {
  getEnv();
  console.info("Clearing database tables: votes, ratings, images");
  await db.delete(votes);
  await db.delete(ratings);
  await db.delete(images);

  console.info(`Clearing objects from bucket "${storageBucket}"`);
  const deletedObjects = await deleteAllObjects();
  console.info(`Deleted ${deletedObjects} objects`);
};

run()
  .then(() => pool.end())
  .catch(async (err) => {
    console.error("Clear failed", err);
    await pool.end();
    process.exitCode = 1;
  });
