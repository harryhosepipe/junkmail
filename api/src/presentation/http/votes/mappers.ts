import type { VoteSubmitDomainResult } from "../../../domain/voting/types.js";

type VoteHttpResponse = {
  status: number;
  body: Record<string, unknown>;
};

export const mapVoteSubmitDomainToHttp = (result: VoteSubmitDomainResult): VoteHttpResponse => {
  if (result.kind === "matchup_unavailable") {
    return {
      status: 404,
      body: { error: { message: "Matchup unavailable" } },
    };
  }

  return {
    status: 200,
    body: {
      ok: true,
      eventId: result.eventId,
      acceptedForScoring: result.acceptedForScoring,
      reason: result.acceptedForScoring ? undefined : result.validationStatus,
      validationStatus: result.validationStatus,
    },
  };
};
