import { z } from "zod";
import type { BorderCropOptions, EmbeddedRectOptions } from "./borderCrop.js";

export type CropPipelineConfig = {
  rectOptions: EmbeddedRectOptions;
  borderOptions: BorderCropOptions;
};

export type ImageDedupeConfig = {
  dedupeV2Enabled: boolean;
  orbEnabled: boolean;
  orbRequired: boolean;
  orbVerifierUrl: string;
  orbSharedSecret: string;
  orbTimeoutMs: number;
  orbRetries: number;
  orbMinInliers: number;
  orbMinInlierRatio: number;
  orbMinMatches: number;
  orbForceAllCandidates: boolean;
  orbForceMaxCandidates: number;
  dedupeStrongThreshold: number;
  dedupeWeakThreshold: number;
  prefixRadius: number;
};

const NumFromString = z.coerce.number();
const BoolFromString = z
  .string()
  .transform((value) => value.toLowerCase())
  .pipe(z.enum(["true", "false"]))
  .transform((value) => value === "true");

const OptionalNum = NumFromString.optional();
const OptionalBool = BoolFromString.optional();
const OptionalUrl = z.string().url().optional();
const OptionalString = z.string().optional();

// Code owns these defaults. Env is only an optional override surface for this feature.
const defaultCropPipelineConfig: CropPipelineConfig = {
  rectOptions: {
    enabled: true,
    analysisMaxDim: 640,
    minAreaRatio: 0.16,
    minConfidence: 0.56,
    minAspectRatio: 0.45,
    maxAspectRatio: 2.4,
    rowForegroundRatio: 0.12,
    colForegroundRatio: 0.12,
    colorDistanceThreshold: 26,
    lumaDistanceThreshold: 20,
    centerWeight: 0.35,
    textGuardEnabled: true,
    textGuardMinMarginPixels: 10,
    textGuardMinSignalPixels: 14,
    textGuardMinorityPixelMinRatio: 0.001,
    textGuardMinorityPixelMaxRatio: 0.25,
    textGuardMinBoundaryRatio: 0.1,
    textGuardContrastDelta: 44,
  },
  borderOptions: {
    enabled: true,
    analysisMaxDim: 512,
    whiteThreshold: 248,
    blackThreshold: 8,
    lineDominance: 0.985,
    lineStdDevMax: 16,
    maxTrimRatioPerSide: 0.18,
    minRemainingRatio: 0.5,
    minConfidence: 0.8,
    minTrimPixels: 10,
    minAreaRemovedRatio: 0.01,
    textGuardEnabled: true,
    textGuardMinorityPixelMinRatio: 0.001,
    textGuardMinorityPixelMaxRatio: 0.2,
    textGuardMinTransitionRatio: 0.38,
    textGuardMinSignalPixels: 10,
    textGuardLumaOffset: 24,
  },
};

const defaultImageDedupeConfig: ImageDedupeConfig = {
  dedupeV2Enabled: true,
  orbEnabled: false,
  orbRequired: false,
  orbVerifierUrl: "http://localhost:9090/verify/orb",
  orbSharedSecret: "",
  orbTimeoutMs: 3500,
  orbRetries: 2,
  orbMinInliers: 20,
  orbMinInlierRatio: 0.25,
  orbMinMatches: 60,
  orbForceAllCandidates: false,
  orbForceMaxCandidates: 10000,
  dedupeStrongThreshold: 8,
  dedupeWeakThreshold: 14,
  prefixRadius: 2,
};

const cropOverrideSchema = z.object({
  IMAGE_CROP_ENABLED: OptionalBool,
  IMAGE_CROP_ANALYSIS_MAX_DIM: OptionalNum,
  IMAGE_CROP_WHITE_THRESHOLD: OptionalNum,
  IMAGE_CROP_BLACK_THRESHOLD: OptionalNum,
  IMAGE_CROP_LINE_DOMINANCE: OptionalNum,
  IMAGE_CROP_LINE_STDDEV_MAX: OptionalNum,
  IMAGE_CROP_MAX_TRIM_RATIO_PER_SIDE: OptionalNum,
  IMAGE_CROP_MIN_REMAINING_RATIO: OptionalNum,
  IMAGE_CROP_MIN_CONFIDENCE: OptionalNum,
  IMAGE_CROP_MIN_TRIM_PIXELS: OptionalNum,
  IMAGE_CROP_MIN_AREA_REMOVED_RATIO: OptionalNum,
  IMAGE_CROP_TEXT_GUARD_ENABLED: OptionalBool,
  IMAGE_CROP_TEXT_GUARD_MINORITY_MIN_RATIO: OptionalNum,
  IMAGE_CROP_TEXT_GUARD_MINORITY_MAX_RATIO: OptionalNum,
  IMAGE_CROP_TEXT_GUARD_MIN_TRANSITION_RATIO: OptionalNum,
  IMAGE_CROP_TEXT_GUARD_MIN_SIGNAL_PIXELS: OptionalNum,
  IMAGE_CROP_TEXT_GUARD_LUMA_OFFSET: OptionalNum,
  IMAGE_CROP_RECT_DETECT_ENABLED: OptionalBool,
  IMAGE_CROP_RECT_ANALYSIS_MAX_DIM: OptionalNum,
  IMAGE_CROP_RECT_MIN_AREA_RATIO: OptionalNum,
  IMAGE_CROP_RECT_MIN_CONFIDENCE: OptionalNum,
  IMAGE_CROP_RECT_ASPECT_MIN: OptionalNum,
  IMAGE_CROP_RECT_ASPECT_MAX: OptionalNum,
  IMAGE_CROP_RECT_ROW_FOREGROUND_RATIO: OptionalNum,
  IMAGE_CROP_RECT_COL_FOREGROUND_RATIO: OptionalNum,
  IMAGE_CROP_RECT_COLOR_DISTANCE: OptionalNum,
  IMAGE_CROP_RECT_LUMA_DISTANCE: OptionalNum,
  IMAGE_CROP_RECT_CENTER_WEIGHT: OptionalNum,
  IMAGE_CROP_RECT_TEXT_GUARD_ENABLED: OptionalBool,
  IMAGE_CROP_RECT_TEXT_GUARD_MIN_MARGIN_PIXELS: OptionalNum,
  IMAGE_CROP_RECT_TEXT_GUARD_MIN_SIGNAL_PIXELS: OptionalNum,
  IMAGE_CROP_RECT_TEXT_GUARD_MINORITY_MIN_RATIO: OptionalNum,
  IMAGE_CROP_RECT_TEXT_GUARD_MINORITY_MAX_RATIO: OptionalNum,
  IMAGE_CROP_RECT_TEXT_GUARD_MIN_BOUNDARY_RATIO: OptionalNum,
  IMAGE_CROP_RECT_TEXT_GUARD_CONTRAST_DELTA: OptionalNum,
});

const dedupeOverrideSchema = z.object({
  IMAGE_DEDUPE_V2_ENABLED: OptionalBool,
  IMAGE_DEDUPE_ORB_ENABLED: OptionalBool,
  IMAGE_DEDUPE_ORB_REQUIRED: OptionalBool,
  IMAGE_DEDUPE_ORB_VERIFIER_URL: OptionalUrl,
  IMAGE_DEDUPE_ORB_SHARED_SECRET: OptionalString,
  IMAGE_DEDUPE_ORB_TIMEOUT_MS: OptionalNum,
  IMAGE_DEDUPE_ORB_RETRIES: OptionalNum,
  IMAGE_DEDUPE_PHASH_PREFIX_RADIUS: OptionalNum,
  IMAGE_DEDUPE_PHASH_MAX_DISTANCE_STRONG: OptionalNum,
  IMAGE_DEDUPE_PHASH_MAX_DISTANCE_WEAK: OptionalNum,
  IMAGE_DEDUPE_ORB_MIN_INLIERS: OptionalNum,
  IMAGE_DEDUPE_ORB_MIN_INLIER_RATIO: OptionalNum,
  IMAGE_DEDUPE_ORB_MIN_MATCHES: OptionalNum,
  IMAGE_DEDUPE_ORB_FORCE_ALL_CANDIDATES: OptionalBool,
  IMAGE_DEDUPE_ORB_FORCE_MAX_CANDIDATES: OptionalNum,
});

const parseOverrides = <T extends z.ZodTypeAny>(schema: T): z.infer<T> => {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("\n");
    throw new Error(`Invalid image pipeline environment override:\n${issues}`);
  }
  return parsed.data;
};

export const loadCropPipelineConfig = (): CropPipelineConfig => {
  const overrides = parseOverrides(cropOverrideSchema);

  return {
    rectOptions: {
      ...defaultCropPipelineConfig.rectOptions,
      enabled:
        overrides.IMAGE_CROP_RECT_DETECT_ENABLED ?? defaultCropPipelineConfig.rectOptions.enabled,
      analysisMaxDim:
        overrides.IMAGE_CROP_RECT_ANALYSIS_MAX_DIM ??
        defaultCropPipelineConfig.rectOptions.analysisMaxDim,
      minAreaRatio:
        overrides.IMAGE_CROP_RECT_MIN_AREA_RATIO ??
        defaultCropPipelineConfig.rectOptions.minAreaRatio,
      minConfidence:
        overrides.IMAGE_CROP_RECT_MIN_CONFIDENCE ??
        defaultCropPipelineConfig.rectOptions.minConfidence,
      minAspectRatio:
        overrides.IMAGE_CROP_RECT_ASPECT_MIN ??
        defaultCropPipelineConfig.rectOptions.minAspectRatio,
      maxAspectRatio:
        overrides.IMAGE_CROP_RECT_ASPECT_MAX ??
        defaultCropPipelineConfig.rectOptions.maxAspectRatio,
      rowForegroundRatio:
        overrides.IMAGE_CROP_RECT_ROW_FOREGROUND_RATIO ??
        defaultCropPipelineConfig.rectOptions.rowForegroundRatio,
      colForegroundRatio:
        overrides.IMAGE_CROP_RECT_COL_FOREGROUND_RATIO ??
        defaultCropPipelineConfig.rectOptions.colForegroundRatio,
      colorDistanceThreshold:
        overrides.IMAGE_CROP_RECT_COLOR_DISTANCE ??
        defaultCropPipelineConfig.rectOptions.colorDistanceThreshold,
      lumaDistanceThreshold:
        overrides.IMAGE_CROP_RECT_LUMA_DISTANCE ??
        defaultCropPipelineConfig.rectOptions.lumaDistanceThreshold,
      centerWeight:
        overrides.IMAGE_CROP_RECT_CENTER_WEIGHT ??
        defaultCropPipelineConfig.rectOptions.centerWeight,
      textGuardEnabled:
        overrides.IMAGE_CROP_RECT_TEXT_GUARD_ENABLED ??
        defaultCropPipelineConfig.rectOptions.textGuardEnabled,
      textGuardMinMarginPixels:
        overrides.IMAGE_CROP_RECT_TEXT_GUARD_MIN_MARGIN_PIXELS ??
        defaultCropPipelineConfig.rectOptions.textGuardMinMarginPixels,
      textGuardMinSignalPixels:
        overrides.IMAGE_CROP_RECT_TEXT_GUARD_MIN_SIGNAL_PIXELS ??
        defaultCropPipelineConfig.rectOptions.textGuardMinSignalPixels,
      textGuardMinorityPixelMinRatio:
        overrides.IMAGE_CROP_RECT_TEXT_GUARD_MINORITY_MIN_RATIO ??
        defaultCropPipelineConfig.rectOptions.textGuardMinorityPixelMinRatio,
      textGuardMinorityPixelMaxRatio:
        overrides.IMAGE_CROP_RECT_TEXT_GUARD_MINORITY_MAX_RATIO ??
        defaultCropPipelineConfig.rectOptions.textGuardMinorityPixelMaxRatio,
      textGuardMinBoundaryRatio:
        overrides.IMAGE_CROP_RECT_TEXT_GUARD_MIN_BOUNDARY_RATIO ??
        defaultCropPipelineConfig.rectOptions.textGuardMinBoundaryRatio,
      textGuardContrastDelta:
        overrides.IMAGE_CROP_RECT_TEXT_GUARD_CONTRAST_DELTA ??
        defaultCropPipelineConfig.rectOptions.textGuardContrastDelta,
    },
    borderOptions: {
      ...defaultCropPipelineConfig.borderOptions,
      enabled: overrides.IMAGE_CROP_ENABLED ?? defaultCropPipelineConfig.borderOptions.enabled,
      analysisMaxDim:
        overrides.IMAGE_CROP_ANALYSIS_MAX_DIM ??
        defaultCropPipelineConfig.borderOptions.analysisMaxDim,
      whiteThreshold:
        overrides.IMAGE_CROP_WHITE_THRESHOLD ??
        defaultCropPipelineConfig.borderOptions.whiteThreshold,
      blackThreshold:
        overrides.IMAGE_CROP_BLACK_THRESHOLD ??
        defaultCropPipelineConfig.borderOptions.blackThreshold,
      lineDominance:
        overrides.IMAGE_CROP_LINE_DOMINANCE ??
        defaultCropPipelineConfig.borderOptions.lineDominance,
      lineStdDevMax:
        overrides.IMAGE_CROP_LINE_STDDEV_MAX ??
        defaultCropPipelineConfig.borderOptions.lineStdDevMax,
      maxTrimRatioPerSide:
        overrides.IMAGE_CROP_MAX_TRIM_RATIO_PER_SIDE ??
        defaultCropPipelineConfig.borderOptions.maxTrimRatioPerSide,
      minRemainingRatio:
        overrides.IMAGE_CROP_MIN_REMAINING_RATIO ??
        defaultCropPipelineConfig.borderOptions.minRemainingRatio,
      minConfidence:
        overrides.IMAGE_CROP_MIN_CONFIDENCE ??
        defaultCropPipelineConfig.borderOptions.minConfidence,
      minTrimPixels:
        overrides.IMAGE_CROP_MIN_TRIM_PIXELS ??
        defaultCropPipelineConfig.borderOptions.minTrimPixels,
      minAreaRemovedRatio:
        overrides.IMAGE_CROP_MIN_AREA_REMOVED_RATIO ??
        defaultCropPipelineConfig.borderOptions.minAreaRemovedRatio,
      textGuardEnabled:
        overrides.IMAGE_CROP_TEXT_GUARD_ENABLED ??
        defaultCropPipelineConfig.borderOptions.textGuardEnabled,
      textGuardMinorityPixelMinRatio:
        overrides.IMAGE_CROP_TEXT_GUARD_MINORITY_MIN_RATIO ??
        defaultCropPipelineConfig.borderOptions.textGuardMinorityPixelMinRatio,
      textGuardMinorityPixelMaxRatio:
        overrides.IMAGE_CROP_TEXT_GUARD_MINORITY_MAX_RATIO ??
        defaultCropPipelineConfig.borderOptions.textGuardMinorityPixelMaxRatio,
      textGuardMinTransitionRatio:
        overrides.IMAGE_CROP_TEXT_GUARD_MIN_TRANSITION_RATIO ??
        defaultCropPipelineConfig.borderOptions.textGuardMinTransitionRatio,
      textGuardMinSignalPixels:
        overrides.IMAGE_CROP_TEXT_GUARD_MIN_SIGNAL_PIXELS ??
        defaultCropPipelineConfig.borderOptions.textGuardMinSignalPixels,
      textGuardLumaOffset:
        overrides.IMAGE_CROP_TEXT_GUARD_LUMA_OFFSET ??
        defaultCropPipelineConfig.borderOptions.textGuardLumaOffset,
    },
  };
};

export const loadImageDedupeConfig = (): ImageDedupeConfig => {
  const overrides = parseOverrides(dedupeOverrideSchema);

  return {
    dedupeV2Enabled: overrides.IMAGE_DEDUPE_V2_ENABLED ?? defaultImageDedupeConfig.dedupeV2Enabled,
    orbEnabled: overrides.IMAGE_DEDUPE_ORB_ENABLED ?? defaultImageDedupeConfig.orbEnabled,
    orbRequired: overrides.IMAGE_DEDUPE_ORB_REQUIRED ?? defaultImageDedupeConfig.orbRequired,
    orbVerifierUrl:
      overrides.IMAGE_DEDUPE_ORB_VERIFIER_URL ?? defaultImageDedupeConfig.orbVerifierUrl,
    orbSharedSecret:
      overrides.IMAGE_DEDUPE_ORB_SHARED_SECRET ?? defaultImageDedupeConfig.orbSharedSecret,
    orbTimeoutMs: overrides.IMAGE_DEDUPE_ORB_TIMEOUT_MS ?? defaultImageDedupeConfig.orbTimeoutMs,
    orbRetries: overrides.IMAGE_DEDUPE_ORB_RETRIES ?? defaultImageDedupeConfig.orbRetries,
    orbMinInliers: overrides.IMAGE_DEDUPE_ORB_MIN_INLIERS ?? defaultImageDedupeConfig.orbMinInliers,
    orbMinInlierRatio:
      overrides.IMAGE_DEDUPE_ORB_MIN_INLIER_RATIO ?? defaultImageDedupeConfig.orbMinInlierRatio,
    orbMinMatches: overrides.IMAGE_DEDUPE_ORB_MIN_MATCHES ?? defaultImageDedupeConfig.orbMinMatches,
    orbForceAllCandidates:
      overrides.IMAGE_DEDUPE_ORB_FORCE_ALL_CANDIDATES ??
      defaultImageDedupeConfig.orbForceAllCandidates,
    orbForceMaxCandidates:
      overrides.IMAGE_DEDUPE_ORB_FORCE_MAX_CANDIDATES ??
      defaultImageDedupeConfig.orbForceMaxCandidates,
    dedupeStrongThreshold:
      overrides.IMAGE_DEDUPE_PHASH_MAX_DISTANCE_STRONG ??
      defaultImageDedupeConfig.dedupeStrongThreshold,
    dedupeWeakThreshold:
      overrides.IMAGE_DEDUPE_PHASH_MAX_DISTANCE_WEAK ??
      defaultImageDedupeConfig.dedupeWeakThreshold,
    prefixRadius:
      overrides.IMAGE_DEDUPE_PHASH_PREFIX_RADIUS ?? defaultImageDedupeConfig.prefixRadius,
  };
};
