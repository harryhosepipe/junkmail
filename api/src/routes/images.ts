import { PutObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";
import { and, eq, inArray } from "drizzle-orm";
import { Hono } from "hono";
import type { Context } from "hono";
import { db } from "../db/client.js";
import { images, ratings } from "../db/schema.js";
import { imageQueue } from "../queue/index.js";
import { redis } from "../queue/connection.js";
import { originalKey } from "../storage/paths.js";
import { publicObjectUrl, s3Client, storageBucket } from "../storage/client.js";
import {
  extractStorageObjectKey,
  normalizePublicAssetData,
  normalizePublicAssetUrl,
} from "../storage/publicUrls.js";
import { getSessionUser, requireUploader } from "../auth/session.js";
import { ensureSameOrigin } from "../auth/csrf.js";
import {
  mutateConvexCreateImageComment,
  queryConvexImageById,
  queryConvexImageComments,
  queryConvexRatingsByImageIds,
  queryConvexRecentPublicImages,
  queryConvexTopRatings,
} from "../convex/client.js";
import { resolveAuthUserProfileById } from "../auth/userProfile.js";
import { env } from "../env.js";

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png"] as const;
const TOPLIST_MIN_COMPARISONS = env.TOPLIST_MIN_COMPARISONS ?? 10;
const TOPLIST_CACHE_SECONDS = env.TOPLIST_CACHE_SECONDS ?? 90;
const COMMENT_MAX_LENGTH = 500;

const imagesRouter = new Hono();

const readPayload = async (c: Context) => {
  const contentType = c.req.header("content-type") || "";
  if (contentType.includes("application/json")) {
    try {
      return await c.req.json();
    } catch {
      return {};
    }
  }

  try {
    return await c.req.parseBody();
  } catch {
    return {};
  }
};

type ImageCard = {
  id: string;
  title: string | null;
  description: string | null;
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

const pickThumbUrl = (variantUrls: unknown) => {
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
  const rows = orderedIds.length
    ? await db
        .select({
          id: images.id,
          title: images.title,
          description: images.description,
          status: images.status,
          originalUrl: images.originalUrl,
          variantUrls: images.variantUrls,
          createdAt: images.createdAt,
        })
        .from(images)
        .where(and(eq(images.status, "public"), inArray(images.id, orderedIds)))
    : [];

  const rowById = new Map(rows.map((row) => [row.id, row]));
  const items = orderedIds
    .map((id) => {
      const row = rowById.get(id);
      if (!row) return null;
      const rating = ratingByImageId.get(id);
      return {
        ...row,
        originalUrl: normalizePublicAssetUrl(row.originalUrl),
        variantUrls: normalizePublicAssetData(row.variantUrls),
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

imagesRouter.post("/", requireUploader, async (c) => {
  const body = await c.req.parseBody();
  const upload = body.file;
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";

  if (!upload || typeof upload !== "object" || typeof upload.arrayBuffer !== "function") {
    return c.json({ error: { message: "File is required" } }, 400);
  }

  const size = (upload as { size?: number }).size ?? 0;
  const type = (upload as { type?: string }).type ?? "";

  if (!ACCEPTED_TYPES.includes(type as (typeof ACCEPTED_TYPES)[number])) {
    return c.json({ error: { message: "Only JPG and PNG are supported" } }, 415);
  }

  if (size > MAX_UPLOAD_BYTES) {
    return c.json({ error: { message: "File exceeds max size" } }, 413);
  }

  const ext = type === "image/png" ? "png" : "jpg";
  const imageId = randomUUID();
  const key = originalKey(imageId, ext);
  const data = Buffer.from(await upload.arrayBuffer());

  const authUser = (c as any).get("authUser") as { id: string; email?: string; alias?: string };

  await s3Client.send(
    new PutObjectCommand({
      Bucket: storageBucket,
      Key: key,
      Body: data,
      ContentType: type,
    }),
  );

  const originalUrl = publicObjectUrl(key);

  await db.insert(images).values({
    id: imageId,
    uploaderId: authUser.id,
    title: title.length ? title : null,
    description: description.length ? description : null,
    status: "processing",
    originalUrl,
    variantUrls: {},
  });

  await db.insert(ratings).values({
    imageId,
    score: 0,
    uncertainty: 1,
    comparisonsCount: 0,
  });

  console.info("[upload]", {
    imageId,
    uploaderId: authUser.id,
    uploaderEmail: authUser.email,
    uploaderAlias: authUser.alias,
  });

  await imageQueue.add(
    "process",
    {
      imageId,
      key,
      ext,
      contentType: type,
    },
    {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 5000,
      },
    },
  );

  return c.json(
    { id: imageId, status: "processing", originalUrl: normalizePublicAssetUrl(originalUrl) },
    201,
  );
});

imagesRouter.get("/recent", async (c) => {
  const rawLimit = Number(c.req.query("limit") ?? "4");
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 12) : 4;
  const rows = await fetchRecentImages(limit);

  return c.json({ items: rows });
});

imagesRouter.get("/top", async (c) => {
  const rawLimit = Number(c.req.query("limit") ?? "50");
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 100) : 50;
  const rawMin = Number(c.req.query("min") ?? `${TOPLIST_MIN_COMPARISONS}`);
  const minComparisons = Number.isFinite(rawMin) && rawMin >= 0 ? rawMin : TOPLIST_MIN_COMPARISONS;

  const rows = await fetchTopCards(limit, minComparisons);

  return c.json(
    rows.map((row) => ({
      id: row.id,
      score: row.score ?? 0,
      votes: row.votes ?? 0,
      thumb_url: pickThumbUrl(row.variantUrls) || normalizePublicAssetUrl(row.originalUrl) || "",
    })),
  );
});

imagesRouter.get("/:id", async (c) => {
  const imageId = c.req.param("id");
  const row = await queryConvexImageById(imageId);
  if (!row) {
    return c.json({ error: { message: "Image not found" } }, 404);
  }

  const [ratingRows, uploader, commentRows] = await Promise.all([
    queryConvexRatingsByImageIds([row.imageId]),
    resolveAuthUserProfileById(row.uploaderAuthUserId),
    queryConvexImageComments({ imageId: row.imageId, limit: 100 }),
  ]);
  const rating = ratingRows[0];

  return c.json({
    id: row.imageId,
    status: row.status,
    title: row.title ?? null,
    description: row.description ?? null,
    originalUrl: normalizePublicAssetUrl(row.originalUrl || ""),
    variantUrls: normalizePublicAssetData(row.variantUrls),
    createdAt: new Date(row.createdAt),
    uploaderEmail: uploader?.email ?? null,
    uploaderAlias: uploader?.alias ?? null,
    score: rating?.score ?? 0,
    votes: rating?.comparisonsCount ?? 0,
    comments: commentRows.map((comment) => ({
      id: comment.commentId,
      body: comment.body,
      createdAt: new Date(comment.createdAt),
      userId: comment.userAuthUserId,
      userAlias: comment.userAlias,
    })),
  });
});

imagesRouter.post("/:id/comments", async (c) => {
  const csrfError = ensureSameOrigin(c);
  if (csrfError) {
    return csrfError;
  }

  const user = await getSessionUser(c);
  if (!user) {
    return c.json({ error: { message: "Unauthorized" } }, 401);
  }

  const imageId = c.req.param("id");
  const imageRow = await queryConvexImageById(imageId);
  if (!imageRow) {
    return c.json({ error: { message: "Image not found" } }, 404);
  }

  const body = await readPayload(c);
  const text = typeof body.body === "string" ? body.body.trim() : "";
  if (!text) {
    return c.json({ error: { message: "Comment cannot be empty." } }, 400);
  }
  if (text.length > COMMENT_MAX_LENGTH) {
    return c.json(
      { error: { message: `Comment cannot exceed ${COMMENT_MAX_LENGTH} characters.` } },
      400,
    );
  }

  const commentId = randomUUID();
  const createdAt = Date.now();
  await mutateConvexCreateImageComment({
    commentId,
    imageId,
    userAuthUserId: user.id,
    userAlias: user.alias,
    body: text,
    createdAt,
  });

  return c.json(
    {
      comment: {
        id: commentId,
        body: text,
        createdAt: new Date(createdAt),
        userId: user.id,
        userAlias: user.alias,
      },
    },
    201,
  );
});

imagesRouter.post("/:id/reprocess", async (c) => {
  if (env.NODE_ENV === "production") {
    return c.json({ error: { message: "Not available" } }, 404);
  }

  const imageId = c.req.param("id");
  const result = await db
    .select({ originalUrl: images.originalUrl })
    .from(images)
    .where(eq(images.id, imageId))
    .limit(1);

  const originalUrl = result[0]?.originalUrl;
  if (!originalUrl) {
    return c.json({ error: { message: "Image not found" } }, 404);
  }

  const key = extractStorageObjectKey(originalUrl);
  if (!key) {
    return c.json({ error: { message: "Image storage key unavailable" } }, 422);
  }

  const ext = key.endsWith(".png") ? "png" : "jpg";
  const contentType = ext === "png" ? "image/png" : "image/jpeg";

  await db.update(images).set({ status: "processing" }).where(eq(images.id, imageId));

  await imageQueue.add(
    "process",
    {
      imageId,
      key,
      ext,
      contentType,
    },
    {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 5000,
      },
    },
  );

  return c.json({ ok: true });
});

export default imagesRouter;
