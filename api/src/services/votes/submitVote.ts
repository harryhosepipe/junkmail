import { generateToken } from "../../auth/tokens.js";
import {
  mutateConvexCreateVoteEvent,
  mutateConvexProjectVoteEvent,
  mutateConvexValidateAndConsumeMatchupToken,
  queryConvexPublicImagesByIds,
} from "../../convex/client.js";
import type { VoteSubmitDomainResult } from "../../domain/voting/types.js";
import { serviceUnavailable } from "../../http/errors.js";
import { voteQueue } from "../../queue/index.js";
import type { VotePayload } from "../../contracts/votes.js";

type SubmitVoteArgs = {
  payload: VotePayload;
  voterHash: string;
  ipHash: string;
  sessionUserId?: string;
};

export const submitVote = async ({
  payload,
  voterHash,
  ipHash,
  sessionUserId,
}: SubmitVoteArgs): Promise<VoteSubmitDomainResult> => {
  const { imageAId, imageBId, winnerId, matchupTokenId } = payload;

  try {
    const imageRows = await queryConvexPublicImagesByIds([imageAId, imageBId]);
    if (imageRows.length !== 2) {
      return { kind: "matchup_unavailable" };
    }
  } catch {
    throw serviceUnavailable("Matchup lookup unavailable. Try again.");
  }

  const validation = await mutateConvexValidateAndConsumeMatchupToken({
    tokenId: matchupTokenId,
    voterHash,
    imageAId,
    imageBId,
    now: Date.now(),
  });

  const voteEventId = generateToken();
  const createdAt = Date.now();
  await mutateConvexCreateVoteEvent({
    voteEventId,
    matchupTokenId,
    imageAId,
    imageBId,
    winnerId,
    voterHash,
    voterAuthUserId: sessionUserId,
    ipHash,
    createdAt,
    validationStatus: validation.validationStatus,
    rejectionReason: validation.rejectionReason || undefined,
  });

  if (validation.acceptedForScoring) {
    try {
      await voteQueue.add(
        "project",
        {
          voteEventId,
          createdAt,
        },
        {
          jobId: voteEventId,
        },
      );
    } catch {
      try {
        // Queue is best for durability, but if enqueue fails we still try a direct
        // projection so accepted votes are not lost during transient queue outages.
        await mutateConvexProjectVoteEvent({ voteEventId, now: Date.now() });
      } catch {
        throw serviceUnavailable("Vote accepted but projection unavailable. Retry later.");
      }
    }
  }

  return {
    kind: "vote_recorded",
    eventId: voteEventId,
    acceptedForScoring: validation.acceptedForScoring,
    validationStatus: validation.validationStatus,
  };
};
