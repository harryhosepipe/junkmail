import { Queue } from "bullmq";
import { redis } from "./connection.js";

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
