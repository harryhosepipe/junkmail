import {
  queryConvexPublicImagesByIds,
  queryConvexRatingsByImageIds,
  queryConvexRecentPublicImages,
  queryConvexTopRatings,
} from "../../convex/client.js";
import { env } from "../../env.js";
import { redis } from "../../queue/connection.js";
import { normalizePublicAssetData, normalizePublicAssetUrl } from "../../storage/publicUrls.js";

const TOPLIST_MIN_COMPARISONS = env.TOPLIST_MIN_COMPARISONS ?? 10;
const TOPLIST_CACHE_SECONDS = env.TOPLIST_CACHE_SECONDS ?? 90;

export type ImageCard = {
  id: string;
  title: string | null;
  description: string | null;
  category: string | null;
  status: string;
  originalUrl: string;
  variantUrls: unknown;
  createdAt: Date;
  score: number;
  votes: number;
};

const pickVariantUrl = (variant: unknown) => {
  if (!variant) return "";
  if (typeof variant === "string") return variant;
  const map = variant as { webp?: string; avif?: string; jpg?: string; png?: string };
  return map.webp || map.avif || map.jpg || map.png || "";
};

export const pickThumbUrl = (variantUrls: unknown) => {
  if (!variantUrls || typeof variantUrls !== "object") return "";
  const variants = variantUrls as Record<string, unknown>;
  return (
    pickVariantUrl(variants.thumb) ||
    pickVariantUrl(variants.feed) ||
    pickVariantUrl(variants.full) ||
    ""
  );
};

export const fetchRecentImages = async (limit: number) => {
  const rows = await queryConvexRecentPublicImages(limit);

  const ratingRows = await queryConvexRatingsByImageIds(rows.map((row) => row.imageId));
  const ratingByImageId = new Map(
    ratingRows.map((rating) => [
      rating.imageId,
      {
        score: rating.score ?? 0,
        comparisonsCount: rating.comparisonsCount ?? 0,
      },
    ]),
  );

  return rows.map(
    (row): ImageCard => ({
      id: row.imageId,
      title: row.title ?? null,
      description: row.description ?? null,
      category: row.category ?? null,
      status: row.status,
      originalUrl: normalizePublicAssetUrl(row.originalUrl || ""),
      variantUrls: normalizePublicAssetData(row.variantUrls),
      createdAt: new Date(row.createdAt),
      score: ratingByImageId.get(row.imageId)?.score ?? 0,
      votes: ratingByImageId.get(row.imageId)?.comparisonsCount ?? 0,
    }),
  );
};

export const fetchTopCards = async (limit: number, minComparisons = TOPLIST_MIN_COMPARISONS) => {
  const cacheKey = `toplist:${minComparisons}:${limit}`;
  if (TOPLIST_CACHE_SECONDS > 0) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached) as ImageCard[];
      }
    } catch {
      // ignore cache errors
    }
  }

  const topRatings = await queryConvexTopRatings({
    limit,
    minComparisons,
  });
  const ratingByImageId = new Map(
    topRatings.map((rating) => [
      rating.imageId,
      {
        score: rating.score ?? 0,
        comparisonsCount: rating.comparisonsCount ?? 0,
      },
    ]),
  );
  const orderedIds = topRatings.map((rating) => rating.imageId);
  const rows = orderedIds.length ? await queryConvexPublicImagesByIds(orderedIds) : [];

  const rowById = new Map(rows.map((row) => [row.imageId, row]));
  const items = orderedIds
    .map((id) => {
      const row = rowById.get(id);
      if (!row) return null;
      const rating = ratingByImageId.get(id);
      return {
        id: row.imageId,
        title: row.title ?? null,
        description: row.description ?? null,
        category: row.category ?? null,
        status: row.status,
        originalUrl: normalizePublicAssetUrl(row.originalUrl || ""),
        variantUrls: normalizePublicAssetData(row.variantUrls),
        createdAt: new Date(row.createdAt),
        score: rating?.score ?? 0,
        votes: rating?.comparisonsCount ?? 0,
      } as ImageCard;
    })
    .filter((row): row is ImageCard => Boolean(row));

  if (TOPLIST_CACHE_SECONDS > 0) {
    try {
      await redis.set(cacheKey, JSON.stringify(items), "EX", TOPLIST_CACHE_SECONDS);
    } catch {
      // ignore cache errors
    }
  }

  return items;
};
