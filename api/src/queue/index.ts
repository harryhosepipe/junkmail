import { Queue } from "bullmq";
import { redis } from "./connection.js";
import { env } from "../env.js";

export const imageQueue = new Queue("image-processing", {
  connection: redis,
});

export const voteQueue = new Queue("vote-writes", {
  connection: redis,
  defaultJobOptions: {
    attempts: 4,
    backoff: {
      type: "exponential",
      delay: 25,
    },
    removeOnComplete: 1000,
    removeOnFail: 2000,
  },
});

export const imageClassificationQueue = new Queue("image-classification", {
  connection: redis,
  defaultJobOptions: {
    attempts: Math.max(1, Math.floor(env.IMAGE_CLASSIFICATION_MAX_RETRIES ?? 2) + 1),
    backoff: {
      type: "exponential",
      delay: 5000,
    },
    removeOnComplete: 1000,
    removeOnFail: 2000,
  },
});
