import { Worker } from "bullmq";
import { redis } from "./connection.js";
import { getEnv } from "../../env.js";
import { processImageJob, processVoteJob } from "./processors.js";

// Fail fast if env is missing/invalid.
getEnv();

const worker = new Worker(
  "image-processing",
  async (job) => {
    await processImageJob(
      job.data as {
        imageId: string;
        key: string;
        ext: "jpg" | "png";
        contentType: string;
      },
    );
  },
  {
    connection: redis,
  },
);

worker.on("failed", (job, err) => {
  const id = job?.id ?? "unknown";
  console.error(`[queue] image-processing job failed`, id, err);
});

const voteWorker = new Worker(
  "vote-writes",
  async (job) => {
    await processVoteJob(job.data as { voteEventId: string; createdAt: number });
  },
  {
    connection: redis,
    concurrency: 1,
  },
);

voteWorker.on("failed", (job, err) => {
  const id = job?.id ?? "unknown";
  console.error(`[queue] vote-writes job failed`, id, err);
});
