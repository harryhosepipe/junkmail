import { PutObjectCommand } from "@aws-sdk/client-s3";
import { createHash, randomUUID } from "crypto";
import {
  mutateConvexRecordImageUploadProcessing,
  mutateConvexRecordImageUploadReceived,
  queryConvexDedupeStats,
  queryConvexImageByUploadId,
  queryConvexRecentDedupeEvents,
} from "../../convex/client.js";
import { imageQueue } from "../../queue/index.js";
import { validateUpload } from "../images/actions.js";
import { originalKey } from "../../storage/paths.js";
import { publicObjectUrl, s3Client, storageBucket } from "../../storage/client.js";
import { normalizePublicAssetUrl } from "../../storage/publicUrls.js";

type HttpResponse = {
  status: number;
  body: Record<string, unknown>;
};

export const initUpload = async (args: {
  authUserId: string;
  description?: string;
  mime?: string;
}): Promise<HttpResponse> => {
  const description = args.description?.trim() || "";
  const mime = args.mime?.trim() || "";
  const uploadId = randomUUID();
  const imageId = randomUUID();
  const pending = await mutateConvexRecordImageUploadReceived({
    imageId,
    uploadId,
    uploaderAuthUserId: args.authUserId,
    description: description || undefined,
    mime: mime || undefined,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  return {
    status: 200,
    body: {
      uploadId,
      imageId: pending.imageId,
      status: "pending",
      upload: {
        mode: "multipart_complete",
        completeEndpoint: "/api/v1/uploads/complete",
        fields: ["uploadId", "file", "description"],
      },
    },
  };
};

export const completeUpload = async (body: Record<string, unknown>): Promise<HttpResponse> => {
  const uploadId = typeof body.uploadId === "string" ? body.uploadId.trim() : "";
  if (!uploadId) {
    return { status: 400, body: { error: { message: "uploadId is required" } } };
  }

  const pending = await queryConvexImageByUploadId(uploadId);
  if (!pending) {
    return { status: 404, body: { error: { message: "Upload not found" } } };
  }

  if (pending.status === "public" || pending.status === "rejected") {
    return {
      status: 200,
      body: {
        uploadId,
        imageId: pending.imageId,
        status: pending.status,
        matchedImageId: pending.matchedImageId ?? null,
        rejectReason: pending.rejectReason ?? null,
        originalUrl: normalizePublicAssetUrl(pending.originalUrl || ""),
      },
    };
  }

  const uploadCheck = validateUpload(body.file);
  if (!uploadCheck.ok) {
    return { status: uploadCheck.status, body: { error: { message: uploadCheck.message } } };
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

  return {
    status: 200,
    body: {
      uploadId,
      imageId: pending.imageId,
      status: "processing",
    },
  };
};

export const getUploadStatus = async (uploadId: string): Promise<HttpResponse> => {
  const row = await queryConvexImageByUploadId(uploadId);
  if (!row) {
    return { status: 404, body: { error: { message: "Upload not found" } } };
  }

  return {
    status: 200,
    body: {
      uploadId,
      imageId: row.imageId,
      status: row.status,
      category: row.category ?? null,
      rejectReason: row.rejectReason ?? null,
      matchedImageId: row.matchedImageId ?? null,
      dedupeScores: row.dedupeScores ?? null,
      originalUrl: normalizePublicAssetUrl(row.originalUrl || ""),
      variantUrls: row.variantUrls,
    },
  };
};

export const getDedupeStats = async (rawWindow?: string, rawLimit?: string) => {
  const parsedWindow = Number(rawWindow ?? "24");
  const parsedLimit = Number(rawLimit ?? "2000");
  const windowHours = Number.isFinite(parsedWindow) ? parsedWindow : 24;
  const sampleLimit = Number.isFinite(parsedLimit) ? parsedLimit : 2000;
  return queryConvexDedupeStats({ windowHours, sampleLimit });
};

export const getRecentDedupeEvents = async (rawLimit?: string) => {
  const parsedLimit = Number(rawLimit ?? "100");
  const limit = Number.isFinite(parsedLimit) ? parsedLimit : 100;
  return queryConvexRecentDedupeEvents(limit);
};
