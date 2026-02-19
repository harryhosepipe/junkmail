import { PutObjectCommand } from "@aws-sdk/client-s3";
import { createHash, randomUUID } from "crypto";
import { Hono } from "hono";
import { requireUploader } from "../auth/session.js";
import {
  mutateConvexRecordImageUploadProcessing,
  mutateConvexRecordImageUploadReceived,
  queryConvexDedupeStats,
  queryConvexImageByUploadId,
  queryConvexRecentDedupeEvents,
} from "../convex/client.js";
import { imageQueue } from "../queue/index.js";
import { validateUpload } from "../services/images/actions.js";
import { originalKey } from "../storage/paths.js";
import { publicObjectUrl, s3Client, storageBucket } from "../storage/client.js";
import { normalizePublicAssetUrl } from "../storage/publicUrls.js";

const uploadsRouter = new Hono();

uploadsRouter.post("/init", requireUploader, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const description = typeof body?.description === "string" ? body.description.trim() : "";
  const mime = typeof body?.mime === "string" ? body.mime.trim() : "";

  const authUser = (c as any).get("authUser") as { id: string };
  const uploadId = randomUUID();
  const imageId = randomUUID();
  const pending = await mutateConvexRecordImageUploadReceived({
    imageId,
    uploadId,
    uploaderAuthUserId: authUser.id,
    description: description || undefined,
    mime: mime || undefined,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  return c.json({
    uploadId,
    imageId: pending.imageId,
    status: "pending",
    upload: {
      mode: "multipart_complete",
      completeEndpoint: "/api/v1/uploads/complete",
      fields: ["uploadId", "file", "description"],
    },
  });
});

uploadsRouter.post("/complete", requireUploader, async (c) => {
  const body = await c.req.parseBody();
  const uploadId = typeof body.uploadId === "string" ? body.uploadId.trim() : "";
  if (!uploadId) {
    return c.json({ error: { message: "uploadId is required" } }, 400);
  }

  const pending = await queryConvexImageByUploadId(uploadId);
  if (!pending) {
    return c.json({ error: { message: "Upload not found" } }, 404);
  }

  if (pending.status === "public" || pending.status === "rejected") {
    return c.json({
      uploadId,
      imageId: pending.imageId,
      status: pending.status,
      matchedImageId: pending.matchedImageId ?? null,
      rejectReason: pending.rejectReason ?? null,
      originalUrl: normalizePublicAssetUrl(pending.originalUrl || ""),
    });
  }

  const uploadCheck = validateUpload(body.file);
  if (!uploadCheck.ok) {
    return c.json({ error: { message: uploadCheck.message } }, uploadCheck.status as any);
  }

  const description =
    typeof body.description === "string" ? body.description.trim() : pending.description || "";

  const data = Buffer.from(await uploadCheck.upload.arrayBuffer());
  const ext = uploadCheck.ext;
  const key = originalKey(pending.imageId, ext);
  await s3Client.send(
    new PutObjectCommand({
      Bucket: storageBucket,
      Key: key,
      Body: data,
      ContentType: uploadCheck.type,
    }),
  );

  const uploadHash = createHash("sha256").update(data).digest("hex");
  const originalUrl = publicObjectUrl(key);
  await mutateConvexRecordImageUploadProcessing({
    imageId: pending.imageId,
    uploadId,
    uploaderAuthUserId: pending.uploaderAuthUserId,
    description: description || undefined,
    status: "processing",
    uploadHash,
    originalUrl,
    storageKeyOriginal: key,
    mime: uploadCheck.type,
    variantUrls: {},
    updatedAt: Date.now(),
  });

  await imageQueue.add(
    "process",
    {
      imageId: pending.imageId,
      key,
      ext,
      contentType: uploadCheck.type,
      uploadId,
      dedupeV2: true,
    },
    {
      attempts: 3,
      backoff: {
        type: "exponential",
        delay: 5000,
      },
    },
  );

  return c.json({
    uploadId,
    imageId: pending.imageId,
    status: "processing",
  });
});

uploadsRouter.get("/:id/status", requireUploader, async (c) => {
  const uploadId = c.req.param("id");
  const row = await queryConvexImageByUploadId(uploadId);
  if (!row) {
    return c.json({ error: { message: "Upload not found" } }, 404);
  }

  return c.json({
    uploadId,
    imageId: row.imageId,
    status: row.status,
    category: row.category ?? null,
    rejectReason: row.rejectReason ?? null,
    matchedImageId: row.matchedImageId ?? null,
    dedupeScores: row.dedupeScores ?? null,
    originalUrl: normalizePublicAssetUrl(row.originalUrl || ""),
    variantUrls: row.variantUrls,
  });
});

uploadsRouter.get("/dedupe/stats", requireUploader, async (c) => {
  const rawWindow = Number(c.req.query("windowHours") ?? "24");
  const rawLimit = Number(c.req.query("sampleLimit") ?? "2000");
  const windowHours = Number.isFinite(rawWindow) ? rawWindow : 24;
  const sampleLimit = Number.isFinite(rawLimit) ? rawLimit : 2000;

  const stats = await queryConvexDedupeStats({
    windowHours,
    sampleLimit,
  });
  return c.json(stats);
});

uploadsRouter.get("/dedupe/events", requireUploader, async (c) => {
  const rawLimit = Number(c.req.query("limit") ?? "100");
  const limit = Number.isFinite(rawLimit) ? rawLimit : 100;
  const items = await queryConvexRecentDedupeEvents(limit);
  return c.json({ items });
});

export default uploadsRouter;
