import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import type { S3Client } from "@aws-sdk/client-s3";
import { createHash } from "crypto";
import sharp, { type Sharp } from "sharp";
import {
  mutateConvexCreateDedupeEvent,
  mutateConvexMarkImageRejected,
  mutateConvexMarkImageProcessingComplete,
  mutateConvexRecordImageFingerprint,
  queryConvexImageById,
  queryConvexImageFingerprintBySha256,
  queryConvexImageFingerprintsByPhashPrefix,
  queryConvexRecentImageFingerprints,
} from "../convex/client.js";
import { env } from "../../env.js";
import { verifyOrbCandidates } from "../../shared/application/images/orbVerifier.js";
import { publicObjectUrl, s3Client, storageBucket } from "../storage/client.js";
import { canonicalKey, variantKey } from "../storage/paths.js";
import type { ImageFormat, ImageSize } from "../storage/paths.js";
import { extractStorageObjectKey } from "../storage/publicUrls.js";
import {
  computeImageFingerprint,
  hammingDistanceHex,
} from "../../shared/domain/images/perceptualHash.js";

type FingerprintCandidate = {
  imageId: string;
  phash64?: string;
};

type ImageLookupRow = {
  imageId: string;
  originalUrl?: string;
  storageKeyCanonical?: string;
  variantUrls?: unknown;
};

type FullVariantUrls = {
  full?: {
    webp?: string;
    jpg?: string;
    png?: string;
  };
};

const getFullVariantUrl = (variantUrls: unknown): string => {
  if (!variantUrls || typeof variantUrls !== "object") return "";
  const urls = variantUrls as FullVariantUrls;
  return urls.full?.webp || urls.full?.jpg || urls.full?.png || "";
};
import {
  analyzeBorderCrop,
  applyBorderCrop,
  applyCropBox,
  detectEmbeddedImageRect,
} from "./borderCrop.js";
import { loadCropPipelineConfig, loadImageDedupeConfig } from "./imagePipelineConfig.js";
import type { ImageProcessJobData } from "./processorTypes.js";

const sizes: Record<ImageSize, number> = {
  thumb: 320,
  feed: 960,
  full: 1600,
};
const MAX_CROP_PASSES = 3;
const CANONICAL_MAX_DIM = 1536;

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

export type ImageProcessorDeps = {
  s3Client: Pick<S3Client, "send">;
  storageBucket: string;
  publicObjectUrl: (key: string) => string;
  variantKey: (imageId: string, size: ImageSize, format: ImageFormat) => string;
  mutateConvexMarkImageProcessingComplete: (args: {
    imageId: string;
    status: string;
    variantUrls?: unknown;
    storageKeyCanonical?: string;
    updatedAt?: number;
    publishedAt?: number;
  }) => Promise<unknown>;
  mutateConvexMarkImageRejected?: (args: {
    imageId: string;
    reason: string;
    matchedImageId?: string;
    scores?: unknown;
    updatedAt?: number;
  }) => Promise<unknown>;
  mutateConvexCreateDedupeEvent?: (args: {
    uploadImageId: string;
    decision: string;
    reason: string;
    matchedImageId?: string;
    scores?: unknown;
    metrics?: unknown;
    workerVersion?: string;
    createdAt?: number;
  }) => Promise<unknown>;
  queryConvexImageFingerprintBySha256?: (
    sha256Pixels: string,
  ) => Promise<FingerprintCandidate | null>;
  queryConvexImageFingerprintsByPhashPrefix?: (
    phashPrefix: string,
    limit?: number,
  ) => Promise<FingerprintCandidate[]>;
  queryConvexRecentImageFingerprints?: (limit?: number) => Promise<FingerprintCandidate[]>;
  mutateConvexRecordImageFingerprint?: (args: {
    imageId: string;
    sha256Pixels: string;
    phash64: string;
    phashPrefix: string;
    dhash64?: string;
    canonicalWidth?: number;
    canonicalHeight?: number;
    cropBox?: unknown;
    cropMeta?: unknown;
    workerVersion?: string;
    createdAt?: number;
  }) => Promise<unknown>;
  queryConvexImageById?: (imageId: string) => Promise<ImageLookupRow | null>;
};

const defaultImageDeps: ImageProcessorDeps = {
  s3Client,
  storageBucket,
  publicObjectUrl,
  variantKey,
  mutateConvexMarkImageProcessingComplete,
  mutateConvexMarkImageRejected,
  mutateConvexCreateDedupeEvent,
  queryConvexImageFingerprintBySha256,
  queryConvexImageFingerprintsByPhashPrefix,
  queryConvexRecentImageFingerprints,
  mutateConvexRecordImageFingerprint,
  queryConvexImageById,
};

const DEDUPE_WORKER_VERSION = "dedupe-v2-node-1";
const PHASH_PREFIX_LENGTH = 3;

const neighboringHexPrefixes = (prefix: string, radius: number) => {
  const width = prefix.length;
  const max = 16 ** width;
  const center = parseInt(prefix, 16);
  if (!Number.isFinite(center)) return [prefix];

  const seen = new Set<string>();
  for (let delta = -radius; delta <= radius; delta += 1) {
    const wrapped = (((center + delta) % max) + max) % max;
    seen.add(wrapped.toString(16).padStart(width, "0"));
  }
  return [...seen];
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
  const dedupeDepsReady =
    typeof deps.mutateConvexMarkImageRejected === "function" &&
    typeof deps.mutateConvexCreateDedupeEvent === "function" &&
    typeof deps.queryConvexImageFingerprintBySha256 === "function" &&
    typeof deps.queryConvexImageFingerprintsByPhashPrefix === "function" &&
    typeof deps.mutateConvexRecordImageFingerprint === "function";
  const imageDedupeConfig = loadImageDedupeConfig();
  const dedupeV2Enabled =
    ((data.dedupeV2 || imageDedupeConfig.dedupeV2Enabled) ?? false) && dedupeDepsReady;
  const {
    dedupeStrongThreshold,
    dedupeWeakThreshold,
    orbEnabled,
    orbForceAllCandidates,
    orbForceMaxCandidates,
    orbMinInlierRatio,
    orbMinInliers,
    orbMinMatches,
    orbRequired,
    orbRetries,
    orbSharedSecret,
    orbTimeoutMs,
    orbVerifierUrl,
    prefixRadius,
  } = imageDedupeConfig;
  const startedAt = Date.now();

  let sha256Pixels = "";
  if (dedupeV2Enabled) {
    let normalizedPipeline: Sharp = sharp(originalBuffer);
    if (typeof normalizedPipeline.rotate === "function") {
      normalizedPipeline = normalizedPipeline.rotate();
    }
    if (typeof normalizedPipeline.removeAlpha === "function") {
      normalizedPipeline = normalizedPipeline.removeAlpha();
    }
    if (typeof normalizedPipeline.toColorspace === "function") {
      normalizedPipeline = normalizedPipeline.toColorspace("srgb");
    }
    const normalized = await normalizedPipeline.raw().toBuffer({ resolveWithObject: true });
    sha256Pixels = createHash("sha256")
      .update(`${normalized.info.width}x${normalized.info.height}|`)
      .update(normalized.data)
      .digest("hex");
  }

  if (dedupeV2Enabled) {
    const exact = await deps.queryConvexImageFingerprintBySha256!(sha256Pixels);
    if (exact?.imageId && exact.imageId !== imageId) {
      await deps.mutateConvexMarkImageRejected!({
        imageId,
        reason: "sha256_exact",
        matchedImageId: exact.imageId,
        updatedAt: Date.now(),
      });
      await deps.mutateConvexCreateDedupeEvent!({
        uploadImageId: imageId,
        decision: "rejected",
        reason: "sha256_exact",
        matchedImageId: exact.imageId,
        workerVersion: DEDUPE_WORKER_VERSION,
        metrics: { durationMs: Date.now() - startedAt },
        createdAt: Date.now(),
      });
      await deps.s3Client.send(
        new DeleteObjectCommand({
          Bucket: deps.storageBucket,
          Key: key,
        }),
      );
      return;
    }
  }
  const fallbackFormat: ImageFormat = ext === "png" ? "png" : "jpg";
  const { rectOptions, borderOptions } = loadCropPipelineConfig();

  let workingBuffer: Buffer = originalBuffer;
  const rectDecision = await detectEmbeddedImageRect(workingBuffer, rectOptions);
  let cropMode = "none";
  let stageReasons: string[] = [rectDecision.reason];
  let stageConfidences: number[] = [];
  let globalLeft = 0;
  let globalTop = 0;

  if (rectDecision.applied) {
    workingBuffer = (await applyCropBox(workingBuffer, rectDecision.cropBox)) as Buffer;
    stageConfidences.push(rectDecision.confidence);
    globalLeft = rectDecision.cropBox.left;
    globalTop = rectDecision.cropBox.top;
    cropMode = "embedded_rect";
  }

  let cropDecision = await analyzeBorderCrop(workingBuffer, borderOptions);
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
    cropDecision = await analyzeBorderCrop(workingBuffer, borderOptions);
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

  if (dedupeV2Enabled) {
    const fingerprint = await computeImageFingerprint(workingBuffer);
    const phash64 = fingerprint.full;
    const dhash64 = fingerprint.inner;
    const phashPrefix = phash64.slice(0, PHASH_PREFIX_LENGTH);
    const prefixes = neighboringHexPrefixes(phashPrefix, Math.max(0, Math.floor(prefixRadius)));

    const grouped = await Promise.all(
      prefixes.map((prefix) => deps.queryConvexImageFingerprintsByPhashPrefix!(prefix, 100)),
    );
    const candidateMap = new Map<string, FingerprintCandidate>();
    for (const group of grouped) {
      for (const candidate of group) {
        if (!candidate?.imageId || candidate.imageId === imageId) continue;
        candidateMap.set(candidate.imageId, candidate);
      }
    }
    if (
      orbEnabled &&
      orbVerifierUrl &&
      typeof deps.queryConvexRecentImageFingerprints === "function"
    ) {
      const needsFallbackPool = orbForceAllCandidates || candidateMap.size < 25;
      if (needsFallbackPool) {
        const fallbackLimit = orbForceAllCandidates
          ? Math.max(1, Math.min(Math.floor(orbForceMaxCandidates), 10000))
          : 500;
        const recent = await deps.queryConvexRecentImageFingerprints(fallbackLimit);
        for (const candidate of recent) {
          if (!candidate?.imageId || candidate.imageId === imageId) continue;
          candidateMap.set(candidate.imageId, candidate);
        }
      }
    }

    const allCandidates = [...candidateMap.values()];
    const shortlist: Array<{ imageId: string; distance: number }> = [];
    for (const candidate of allCandidates) {
      if (!candidate?.phash64 || candidate.imageId === imageId) continue;
      const distance = hammingDistanceHex(phash64, candidate.phash64);
      if (!Number.isFinite(distance)) continue;
      if (!orbForceAllCandidates && distance > dedupeWeakThreshold) continue;
      shortlist.push({ imageId: candidate.imageId, distance });
    }
    shortlist.sort((a, b) => a.distance - b.distance);
    const bestMatch = shortlist[0] ?? null;

    if (
      orbEnabled &&
      orbVerifierUrl &&
      shortlist.length &&
      typeof deps.queryConvexImageById === "function"
    ) {
      try {
        const candidateRows = await Promise.all(
          shortlist
            .slice(
              0,
              orbForceAllCandidates
                ? Math.max(1, Math.min(Math.floor(orbForceMaxCandidates), 10000))
                : 25,
            )
            .map(async (entry) => {
              const row = await deps.queryConvexImageById!(entry.imageId);
              const fallbackUrl = getFullVariantUrl(row?.variantUrls) || row?.originalUrl || "";
              const storageKey =
                row?.storageKeyCanonical ||
                extractStorageObjectKey(fallbackUrl) ||
                extractStorageObjectKey(row?.originalUrl || "");

              if (storageKey) {
                try {
                  const candidateObject = await deps.s3Client.send(
                    new GetObjectCommand({
                      Bucket: deps.storageBucket,
                      Key: storageKey,
                    }),
                  );
                  const bytes = await toBuffer(candidateObject.Body);
                  return {
                    imageId: entry.imageId,
                    imageBase64: bytes.toString("base64"),
                  };
                } catch {
                  // Fall through to URL-based candidate.
                }
              }

              return fallbackUrl ? { imageId: entry.imageId, url: fallbackUrl } : null;
            }),
        );
        const orbCandidates = candidateRows.filter((item) =>
          Boolean(item?.url || item?.imageBase64),
        ) as Array<{
          imageId: string;
          url?: string;
          imageBase64?: string;
        }>;
        if (orbCandidates.length) {
          const orb = await verifyOrbCandidates({
            verifierUrl: orbVerifierUrl,
            uploadBuffer: workingBuffer,
            candidates: orbCandidates,
            minInliers: orbMinInliers,
            minInlierRatio: orbMinInlierRatio,
            minMatches: orbMinMatches,
            sharedSecret: orbSharedSecret || undefined,
            timeoutMs: Number.isFinite(orbTimeoutMs) ? orbTimeoutMs : 3500,
            retries: Number.isFinite(orbRetries) ? orbRetries : 2,
          });

          if (orb.verified && orb.matchedImageId) {
            await deps.mutateConvexMarkImageRejected!({
              imageId,
              reason: "orb_verified",
              matchedImageId: orb.matchedImageId,
              scores: orb.scores,
              updatedAt: Date.now(),
            });
            await deps.mutateConvexCreateDedupeEvent!({
              uploadImageId: imageId,
              decision: "rejected",
              reason: "orb_verified",
              matchedImageId: orb.matchedImageId,
              scores: orb.scores,
              workerVersion: DEDUPE_WORKER_VERSION,
              metrics: {
                durationMs: Date.now() - startedAt,
                candidateCount: allCandidates.length,
                shortlistCount: shortlist.length,
              },
              createdAt: Date.now(),
            });
            await deps.s3Client.send(
              new DeleteObjectCommand({
                Bucket: deps.storageBucket,
                Key: key,
              }),
            );
            return;
          }
        }
      } catch (error) {
        if (orbRequired) {
          throw error;
        }
        await deps.mutateConvexCreateDedupeEvent!({
          uploadImageId: imageId,
          decision: "accepted",
          reason: "orb_error_fallback",
          workerVersion: DEDUPE_WORKER_VERSION,
          metrics: {
            durationMs: Date.now() - startedAt,
            error: error instanceof Error ? error.message : String(error),
          },
          createdAt: Date.now(),
        });
      }
    }

    if (
      bestMatch &&
      (!orbEnabled || !orbVerifierUrl) &&
      bestMatch.distance <= dedupeStrongThreshold
    ) {
      await deps.mutateConvexMarkImageRejected!({
        imageId,
        reason: "phash_near_strong",
        matchedImageId: bestMatch.imageId,
        scores: { phashDistance: bestMatch.distance },
        updatedAt: Date.now(),
      });
      await deps.mutateConvexCreateDedupeEvent!({
        uploadImageId: imageId,
        decision: "rejected",
        reason: "phash_near",
        matchedImageId: bestMatch.imageId,
        scores: { phashDistance: bestMatch.distance },
        workerVersion: DEDUPE_WORKER_VERSION,
        metrics: {
          durationMs: Date.now() - startedAt,
          candidateCount: allCandidates.length,
          shortlistCount: shortlist.length,
        },
        createdAt: Date.now(),
      });
      await deps.s3Client.send(
        new DeleteObjectCommand({
          Bucket: deps.storageBucket,
          Key: key,
        }),
      );
      return;
    }

    await deps.mutateConvexRecordImageFingerprint!({
      imageId,
      sha256Pixels,
      phash64,
      phashPrefix,
      dhash64,
      canonicalWidth: cropBox.width,
      canonicalHeight: cropBox.height,
      cropBox,
      cropMeta: {
        reason: resolvedCropDecision.reason,
        mode: cropMode,
        confidence: Number(finalConfidence.toFixed(4)),
        stages: stageReasons,
      },
      workerVersion: DEDUPE_WORKER_VERSION,
      createdAt: Date.now(),
    });
    await deps.mutateConvexCreateDedupeEvent!({
      uploadImageId: imageId,
      decision: "accepted",
      reason: "accepted",
      workerVersion: DEDUPE_WORKER_VERSION,
      metrics: {
        durationMs: Date.now() - startedAt,
        candidateCount: allCandidates.length,
        shortlistCount: shortlist.length,
      },
      createdAt: Date.now(),
    });
  }

  const variantUrls: Record<string, Record<string, unknown>> = {};
  const canonicalResized = sharp(workingBuffer).resize({
    width: CANONICAL_MAX_DIM,
    height: CANONICAL_MAX_DIM,
    fit: "inside",
    withoutEnlargement: true,
  });
  const canonicalBuffer = await canonicalResized.clone().webp({ quality: 90 }).toBuffer();
  const canonicalStorageKey = canonicalKey(imageId);
  await deps.s3Client.send(
    new PutObjectCommand({
      Bucket: deps.storageBucket,
      Key: canonicalStorageKey,
      Body: canonicalBuffer,
      ContentType: "image/webp",
    }),
  );

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

  await deps.mutateConvexMarkImageProcessingComplete({
    imageId,
    status: "public",
    variantUrls,
    storageKeyCanonical: canonicalStorageKey,
    updatedAt: Date.now(),
    publishedAt: Date.now(),
  });
};
