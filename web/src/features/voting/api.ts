import { createApiClient } from "../shared/api/client";

type MatchupImage = {
  id?: string;
  originalUrl?: string;
  variantUrls?: unknown;
};

type MatchupResponse = {
  a?: MatchupImage;
  b?: MatchupImage;
  matchup_token?: string;
};

type VotePayload = {
  imageAId: string;
  imageBId: string;
  winnerId: string;
  matchupToken?: string;
};

export const createVotingApi = (apiBaseUrl = "") => {
  const api = createApiClient(apiBaseUrl);
  return {
    getNextMatchup: () => api.get<MatchupResponse>("/api/v1/matchups/next"),
    submitVote: ({ imageAId, imageBId, winnerId, matchupToken }: VotePayload) =>
      api.post(
        "/api/v1/votes",
        JSON.stringify({
          image_a_id: imageAId,
          image_b_id: imageBId,
          winner_id: winnerId,
          matchup_token: matchupToken,
        }),
        {
          headers: { "Content-Type": "application/json" },
        },
      ),
  };
};

export type { MatchupResponse };
