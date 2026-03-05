import {
  processImageJob as processImageJobCore,
  toBuffer,
  type ImageProcessorDeps,
} from "./imageProcessor.js";
import { processVoteJob as processVoteJobCore, type VoteProcessorDeps } from "./voteProcessor.js";
import type { ImageProcessJobData, VoteProcessJobData } from "./processorTypes.js";

type QueueLogMeta = Record<string, unknown>;

const logQueueStart = (kind: "image" | "vote", meta: QueueLogMeta) => {
  console.info(`[queue:${kind}] start`, meta);
};

const logQueueSuccess = (kind: "image" | "vote", meta: QueueLogMeta) => {
  console.info(`[queue:${kind}] success`, meta);
};

const logQueueFailure = (kind: "image" | "vote", meta: QueueLogMeta) => {
  console.error(`[queue:${kind}] failure`, meta);
};

export { toBuffer };
export type { ImageProcessJobData, VoteProcessJobData };

export const processImageJob = async (data: ImageProcessJobData, deps?: ImageProcessorDeps) => {
  const startedAt = Date.now();
  logQueueStart("image", { imageId: data.imageId, uploadId: data.uploadId ?? null });
  try {
    await processImageJobCore(data, deps);
    logQueueSuccess("image", {
      imageId: data.imageId,
      uploadId: data.uploadId ?? null,
      durationMs: Date.now() - startedAt,
    });
  } catch (error) {
    logQueueFailure("image", {
      imageId: data.imageId,
      uploadId: data.uploadId ?? null,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
};

export const processVoteJob = async (data: VoteProcessJobData, deps?: VoteProcessorDeps) => {
  const startedAt = Date.now();
  logQueueStart("vote", { voteEventId: data.voteEventId });
  try {
    await processVoteJobCore(data, deps);
    logQueueSuccess("vote", {
      voteEventId: data.voteEventId,
      durationMs: Date.now() - startedAt,
    });
  } catch (error) {
    logQueueFailure("vote", {
      voteEventId: data.voteEventId,
      durationMs: Date.now() - startedAt,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
};
