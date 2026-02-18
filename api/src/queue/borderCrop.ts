import sharp from "sharp";

type BorderTone = "white" | "black";
type Edge = "top" | "right" | "bottom" | "left";

export type CropBox = {
  left: number;
  top: number;
  width: number;
  height: number;
};

export type BorderCropOptions = {
  enabled: boolean;
  analysisMaxDim: number;
  whiteThreshold: number;
  blackThreshold: number;
  lineDominance: number;
  lineStdDevMax: number;
  maxTrimRatioPerSide: number;
  minRemainingRatio: number;
  minConfidence: number;
  minTrimPixels: number;
  minAreaRemovedRatio: number;
};

export type BorderCropDecision = {
  applied: boolean;
  reason: string;
  confidence: number;
  originalWidth: number;
  originalHeight: number;
  cropBox: CropBox;
  trimmed: Record<Edge, number>;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const toLuma = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

const defaultOptions: BorderCropOptions = {
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
};

const lineStats = (
  data: Buffer,
  channels: number,
  pixelCount: number,
  pixelOffset: (idx: number) => number,
  opts: BorderCropOptions,
) => {
  let whiteCount = 0;
  let blackCount = 0;
  let mean = 0;
  let m2 = 0;

  for (let i = 0; i < pixelCount; i += 1) {
    const offset = pixelOffset(i);
    const r = data[offset];
    const g = data[offset + 1];
    const b = data[offset + 2];
    const a = channels >= 4 ? data[offset + 3] / 255 : 1;

    // Composite alpha over white so transparent borders are treated as near-white.
    const rr = r * a + 255 * (1 - a);
    const gg = g * a + 255 * (1 - a);
    const bb = b * a + 255 * (1 - a);
    const luma = toLuma(rr, gg, bb);

    if (luma >= opts.whiteThreshold) whiteCount += 1;
    if (luma <= opts.blackThreshold) blackCount += 1;

    const n = i + 1;
    const delta = luma - mean;
    mean += delta / n;
    const delta2 = luma - mean;
    m2 += delta * delta2;
  }

  const whiteFrac = whiteCount / pixelCount;
  const blackFrac = blackCount / pixelCount;
  const dominant = Math.max(whiteFrac, blackFrac);
  const tone: BorderTone = whiteFrac >= blackFrac ? "white" : "black";
  const variance = pixelCount > 1 ? m2 / (pixelCount - 1) : 0;
  const stdDev = Math.sqrt(variance);
  const qualifies = dominant >= opts.lineDominance && stdDev <= opts.lineStdDevMax;

  return { dominant, tone, stdDev, qualifies };
};

const scanEdge = (args: {
  edge: Edge;
  data: Buffer;
  channels: number;
  width: number;
  height: number;
  maxTrimLines: number;
  opts: BorderCropOptions;
}) => {
  const { edge, data, channels, width, height, maxTrimLines, opts } = args;
  const lines = edge === "top" || edge === "bottom" ? height : width;
  const pixelsPerLine = edge === "top" || edge === "bottom" ? width : height;
  const cap = Math.max(0, Math.min(maxTrimLines, lines - 1));

  let trimmed = 0;
  let dominantSum = 0;
  let stdDevSum = 0;
  let expectedTone: BorderTone | null = null;

  for (let i = 0; i < cap; i += 1) {
    const stat = lineStats(
      data,
      channels,
      pixelsPerLine,
      (j) => {
        if (edge === "top") return (i * width + j) * channels;
        if (edge === "bottom") return ((height - 1 - i) * width + j) * channels;
        if (edge === "left") return (j * width + i) * channels;
        return (j * width + (width - 1 - i)) * channels;
      },
      opts,
    );

    if (!stat.qualifies) break;
    if (expectedTone && stat.tone !== expectedTone) break;

    expectedTone = expectedTone ?? stat.tone;
    trimmed += 1;
    dominantSum += stat.dominant;
    stdDevSum += stat.stdDev;
  }

  if (!trimmed) return { trimmed: 0, confidence: 0 };
  const avgDominant = dominantSum / trimmed;
  const avgStd = stdDevSum / trimmed;
  const stdScore = clamp(1 - avgStd / opts.lineStdDevMax, 0, 1);
  const confidence = clamp(avgDominant * 0.7 + stdScore * 0.3, 0, 1);
  return { trimmed, confidence };
};

export const analyzeBorderCrop = async (
  input: Buffer,
  options: Partial<BorderCropOptions> = {},
): Promise<BorderCropDecision> => {
  const opts: BorderCropOptions = { ...defaultOptions, ...options };

  const metadata = await sharp(input).metadata();
  const originalWidth = metadata.width ?? 0;
  const originalHeight = metadata.height ?? 0;
  const initial: BorderCropDecision = {
    applied: false,
    reason: "not-needed",
    confidence: 0,
    originalWidth,
    originalHeight,
    cropBox: { left: 0, top: 0, width: originalWidth, height: originalHeight },
    trimmed: { top: 0, right: 0, bottom: 0, left: 0 },
  };

  if (!opts.enabled) return { ...initial, reason: "disabled" };
  if (originalWidth < 2 || originalHeight < 2) return { ...initial, reason: "invalid-dimensions" };

  const scale = Math.min(1, opts.analysisMaxDim / Math.max(originalWidth, originalHeight));
  const analysisWidth = Math.max(2, Math.round(originalWidth * scale));
  const analysisHeight = Math.max(2, Math.round(originalHeight * scale));

  const { data, info } = await sharp(input)
    .resize({ width: analysisWidth, height: analysisHeight, fit: "fill", kernel: "nearest" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const channels = info.channels;

  const top = scanEdge({
    edge: "top",
    data,
    channels,
    width: analysisWidth,
    height: analysisHeight,
    maxTrimLines: Math.floor(analysisHeight * opts.maxTrimRatioPerSide),
    opts,
  });
  const bottom = scanEdge({
    edge: "bottom",
    data,
    channels,
    width: analysisWidth,
    height: analysisHeight,
    maxTrimLines: Math.floor(analysisHeight * opts.maxTrimRatioPerSide),
    opts,
  });
  const left = scanEdge({
    edge: "left",
    data,
    channels,
    width: analysisWidth,
    height: analysisHeight,
    maxTrimLines: Math.floor(analysisWidth * opts.maxTrimRatioPerSide),
    opts,
  });
  const right = scanEdge({
    edge: "right",
    data,
    channels,
    width: analysisWidth,
    height: analysisHeight,
    maxTrimLines: Math.floor(analysisWidth * opts.maxTrimRatioPerSide),
    opts,
  });

  const toOriginalX = (lineCount: number) =>
    Math.round((lineCount / analysisWidth) * originalWidth);
  const toOriginalY = (lineCount: number) =>
    Math.round((lineCount / analysisHeight) * originalHeight);

  const trimmed = {
    top: toOriginalY(top.trimmed),
    right: toOriginalX(right.trimmed),
    bottom: toOriginalY(bottom.trimmed),
    left: toOriginalX(left.trimmed),
  };

  const totalTrimmedPixels = trimmed.top + trimmed.right + trimmed.bottom + trimmed.left;
  if (!totalTrimmedPixels) return { ...initial, reason: "not-needed" };

  if (
    trimmed.top < opts.minTrimPixels &&
    trimmed.right < opts.minTrimPixels &&
    trimmed.bottom < opts.minTrimPixels &&
    trimmed.left < opts.minTrimPixels
  ) {
    return { ...initial, reason: "trim-too-small", trimmed };
  }

  const cropBox: CropBox = {
    left: trimmed.left,
    top: trimmed.top,
    width: originalWidth - trimmed.left - trimmed.right,
    height: originalHeight - trimmed.top - trimmed.bottom,
  };

  if (cropBox.width < 2 || cropBox.height < 2) {
    return { ...initial, reason: "invalid-crop-box", trimmed };
  }

  const remainingWidthRatio = cropBox.width / originalWidth;
  const remainingHeightRatio = cropBox.height / originalHeight;
  if (
    remainingWidthRatio < opts.minRemainingRatio ||
    remainingHeightRatio < opts.minRemainingRatio
  ) {
    return { ...initial, reason: "remaining-ratio-too-low", trimmed, cropBox };
  }

  const areaRemovedRatio = 1 - (cropBox.width * cropBox.height) / (originalWidth * originalHeight);
  if (areaRemovedRatio < opts.minAreaRemovedRatio) {
    return { ...initial, reason: "area-removed-too-small", trimmed, cropBox };
  }

  const confidenceSamples = [top, right, bottom, left]
    .filter((edge) => edge.trimmed > 0)
    .map((edge) => edge.confidence);
  const confidence = confidenceSamples.length
    ? clamp(
        confidenceSamples.reduce((sum, value) => sum + value, 0) / confidenceSamples.length,
        0,
        1,
      )
    : 0;
  if (confidence < opts.minConfidence) {
    return { ...initial, reason: "low-confidence", confidence, trimmed, cropBox };
  }

  return {
    applied: true,
    reason: "applied",
    confidence,
    originalWidth,
    originalHeight,
    cropBox,
    trimmed,
  };
};

export const applyBorderCrop = async (input: Buffer, decision: BorderCropDecision) => {
  if (!decision.applied) return input;
  const { left, top, width, height } = decision.cropBox;
  return sharp(input).extract({ left, top, width, height }).toBuffer();
};

export const borderCropDefaults = defaultOptions;
