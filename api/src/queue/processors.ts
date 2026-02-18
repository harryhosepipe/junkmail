import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import sharp from "sharp";
import {
  mutateConvexProjectVoteEvent,
  mutateConvexSetImageProcessingResult,
} from "../convex/client.js";
import { env } from "../env.js";
import { publicObjectUrl, s3Client, storageBucket } from "../storage/client.js";
import { ImageFormat, ImageSize, variantKey } from "../storage/paths.js";
import {
  analyzeBorderCrop,
  applyBorderCrop,
  applyCropBox,
  detectEmbeddedImageRect,
} from "./borderCrop.js";

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
const MAX_CROP_PASSES = 3;

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
  const rectOptions = {
    enabled: env.IMAGE_CROP_RECT_DETECT_ENABLED ?? true,
    analysisMaxDim: env.IMAGE_CROP_RECT_ANALYSIS_MAX_DIM ?? 640,
    minAreaRatio: env.IMAGE_CROP_RECT_MIN_AREA_RATIO ?? 0.16,
    minConfidence: env.IMAGE_CROP_RECT_MIN_CONFIDENCE ?? 0.56,
    minAspectRatio: env.IMAGE_CROP_RECT_ASPECT_MIN ?? 0.45,
    maxAspectRatio: env.IMAGE_CROP_RECT_ASPECT_MAX ?? 2.4,
    rowForegroundRatio: env.IMAGE_CROP_RECT_ROW_FOREGROUND_RATIO ?? 0.12,
    colForegroundRatio: env.IMAGE_CROP_RECT_COL_FOREGROUND_RATIO ?? 0.12,
    colorDistanceThreshold: env.IMAGE_CROP_RECT_COLOR_DISTANCE ?? 26,
    lumaDistanceThreshold: env.IMAGE_CROP_RECT_LUMA_DISTANCE ?? 20,
    centerWeight: env.IMAGE_CROP_RECT_CENTER_WEIGHT ?? 0.35,
  };
  const cropOptions = {
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
  };

  let workingBuffer: Buffer = originalBuffer;
  const rectDecision = await detectEmbeddedImageRect(workingBuffer, rectOptions);
  let cropMode = "none";
  let stageReasons: string[] = [rectDecision.reason];
  let stageConfidences: number[] = [];
  let globalLeft = 0;
  let globalTop = 0;
  let globalWidth = rectDecision.originalWidth;
  let globalHeight = rectDecision.originalHeight;

  if (rectDecision.applied) {
    workingBuffer = (await applyCropBox(workingBuffer, rectDecision.cropBox)) as Buffer;
    stageConfidences.push(rectDecision.confidence);
    globalLeft = rectDecision.cropBox.left;
    globalTop = rectDecision.cropBox.top;
    globalWidth = rectDecision.cropBox.width;
    globalHeight = rectDecision.cropBox.height;
    cropMode = "embedded_rect";
  }

  let cropDecision = await analyzeBorderCrop(workingBuffer, cropOptions);
  const cropConfidenceSamples: number[] = [];
  let cropPasses = 0;
  let borderAppliedReason = "";
  let borderLocalLeft = 0;
  let borderLocalTop = 0;
  let borderLocalWidth = cropDecision.originalWidth;
  let borderLocalHeight = cropDecision.originalHeight;

  while (cropDecision.applied && cropPasses < MAX_CROP_PASSES) {
    borderAppliedReason = cropDecision.reason;
    cropConfidenceSamples.push(cropDecision.confidence);
    borderLocalLeft += cropDecision.cropBox.left;
    borderLocalTop += cropDecision.cropBox.top;
    borderLocalWidth = cropDecision.cropBox.width;
    borderLocalHeight = cropDecision.cropBox.height;
    workingBuffer = (await applyBorderCrop(workingBuffer, cropDecision)) as Buffer;
    cropPasses += 1;

    if (cropPasses >= MAX_CROP_PASSES) break;
    cropDecision = await analyzeBorderCrop(workingBuffer, cropOptions);
  }

  const finalCropDecision = cropPasses
    ? {
        applied: true,
        reason: cropPasses > 1 ? "bar-applied-multi-pass" : "bar-applied",
        confidence:
          cropConfidenceSamples.reduce((sum, value) => sum + value, 0) /
          cropConfidenceSamples.length,
        originalWidth: rectDecision.originalWidth,
        originalHeight: rectDecision.originalHeight,
        cropBox: {
          left: globalLeft + borderLocalLeft,
          top: globalTop + borderLocalTop,
          width: borderLocalWidth,
          height: borderLocalHeight,
        },
        trimmed: {
          top: globalTop + borderLocalTop,
          right: rectDecision.originalWidth - (globalLeft + borderLocalLeft) - borderLocalWidth,
          bottom: rectDecision.originalHeight - (globalTop + borderLocalTop) - borderLocalHeight,
          left: globalLeft + borderLocalLeft,
        },
      }
    : {
        ...cropDecision,
        cropBox: {
          left: globalLeft + cropDecision.cropBox.left,
          top: globalTop + cropDecision.cropBox.top,
          width: cropDecision.cropBox.width,
          height: cropDecision.cropBox.height,
        },
        trimmed: {
          top: globalTop + cropDecision.trimmed.top,
          right:
            rectDecision.originalWidth -
            (globalLeft + cropDecision.cropBox.left) -
            cropDecision.cropBox.width,
          bottom:
            rectDecision.originalHeight -
            (globalTop + cropDecision.cropBox.top) -
            cropDecision.cropBox.height,
          left: globalLeft + cropDecision.trimmed.left,
        },
      };
  const rectOnlyApplied = rectDecision.applied && cropPasses === 0;
  const resolvedCropDecision = rectOnlyApplied
    ? {
        applied: true,
        reason: "rect-applied",
        confidence: rectDecision.confidence,
        originalWidth: rectDecision.originalWidth,
        originalHeight: rectDecision.originalHeight,
        cropBox: rectDecision.cropBox,
        trimmed: {
          top: rectDecision.cropBox.top,
          right:
            rectDecision.originalWidth - rectDecision.cropBox.left - rectDecision.cropBox.width,
          bottom:
            rectDecision.originalHeight - rectDecision.cropBox.top - rectDecision.cropBox.height,
          left: rectDecision.cropBox.left,
        },
      }
    : finalCropDecision;
  if (cropPasses > 0 && rectDecision.applied) {
    cropMode = "embedded_rect_then_border";
  } else if (cropPasses > 0) {
    cropMode = "border_only";
  }
  if (rectDecision.applied && cropPasses === 0) {
    stageReasons.push("bar-skipped-after-rect");
  } else {
    stageReasons.push(
      cropPasses > 0 ? borderAppliedReason || cropDecision.reason : cropDecision.reason,
    );
  }
  if (cropPasses > 0) {
    stageConfidences.push(
      cropConfidenceSamples.reduce((sum, value) => sum + value, 0) / cropConfidenceSamples.length,
    );
  }
  const cropBox = resolvedCropDecision.cropBox;
  const finalConfidence = stageConfidences.length
    ? stageConfidences.reduce((sum, value) => sum + value, 0) / stageConfidences.length
    : resolvedCropDecision.confidence;

  console.info("[image-crop]", {
    imageId,
    applied: resolvedCropDecision.applied,
    reason: resolvedCropDecision.reason,
    passes: cropPasses,
    confidence: Number(resolvedCropDecision.confidence.toFixed(4)),
    originalWidth: resolvedCropDecision.originalWidth,
    originalHeight: resolvedCropDecision.originalHeight,
    trimmed: resolvedCropDecision.trimmed,
    cropBox,
    cropMode,
    stageReasons,
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
      cropApplied: resolvedCropDecision.applied,
      cropConfidence: Number(finalConfidence.toFixed(4)),
      cropReason: resolvedCropDecision.reason,
      cropMode,
      cropStages: stageReasons,
      cropPasses,
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
