import { badRequest } from "../../../platform/http/errors.js";

export type VotePayload = {
  imageAId: string;
  imageBId: string;
  winnerId: string;
  matchupTokenId: string;
};

const normalizeBodyValue = (value: unknown) => (typeof value === "string" ? value.trim() : "");

export const parseVotePayload = (body: unknown): VotePayload => {
  const data = (body ?? {}) as Record<string, unknown>;
  const imageAId = normalizeBodyValue(data.image_a_id);
  const imageBId = normalizeBodyValue(data.image_b_id);
  const winnerId = normalizeBodyValue(data.winner_id);
  const matchupTokenId = normalizeBodyValue(data.matchup_token);

  if (!imageAId || !imageBId || !winnerId || !matchupTokenId) {
    throw badRequest("Missing vote payload");
  }

  if (imageAId === imageBId) {
    throw badRequest("Matchup must contain two images");
  }

  if (winnerId !== imageAId && winnerId !== imageBId) {
    throw badRequest("Winner must be one of the matchup images");
  }

  return { imageAId, imageBId, winnerId, matchupTokenId };
};
