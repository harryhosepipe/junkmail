import { env } from "../../../env.js";
import { pickThumbUrl } from "../../../shared/application/images/cards.js";
import { normalizePublicAssetUrl } from "../../../platform/storage/publicUrls.js";

const TOPLIST_MIN_COMPARISONS = env.TOPLIST_MIN_COMPARISONS ?? 10;

export const parseRecentLimit = (rawLimit?: string) => {
  const parsed = Number(rawLimit ?? "4");
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, 12) : 4;
};

export const parseToplistQuery = (rawLimit?: string, rawMin?: string) => {
  const parsedLimit = Number(rawLimit ?? "50");
  const limit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, 100) : 50;
  const parsedMin = Number(rawMin ?? `${TOPLIST_MIN_COMPARISONS}`);
  const minComparisons =
    Number.isFinite(parsedMin) && parsedMin >= 0 ? parsedMin : TOPLIST_MIN_COMPARISONS;
  return { limit, minComparisons };
};

export const mapToplistRowsToHttp = (
  rows: Array<{
    id: string;
    score?: number;
    votes?: number;
    variantUrls?: unknown;
    originalUrl?: string;
  }>,
) =>
  rows.map((row) => ({
    id: row.id,
    score: row.score ?? 0,
    votes: row.votes ?? 0,
    thumb_url:
      pickThumbUrl(row.variantUrls) || normalizePublicAssetUrl(row.originalUrl || "") || "",
  }));
