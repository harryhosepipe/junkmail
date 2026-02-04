import { PutObjectCommand } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { Hono } from "hono";
import { db } from "../db/client.js";
import { images, users } from "../db/schema.js";
import { imageQueue } from "../queue/index.js";
import { originalKey } from "../storage/paths.js";
import { publicObjectUrl, s3Client, storageBucket } from "../storage/client.js";

const MAX_UPLOAD_BYTES = 15 * 1024 * 1024;
const ACCEPTED_TYPES = ["image/jpeg", "image/png"] as const;

const imagesRouter = new Hono();

imagesRouter.post("/", async (c) => {
  const body = await c.req.parseBody();
  const upload = body.file;

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

  const uploaderId =
    typeof body.uploader_id === "string" && body.uploader_id.length
      ? body.uploader_id
      : null;

  let resolvedUploaderId = uploaderId;

  if (!resolvedUploaderId) {
    const uploader = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.role, "uploader"))
      .limit(1);

    resolvedUploaderId = uploader[0]?.id ?? null;
  }

  if (!resolvedUploaderId) {
    return c.json({ error: { message: "Uploader not found" } }, 400);
  }

  await s3Client.send(
    new PutObjectCommand({
      Bucket: storageBucket,
      Key: key,
      Body: data,
      ContentType: type
    })
  );

  const originalUrl = publicObjectUrl(key);

  await db.insert(images).values({
    id: imageId,
    uploaderId: resolvedUploaderId,
    status: "processing",
    originalUrl,
    variantUrls: {}
  });

  await imageQueue.add(
    "process",
    {
      imageId,
      key,
      ext,
      contentType: type
    },
    {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 5000
      }
    }
  );

  return c.json({ id: imageId, status: "processing", originalUrl }, 201);
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
      contentType
    },
    {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 5000
      }
    }
  );

  return c.json({ ok: true });
});

export default imagesRouter;
