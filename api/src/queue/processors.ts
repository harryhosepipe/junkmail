import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";
import {
  mutateConvexProjectVoteEvent,
  mutateConvexSetImageProcessingResult,
} from "../convex/client.js";
import { env } from "../env.js";
import { publicObjectUrl, s3Client, storageBucket } from "../storage/client.js";
import { ImageFormat, ImageSize, variantKey } from "../storage/paths.js";
import { analyzeBorderCrop, applyBorderCrop } from "./borderCrop.js";

export type ImageProcessJobData = {
  imageId: string;
  key: string;
  ext: "jpg" | "png";
  contentType: string;
};

export type VoteProcessJobData = {
  voteEventId: string;
  createdAt: number;
};

const sizes: Record<ImageSize, number> = {
  thumb: 320,
  feed: 960,
  full: 1600,
};

export const toBuffer = async (body: unknown) => {
  if (!body || typeof body !== "object") {
    throw new Error("Missing object body");
  }

  const chunks: Buffer[] = [];
  for await (const chunk of body as AsyncIterable<Uint8Array>) {
    chunks.push(Buffer.from(chunk));
  }

  return Buffer.concat(chunks);
};

type ImageProcessorDeps = {
  s3Client: { send: (command: any) => Promise<any> };
  storageBucket: string;
  publicObjectUrl: (key: string) => string;
  variantKey: (imageId: string, size: ImageSize, format: ImageFormat) => string;
  mutateConvexSetImageProcessingResult: (args: {
    imageId: string;
    status: string;
    variantUrls?: unknown;
    updatedAt?: number;
    publishedAt?: number;
  }) => Promise<unknown>;
};

const defaultImageDeps: ImageProcessorDeps = {
  s3Client,
  storageBucket,
  publicObjectUrl,
  variantKey,
  mutateConvexSetImageProcessingResult,
};

export const processImageJob = async (
  data: ImageProcessJobData,
  deps: ImageProcessorDeps = defaultImageDeps,
) => {
  const { imageId, key, ext, contentType } = data;

  const original = await deps.s3Client.send(
    new GetObjectCommand({
      Bucket: deps.storageBucket,
      Key: key,
    }),
  );

  const originalBuffer = await toBuffer(original.Body);
  const fallbackFormat: ImageFormat = ext === "png" ? "png" : "jpg";

  const cropDecision = await analyzeBorderCrop(originalBuffer, {
    enabled: env.IMAGE_CROP_ENABLED ?? true,
    analysisMaxDim: env.IMAGE_CROP_ANALYSIS_MAX_DIM ?? 512,
    whiteThreshold: env.IMAGE_CROP_WHITE_THRESHOLD ?? 248,
    blackThreshold: env.IMAGE_CROP_BLACK_THRESHOLD ?? 8,
    lineDominance: env.IMAGE_CROP_LINE_DOMINANCE ?? 0.985,
    lineStdDevMax: env.IMAGE_CROP_LINE_STDDEV_MAX ?? 16,
    maxTrimRatioPerSide: env.IMAGE_CROP_MAX_TRIM_RATIO_PER_SIDE ?? 0.18,
    minRemainingRatio: env.IMAGE_CROP_MIN_REMAINING_RATIO ?? 0.5,
    minConfidence: env.IMAGE_CROP_MIN_CONFIDENCE ?? 0.8,
    minTrimPixels: env.IMAGE_CROP_MIN_TRIM_PIXELS ?? 10,
    minAreaRemovedRatio: env.IMAGE_CROP_MIN_AREA_REMOVED_RATIO ?? 0.01,
  });
  const workingBuffer = await applyBorderCrop(originalBuffer, cropDecision);
  const cropBox = cropDecision.cropBox;

  console.info("[image-crop]", {
    imageId,
    applied: cropDecision.applied,
    reason: cropDecision.reason,
    confidence: Number(cropDecision.confidence.toFixed(4)),
    originalWidth: cropDecision.originalWidth,
    originalHeight: cropDecision.originalHeight,
    trimmed: cropDecision.trimmed,
    cropBox,
  });

  const variantUrls: Record<string, Record<string, unknown>> = {};

  // Generate three display sizes and three formats per size so web clients can
  // choose the best format they support without extra server branching.
  for (const size of Object.keys(sizes) as ImageSize[]) {
    const width = sizes[size];
    const resized = sharp(workingBuffer).resize({ width, withoutEnlargement: true });

    const avifBuffer = await resized.clone().avif({ quality: 60 }).toBuffer();
    const webpBuffer = await resized.clone().webp({ quality: 70 }).toBuffer();

    const fallbackBuffer =
      fallbackFormat === "png"
        ? await resized.clone().png({ compressionLevel: 9 }).toBuffer()
        : await resized.clone().jpeg({ quality: 80 }).toBuffer();

    const avifKey = deps.variantKey(imageId, size, "avif");
    const webpKey = deps.variantKey(imageId, size, "webp");
    const fallbackKey = deps.variantKey(imageId, size, fallbackFormat);

    await deps.s3Client.send(
      new PutObjectCommand({
        Bucket: deps.storageBucket,
        Key: avifKey,
        Body: avifBuffer,
        ContentType: "image/avif",
      }),
    );

    await deps.s3Client.send(
      new PutObjectCommand({
        Bucket: deps.storageBucket,
        Key: webpKey,
        Body: webpBuffer,
        ContentType: "image/webp",
      }),
    );

    await deps.s3Client.send(
      new PutObjectCommand({
        Bucket: deps.storageBucket,
        Key: fallbackKey,
        Body: fallbackBuffer,
        ContentType: contentType,
      }),
    );

    variantUrls[size] = {
      width,
      avif: deps.publicObjectUrl(avifKey),
      webp: deps.publicObjectUrl(webpKey),
      [fallbackFormat]: deps.publicObjectUrl(fallbackKey),
      cropApplied: cropDecision.applied,
      cropConfidence: Number(cropDecision.confidence.toFixed(4)),
      cropReason: cropDecision.reason,
      cropBox,
    };
  }

  await deps.mutateConvexSetImageProcessingResult({
    imageId,
    status: "public",
    variantUrls,
    updatedAt: Date.now(),
    publishedAt: Date.now(),
  });
};

type VoteProcessorDeps = {
  mutateConvexProjectVoteEvent: (args: { voteEventId: string; now?: number }) => Promise<unknown>;
};

const defaultVoteDeps: VoteProcessorDeps = {
  mutateConvexProjectVoteEvent,
};

export const processVoteJob = async (
  data: VoteProcessJobData,
  deps: VoteProcessorDeps = defaultVoteDeps,
) => {
  await deps.mutateConvexProjectVoteEvent({
    voteEventId: data.voteEventId,
    now: data.createdAt,
  });
};
