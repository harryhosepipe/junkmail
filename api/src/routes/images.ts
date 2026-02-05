import { PutObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";
import { desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db/client.js";
import { images, ratings, users } from "../db/schema.js";
import { imageQueue } from "../queue/index.js";
import { originalKey } from "../storage/paths.js";
import { publicObjectUrl, s3Client, storageBucket } from "../storage/client.js";
import { requireUploader } from "../auth/session.js";

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png"] as const;

const imagesRouter = new Hono();

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

  const rows = await db
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
    .where(eq(images.status, "public"))
    .orderBy(desc(images.createdAt))
    .limit(limit);

  return c.json({ items: rows });
});

imagesRouter.get("/:id", async (c) => {
  const imageId = c.req.param("id");
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
    })
    .from(images)
    .leftJoin(users, eq(images.uploaderId, users.id))
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
