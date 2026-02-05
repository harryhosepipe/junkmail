import { PutObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";
import { and, desc, eq, sql } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db/client.js";
import { images, ratings, users } from "../db/schema.js";
import { imageQueue } from "../queue/index.js";
import { redis } from "../queue/connection.js";
import { originalKey } from "../storage/paths.js";
import { publicObjectUrl, s3Client, storageBucket } from "../storage/client.js";
import { requireUploader } from "../auth/session.js";

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png"] as const;
const TOPLIST_MIN_COMPARISONS = Number(process.env.TOPLIST_MIN_COMPARISONS) || 10;
const TOPLIST_CACHE_SECONDS = Number(process.env.TOPLIST_CACHE_SECONDS) || 90;

const imagesRouter = new Hono();

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
  const scoreExpr = sql<number>`coalesce(${ratings.score}, 0)`;
  const comparisonsExpr = sql<number>`coalesce(${ratings.comparisonsCount}, 0)`;
  const rows = await db
    .select({
      id: images.id,
      title: images.title,
      description: images.description,
      status: images.status,
      originalUrl: images.originalUrl,
      variantUrls: images.variantUrls,
      createdAt: images.createdAt,
      score: scoreExpr,
      comparisonsCount: comparisonsExpr,
    })
    .from(images)
    .leftJoin(ratings, eq(images.id, ratings.imageId))
    .where(eq(images.status, "public"))
    .orderBy(desc(images.createdAt))
    .limit(limit);

  return rows.map((row) => ({
    ...row,
    score: row.score ?? 0,
    votes: row.comparisonsCount ?? 0,
  }));
};

export const fetchTopCards = async (limit: number, minComparisons = TOPLIST_MIN_COMPARISONS) => {
  const cacheKey = `toplist:${minComparisons}:${limit}`;
  if (TOPLIST_CACHE_SECONDS > 0) {
    try {
      const cached = await redis.get(cacheKey);
      if (cached) {
        return JSON.parse(cached) as Array<Record<string, unknown>>;
      }
    } catch {
      // ignore cache errors
    }
  }

  const scoreExpr = sql<number>`coalesce(${ratings.score}, 0)`;
  const comparisonsExpr = sql<number>`coalesce(${ratings.comparisonsCount}, 0)`;

  const rows = await db
    .select({
      id: images.id,
      title: images.title,
      description: images.description,
      status: images.status,
      originalUrl: images.originalUrl,
      variantUrls: images.variantUrls,
      createdAt: images.createdAt,
      score: scoreExpr,
      comparisonsCount: comparisonsExpr,
    })
    .from(images)
    .leftJoin(ratings, eq(images.id, ratings.imageId))
    .where(and(eq(images.status, "public"), sql`${comparisonsExpr} >= ${minComparisons}`))
    .orderBy(desc(scoreExpr))
    .limit(limit);

  const items = rows.map((row) => ({
    ...row,
    score: row.score ?? 0,
    votes: row.comparisonsCount ?? 0,
  }));

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

  const authUser = (c as any).get("authUser") as { id: string; email?: string };

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

  return c.json({ id: imageId, status: "processing", originalUrl }, 201);
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
      thumb_url: pickThumbUrl(row.variantUrls) || row.originalUrl || "",
    })),
  );
});

imagesRouter.get("/:id", async (c) => {
  const imageId = c.req.param("id");
  const scoreExpr = sql<number>`coalesce(${ratings.score}, 0)`;
  const comparisonsExpr = sql<number>`coalesce(${ratings.comparisonsCount}, 0)`;
  const result = await db
    .select({
      id: images.id,
      status: images.status,
      title: images.title,
      description: images.description,
      originalUrl: images.originalUrl,
      variantUrls: images.variantUrls,
      createdAt: images.createdAt,
      uploaderEmail: users.email,
      score: scoreExpr,
      comparisonsCount: comparisonsExpr,
    })
    .from(images)
    .leftJoin(users, eq(images.uploaderId, users.id))
    .leftJoin(ratings, eq(images.id, ratings.imageId))
    .where(eq(images.id, imageId))
    .limit(1);

  const row = result[0];
  if (!row) {
    return c.json({ error: { message: "Image not found" } }, 404);
  }

  return c.json({
    id: row.id,
    status: row.status,
    title: row.title,
    description: row.description,
    originalUrl: row.originalUrl,
    variantUrls: row.variantUrls,
    createdAt: row.createdAt,
    uploaderEmail: row.uploaderEmail,
    score: row.score ?? 0,
    votes: row.comparisonsCount ?? 0,
  });
});

imagesRouter.post("/:id/reprocess", async (c) => {
  if (process.env.NODE_ENV === "production") {
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

  const url = new URL(originalUrl);
  const prefix = `/${storageBucket}/`;
  const key = url.pathname.startsWith(prefix)
    ? url.pathname.slice(prefix.length)
    : url.pathname.replace(/^\/+/, "");

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
