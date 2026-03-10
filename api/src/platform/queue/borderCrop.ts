import sharp from "sharp";

type BorderTone = "white" | "black";
type Edge = "top" | "right" | "bottom" | "left";

type Segment = { start: number; end: number };

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
  textGuardEnabled: boolean;
  textGuardMinorityPixelMinRatio: number;
  textGuardMinorityPixelMaxRatio: number;
  textGuardMinTransitionRatio: number;
  textGuardMinSignalPixels: number;
  textGuardLumaOffset: number;
};

export type EmbeddedRectOptions = {
  enabled: boolean;
  analysisMaxDim: number;
  minAreaRatio: number;
  minConfidence: number;
  minAspectRatio: number;
  maxAspectRatio: number;
  rowForegroundRatio: number;
  colForegroundRatio: number;
  colorDistanceThreshold: number;
  lumaDistanceThreshold: number;
  centerWeight: number;
  textGuardEnabled: boolean;
  textGuardMinMarginPixels: number;
  textGuardMinSignalPixels: number;
  textGuardMinorityPixelMinRatio: number;
  textGuardMinorityPixelMaxRatio: number;
  textGuardMinBoundaryRatio: number;
  textGuardContrastDelta: number;
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

export type EmbeddedRectDecision = {
  applied: boolean;
  reason: string;
  confidence: number;
  originalWidth: number;
  originalHeight: number;
  cropBox: CropBox;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

const toLuma = (r: number, g: number, b: number) => 0.2126 * r + 0.7152 * g + 0.0722 * b;

const defaultBorderOptions: BorderCropOptions = {
  // Master toggle for edge-border trimming.
  enabled: true,
  // Resize limit used only for analysis speed/consistency.
  analysisMaxDim: 512,
  // A line is treated as "white border" if most pixels are brighter than this.
  whiteThreshold: 248,
  // A line is treated as "black border" if most pixels are darker than this.
  blackThreshold: 8,
  // How much one tone must dominate the line before it can be trimmed.
  lineDominance: 0.985,
  // Maximum brightness variation allowed in a border-like line.
  lineStdDevMax: 16,
  // Safety cap: per side, never trim more than this fraction in one pass.
  maxTrimRatioPerSide: 0.35,
  // Safety cap: never crop below this retained width/height ratio.
  minRemainingRatio: 0.5,
  // Minimum confidence to apply cropping.
  minConfidence: 0.8,
  // Ignore tiny trims to reduce accidental 1-2px crops.
  minTrimPixels: 10,
  // Ignore crops that remove only negligible area.
  minAreaRemovedRatio: 0.01,
  // Skip trimming if stripped edge area looks like subtitle/caption text.
  textGuardEnabled: true,
  // Lower bound to ignore tiny one-off pixels.
  textGuardMinorityPixelMinRatio: 0.001,
  // Upper bound to avoid treating fully-detailed edges as text-like borders.
  textGuardMinorityPixelMaxRatio: 0.2,
  // Edge density needed to look glyph-like instead of flat bars.
  textGuardMinTransitionRatio: 0.38,
  // Absolute signal floor to avoid tiny artifacts.
  textGuardMinSignalPixels: 10,
  // Contrast margin around black/white thresholds used for minority classification.
  textGuardLumaOffset: 24,
};

const defaultEmbeddedRectOptions: EmbeddedRectOptions = {
  // Master toggle for finding an "inner content rectangle".
  enabled: true,
  // Resize limit used only for analysis speed/consistency.
  analysisMaxDim: 640,
  // Reject candidate rects that are too small relative to full image.
  minAreaRatio: 0.16,
  // Minimum confidence needed to apply the rect crop.
  minConfidence: 0.56,
  // Reject candidate rects that are implausibly skinny/wide.
  minAspectRatio: 0.45,
  maxAspectRatio: 2.4,
  // Thresholds for deciding whether rows/columns are content instead of background.
  rowForegroundRatio: 0.12,
  colForegroundRatio: 0.12,
  // Pixel distance thresholds used to separate content from corner background color.
  colorDistanceThreshold: 26,
  lumaDistanceThreshold: 20,
  // Weight for preferring centered content boxes.
  centerWeight: 0.35,
  // Skip rect-crop if discarded top/bottom bands look text-like.
  textGuardEnabled: true,
  textGuardMinMarginPixels: 10,
  textGuardMinSignalPixels: 14,
  textGuardMinorityPixelMinRatio: 0.001,
  textGuardMinorityPixelMaxRatio: 0.25,
  textGuardMinBoundaryRatio: 0.1,
  textGuardContrastDelta: 44,
};

const getInitialBorderDecision = (width: number, height: number): BorderCropDecision => ({
  applied: false,
  reason: "not-needed",
  confidence: 0,
  originalWidth: width,
  originalHeight: height,
  cropBox: { left: 0, top: 0, width, height },
  trimmed: { top: 0, right: 0, bottom: 0, left: 0 },
});

const getInitialRectDecision = (width: number, height: number): EmbeddedRectDecision => ({
  applied: false,
  reason: "rect-not-needed",
  confidence: 0,
  originalWidth: width,
  originalHeight: height,
  cropBox: { left: 0, top: 0, width, height },
});

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

type EdgeScanResult = {
  trimmed: number;
  confidence: number;
  tone: BorderTone | null;
};

const scanEdge = (args: {
  edge: Edge;
  data: Buffer;
  channels: number;
  width: number;
  height: number;
  maxTrimLines: number;
  opts: BorderCropOptions;
}): EdgeScanResult => {
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

  if (!trimmed) return { trimmed: 0, confidence: 0, tone: null };
  const avgDominant = dominantSum / trimmed;
  const avgStd = stdDevSum / trimmed;
  const stdScore = clamp(1 - avgStd / opts.lineStdDevMax, 0, 1);
  const confidence = clamp(avgDominant * 0.7 + stdScore * 0.3, 0, 1);
  return { trimmed, confidence, tone: expectedTone };
};

const edgeRegionBounds = (
  edge: Edge,
  width: number,
  height: number,
  trimmedLines: number,
): { x0: number; x1: number; y0: number; y1: number } => {
  if (edge === "top") return { x0: 0, x1: width, y0: 0, y1: trimmedLines };
  if (edge === "bottom") return { x0: 0, x1: width, y0: height - trimmedLines, y1: height };
  if (edge === "left") return { x0: 0, x1: trimmedLines, y0: 0, y1: height };
  return { x0: width - trimmedLines, x1: width, y0: 0, y1: height };
};

const edgeHasTextLikeSignal = (args: {
  data: Buffer;
  channels: number;
  width: number;
  height: number;
  edge: Edge;
  trimmedLines: number;
  tone: BorderTone;
  opts: BorderCropOptions;
}) => {
  const { data, channels, width, height, edge, trimmedLines, tone, opts } = args;
  if (trimmedLines < 2) return false;

  const { x0, x1, y0, y1 } = edgeRegionBounds(edge, width, height, trimmedLines);
  const regionWidth = x1 - x0;
  const regionHeight = y1 - y0;
  if (regionWidth < 2 || regionHeight < 2) return false;

  const area = regionWidth * regionHeight;
  const mask = new Uint8Array(area);

  const minorityCutoff =
    tone === "black"
      ? Math.min(255, opts.blackThreshold + opts.textGuardLumaOffset)
      : Math.max(0, opts.whiteThreshold - opts.textGuardLumaOffset);
  const isMinority = (luma: number) =>
    tone === "black" ? luma >= minorityCutoff : luma <= minorityCutoff;

  let minorityCount = 0;
  for (let ry = 0; ry < regionHeight; ry += 1) {
    for (let rx = 0; rx < regionWidth; rx += 1) {
      const x = x0 + rx;
      const y = y0 + ry;
      const idx = (y * width + x) * channels;
      const a = channels >= 4 ? data[idx + 3] / 255 : 1;
      const r = data[idx] * a + 255 * (1 - a);
      const g = data[idx + 1] * a + 255 * (1 - a);
      const b = data[idx + 2] * a + 255 * (1 - a);
      const luma = toLuma(r, g, b);
      if (!isMinority(luma)) continue;
      const maskIdx = ry * regionWidth + rx;
      mask[maskIdx] = 1;
      minorityCount += 1;
    }
  }

  if (minorityCount < opts.textGuardMinSignalPixels) return false;
  const minorityRatio = minorityCount / area;
  if (
    minorityRatio < opts.textGuardMinorityPixelMinRatio ||
    minorityRatio > opts.textGuardMinorityPixelMaxRatio
  ) {
    return false;
  }

  let boundaryEdges = 0;
  for (let ry = 0; ry < regionHeight; ry += 1) {
    for (let rx = 0; rx < regionWidth; rx += 1) {
      const idx = ry * regionWidth + rx;
      if (!mask[idx]) continue;
      if (rx === 0 || !mask[idx - 1]) boundaryEdges += 1;
      if (rx + 1 >= regionWidth || !mask[idx + 1]) boundaryEdges += 1;
      if (ry === 0 || !mask[idx - regionWidth]) boundaryEdges += 1;
      if (ry + 1 >= regionHeight || !mask[idx + regionWidth]) boundaryEdges += 1;
    }
  }

  const transitionRatio = boundaryEdges / Math.max(1, minorityCount * 4);
  return transitionRatio >= opts.textGuardMinTransitionRatio;
};

const hasTextLikeEdgeSignal = (args: {
  data: Buffer;
  channels: number;
  width: number;
  height: number;
  scans: Record<Edge, EdgeScanResult>;
  opts: BorderCropOptions;
}) => {
  const { data, channels, width, height, scans, opts } = args;
  if (!opts.textGuardEnabled) return false;
  const edges: Edge[] = ["top", "right", "bottom", "left"];
  return edges.some((edge) => {
    const scan = scans[edge];
    if (scan.trimmed <= 0 || !scan.tone) return false;
    return edgeHasTextLikeSignal({
      data,
      channels,
      width,
      height,
      edge,
      trimmedLines: scan.trimmed,
      tone: scan.tone,
      opts,
    });
  });
};

const rectBandHasTextLikeSignal = (args: {
  data: Buffer;
  channels: number;
  width: number;
  height: number;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  opts: EmbeddedRectOptions;
}) => {
  const { data, channels, width, height, x0, x1, y0, y1, opts } = args;
  const regionWidth = x1 - x0;
  const regionHeight = y1 - y0;
  if (regionWidth < 2 || regionHeight < 2) return false;

  const area = regionWidth * regionHeight;
  const mask = new Uint8Array(area);
  let sumLuma = 0;

  for (let ry = 0; ry < regionHeight; ry += 1) {
    for (let rx = 0; rx < regionWidth; rx += 1) {
      const x = x0 + rx;
      const y = y0 + ry;
      const idx = (y * width + x) * channels;
      const a = channels >= 4 ? data[idx + 3] / 255 : 1;
      const r = data[idx] * a + 255 * (1 - a);
      const g = data[idx + 1] * a + 255 * (1 - a);
      const b = data[idx + 2] * a + 255 * (1 - a);
      sumLuma += toLuma(r, g, b);
    }
  }

  const meanLuma = sumLuma / area;
  const darkBackground = meanLuma < 128;
  const minorityCutoff = darkBackground
    ? Math.min(255, meanLuma + opts.textGuardContrastDelta)
    : Math.max(0, meanLuma - opts.textGuardContrastDelta);
  const isMinority = (luma: number) =>
    darkBackground ? luma >= minorityCutoff : luma <= minorityCutoff;

  let minorityCount = 0;
  for (let ry = 0; ry < regionHeight; ry += 1) {
    for (let rx = 0; rx < regionWidth; rx += 1) {
      const x = x0 + rx;
      const y = y0 + ry;
      const idx = (y * width + x) * channels;
      const a = channels >= 4 ? data[idx + 3] / 255 : 1;
      const r = data[idx] * a + 255 * (1 - a);
      const g = data[idx + 1] * a + 255 * (1 - a);
      const b = data[idx + 2] * a + 255 * (1 - a);
      const luma = toLuma(r, g, b);
      if (!isMinority(luma)) continue;
      const maskIdx = ry * regionWidth + rx;
      mask[maskIdx] = 1;
      minorityCount += 1;
    }
  }

  if (minorityCount < opts.textGuardMinSignalPixels) return false;
  const minorityRatio = minorityCount / area;
  if (
    minorityRatio < opts.textGuardMinorityPixelMinRatio ||
    minorityRatio > opts.textGuardMinorityPixelMaxRatio
  ) {
    return false;
  }

  let boundaryEdges = 0;
  for (let ry = 0; ry < regionHeight; ry += 1) {
    for (let rx = 0; rx < regionWidth; rx += 1) {
      const idx = ry * regionWidth + rx;
      if (!mask[idx]) continue;
      if (rx === 0 || !mask[idx - 1]) boundaryEdges += 1;
      if (rx + 1 >= regionWidth || !mask[idx + 1]) boundaryEdges += 1;
      if (ry === 0 || !mask[idx - regionWidth]) boundaryEdges += 1;
      if (ry + 1 >= regionHeight || !mask[idx + regionWidth]) boundaryEdges += 1;
    }
  }

  const boundaryRatio = boundaryEdges / Math.max(1, minorityCount * 4);
  return boundaryRatio >= opts.textGuardMinBoundaryRatio;
};

const findSegments = (flags: boolean[]): Segment[] => {
  const segments: Segment[] = [];
  let start = -1;
  for (let i = 0; i < flags.length; i += 1) {
    if (flags[i] && start < 0) start = i;
    if (!flags[i] && start >= 0) {
      segments.push({ start, end: i - 1 });
      start = -1;
    }
  }
  if (start >= 0) segments.push({ start, end: flags.length - 1 });
  return segments;
};

const pickSegment = (segments: Segment[], centerIndex: number, maxSize: number) => {
  if (!segments.length) return null;
  let best: Segment | null = null;
  let bestScore = -1;
  for (const segment of segments) {
    const size = segment.end - segment.start + 1;
    const segCenter = (segment.start + segment.end) / 2;
    const centerDistance = Math.abs(segCenter - centerIndex) / Math.max(1, maxSize / 2);
    const sizeScore = clamp(size / maxSize, 0, 1);
    const centerScore = 1 - clamp(centerDistance, 0, 1);
    const score = sizeScore * 0.65 + centerScore * 0.35;
    if (score > bestScore) {
      bestScore = score;
      best = segment;
    }
  }
  return best;
};

const estimateCornerBackground = (
  data: Buffer,
  width: number,
  height: number,
  channels: number,
  block: number,
) => {
  const samples: Array<{ r: number; g: number; b: number }> = [];
  const corners: Array<[number, number]> = [
    [0, 0],
    [Math.max(0, width - block), 0],
    [0, Math.max(0, height - block)],
    [Math.max(0, width - block), Math.max(0, height - block)],
  ];

  for (const [sx, sy] of corners) {
    for (let y = sy; y < Math.min(height, sy + block); y += 1) {
      for (let x = sx; x < Math.min(width, sx + block); x += 1) {
        const idx = (y * width + x) * channels;
        const a = channels >= 4 ? data[idx + 3] / 255 : 1;
        const r = data[idx] * a + 255 * (1 - a);
        const g = data[idx + 1] * a + 255 * (1 - a);
        const b = data[idx + 2] * a + 255 * (1 - a);
        samples.push({ r, g, b });
      }
    }
  }

  if (!samples.length) return { r: 255, g: 255, b: 255, luma: 255 };

  const avg = samples.reduce(
    (acc, sample) => ({ r: acc.r + sample.r, g: acc.g + sample.g, b: acc.b + sample.b }),
    { r: 0, g: 0, b: 0 },
  );
  const r = avg.r / samples.length;
  const g = avg.g / samples.length;
  const b = avg.b / samples.length;
  return { r, g, b, luma: toLuma(r, g, b) };
};

export const detectEmbeddedImageRect = async (
  input: Buffer,
  options: Partial<EmbeddedRectOptions> = {},
): Promise<EmbeddedRectDecision> => {
  const opts = { ...defaultEmbeddedRectOptions, ...options };
  const metadata = await sharp(input).metadata();
  const originalWidth = metadata.width ?? 0;
  const originalHeight = metadata.height ?? 0;
  const initial = getInitialRectDecision(originalWidth, originalHeight);

  if (!opts.enabled) return { ...initial, reason: "rect-disabled" };
  if (originalWidth < 3 || originalHeight < 3)
    return { ...initial, reason: "rect-invalid-dimensions" };

  const scale = Math.min(1, opts.analysisMaxDim / Math.max(originalWidth, originalHeight));
  const analysisWidth = Math.max(3, Math.round(originalWidth * scale));
  const analysisHeight = Math.max(3, Math.round(originalHeight * scale));
  const { data, info } = await sharp(input)
    .resize({ width: analysisWidth, height: analysisHeight, fit: "fill", kernel: "nearest" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const channels = info.channels;

  const cornerBlock = clamp(Math.floor(Math.min(analysisWidth, analysisHeight) * 0.08), 6, 36);
  const bg = estimateCornerBackground(data, analysisWidth, analysisHeight, channels, cornerBlock);

  const rowForegroundRatio = new Array<number>(analysisHeight).fill(0);
  const colForegroundRatio = new Array<number>(analysisWidth).fill(0);

  for (let y = 0; y < analysisHeight; y += 1) {
    let rowFg = 0;
    for (let x = 0; x < analysisWidth; x += 1) {
      const idx = (y * analysisWidth + x) * channels;
      const a = channels >= 4 ? data[idx + 3] / 255 : 1;
      const r = data[idx] * a + 255 * (1 - a);
      const g = data[idx + 1] * a + 255 * (1 - a);
      const b = data[idx + 2] * a + 255 * (1 - a);
      const dl = Math.abs(toLuma(r, g, b) - bg.luma);
      const dr = r - bg.r;
      const dg = g - bg.g;
      const db = b - bg.b;
      const colorDistance = Math.sqrt(dr * dr + dg * dg + db * db);
      const isForeground =
        colorDistance >= opts.colorDistanceThreshold || dl >= opts.lumaDistanceThreshold;
      if (isForeground) {
        rowFg += 1;
        colForegroundRatio[x] += 1;
      }
    }
    rowForegroundRatio[y] = rowFg / analysisWidth;
  }

  for (let x = 0; x < analysisWidth; x += 1) {
    colForegroundRatio[x] /= analysisHeight;
  }

  const rowFlags = rowForegroundRatio.map((ratio) => ratio >= opts.rowForegroundRatio);
  const colFlags = colForegroundRatio.map((ratio) => ratio >= opts.colForegroundRatio);
  // We pick the strongest contiguous "content band" near center, not isolated pixels.
  const rowSegment = pickSegment(findSegments(rowFlags), analysisHeight / 2, analysisHeight);
  const colSegment = pickSegment(findSegments(colFlags), analysisWidth / 2, analysisWidth);

  if (!rowSegment || !colSegment) {
    return { ...initial, reason: "rect-no-candidate" };
  }

  const left = Math.max(0, Math.floor((colSegment.start / analysisWidth) * originalWidth));
  const top = Math.max(0, Math.floor((rowSegment.start / analysisHeight) * originalHeight));
  const right = Math.min(
    originalWidth,
    Math.ceil(((colSegment.end + 1) / analysisWidth) * originalWidth),
  );
  const bottom = Math.min(
    originalHeight,
    Math.ceil(((rowSegment.end + 1) / analysisHeight) * originalHeight),
  );

  const cropBox: CropBox = {
    left,
    top,
    width: Math.max(1, right - left),
    height: Math.max(1, bottom - top),
  };

  if (opts.textGuardEnabled) {
    const topBandHeight = cropBox.top;
    const bottomBandHeight = originalHeight - (cropBox.top + cropBox.height);
    const { data: originalData, info: originalInfo } = await sharp(input)
      .raw()
      .toBuffer({ resolveWithObject: true });
    const originalChannels = originalInfo.channels;
    const topHasText =
      topBandHeight >= opts.textGuardMinMarginPixels &&
      rectBandHasTextLikeSignal({
        data: originalData,
        channels: originalChannels,
        width: originalWidth,
        height: originalHeight,
        x0: 0,
        x1: originalWidth,
        y0: 0,
        y1: topBandHeight,
        opts,
      });
    const bottomHasText =
      bottomBandHeight >= opts.textGuardMinMarginPixels &&
      rectBandHasTextLikeSignal({
        data: originalData,
        channels: originalChannels,
        width: originalWidth,
        height: originalHeight,
        x0: 0,
        x1: originalWidth,
        y0: originalHeight - bottomBandHeight,
        y1: originalHeight,
        opts,
      });
    if (topHasText || bottomHasText) {
      return { ...initial, reason: "rect-text-near-edge", cropBox };
    }
  }

  const areaRatio = (cropBox.width * cropBox.height) / (originalWidth * originalHeight);
  if (areaRatio < opts.minAreaRatio) {
    return { ...initial, reason: "rect-area-too-small", cropBox };
  }

  const aspectRatio = cropBox.width / cropBox.height;
  if (aspectRatio < opts.minAspectRatio || aspectRatio > opts.maxAspectRatio) {
    return { ...initial, reason: "rect-aspect-out-of-range", cropBox };
  }

  const centerX = cropBox.left + cropBox.width / 2;
  const centerY = cropBox.top + cropBox.height / 2;
  const dx = Math.abs(centerX - originalWidth / 2) / (originalWidth / 2);
  const dy = Math.abs(centerY - originalHeight / 2) / (originalHeight / 2);
  const centerScore = 1 - clamp((dx + dy) / 2, 0, 1);

  const rowDensity =
    rowForegroundRatio
      .slice(rowSegment.start, rowSegment.end + 1)
      .reduce((sum, value) => sum + value, 0) /
    (rowSegment.end - rowSegment.start + 1);
  const colDensity =
    colForegroundRatio
      .slice(colSegment.start, colSegment.end + 1)
      .reduce((sum, value) => sum + value, 0) /
    (colSegment.end - colSegment.start + 1);
  const densityScore = clamp((rowDensity + colDensity) / 2, 0, 1);
  const areaScore = clamp(areaRatio / 0.65, 0, 1);

  const confidence = clamp(
    centerScore * opts.centerWeight + areaScore * 0.35 + densityScore * (0.65 - opts.centerWeight),
    0,
    1,
  );

  if (confidence < opts.minConfidence) {
    return {
      ...initial,
      reason: "rect-low-confidence",
      confidence,
      cropBox,
    };
  }

  return {
    applied: true,
    reason: "rect-applied",
    confidence,
    originalWidth,
    originalHeight,
    cropBox,
  };
};

export const analyzeBorderCrop = async (
  input: Buffer,
  options: Partial<BorderCropOptions> = {},
): Promise<BorderCropDecision> => {
  const opts: BorderCropOptions = { ...defaultBorderOptions, ...options };

  const metadata = await sharp(input).metadata();
  const originalWidth = metadata.width ?? 0;
  const originalHeight = metadata.height ?? 0;
  const initial = getInitialBorderDecision(originalWidth, originalHeight);

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
  const edgeScans = { top, right, bottom, left };

  const toOriginalX = (lineCount: number) =>
    Math.round((lineCount / analysisWidth) * originalWidth);
  const toOriginalY = (lineCount: number) =>
    Math.round((lineCount / analysisHeight) * originalHeight);

  // Convert analysis-space trim distances back to original pixel coordinates.
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

  if (
    hasTextLikeEdgeSignal({
      data,
      channels,
      width: analysisWidth,
      height: analysisHeight,
      scans: edgeScans,
      opts,
    })
  ) {
    return { ...initial, reason: "text-near-edge", trimmed };
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
  // Final confidence is the average confidence of the sides we actually trimmed.
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

export const applyCropBox = async (input: Buffer, cropBox: CropBox) => {
  const { left, top, width, height } = cropBox;
  return sharp(input).extract({ left, top, width, height }).toBuffer();
};

export const applyBorderCrop = async (input: Buffer, decision: BorderCropDecision) => {
  if (!decision.applied) return input;
  return applyCropBox(input, decision.cropBox);
};

export const borderCropDefaults = defaultBorderOptions;
export const embeddedRectDefaults = defaultEmbeddedRectOptions;
