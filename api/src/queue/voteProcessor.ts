import { mutateConvexProjectVoteEvent } from "../convex/client.js";
import type { VoteProcessJobData } from "./processorTypes.js";

export type VoteProcessorDeps = {
  mutateConvexProjectVoteEvent: (args: { voteEventId: string; now?: number }) => Promise<unknown>;
};

const defaultVoteDeps: VoteProcessorDeps = {
  mutateConvexProjectVoteEvent,
};

export const processVoteJob = async (
  data: VoteProcessJobData,
  deps: VoteProcessorDeps = defaultVoteDeps,
) => {
  await deps.mutateConvexProjectVoteEvent({
    voteEventId: data.voteEventId,
    now: data.createdAt,
  });
};
