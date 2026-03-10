import sharp from "sharp";
import { describe, expect, it } from "vitest";
import {
  analyzeBorderCrop,
  applyBorderCrop,
  detectEmbeddedImageRect,
} from "../../platform/queue/borderCrop.js";

const makeBorderedPng = async (args: {
  width: number;
  height: number;
  border: number;
  borderColor: [number, number, number];
  centerColor: [number, number, number];
}) => {
  const { width, height, border, borderColor, centerColor } = args;
  const channels = 3;
  const raw = Buffer.alloc(width * height * channels);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const isBorder = x < border || x >= width - border || y < border || y >= height - border;
      const [r, g, b] = isBorder ? borderColor : centerColor;
      const offset = (y * width + x) * channels;
      raw[offset] = r;
      raw[offset + 1] = g;
      raw[offset + 2] = b;
    }
  }

  return sharp(raw, { raw: { width, height, channels } }).png().toBuffer();
};

const makeHorizontalBarsPng = async (args: {
  width: number;
  height: number;
  bar: number;
  barColor: [number, number, number];
  centerColor: [number, number, number];
}) => {
  const { width, height, bar, barColor, centerColor } = args;
  const channels = 3;
  const raw = Buffer.alloc(width * height * channels);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const isBar = y < bar || y >= height - bar;
      const [r, g, b] = isBar ? barColor : centerColor;
      const offset = (y * width + x) * channels;
      raw[offset] = r;
      raw[offset + 1] = g;
      raw[offset + 2] = b;
    }
  }

  return sharp(raw, { raw: { width, height, channels } }).png().toBuffer();
};

const makeHorizontalBarsWithSparseTextPng = async (args: {
  width: number;
  height: number;
  bar: number;
  barColor: [number, number, number];
  centerColor: [number, number, number];
  textColor: [number, number, number];
}) => {
  const { width, height, bar, barColor, centerColor, textColor } = args;
  const channels = 3;
  const raw = Buffer.alloc(width * height * channels);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const isBar = y < bar || y >= height - bar;
      const [r, g, b] = isBar ? barColor : centerColor;
      const offset = (y * width + x) * channels;
      raw[offset] = r;
      raw[offset + 1] = g;
      raw[offset + 2] = b;
    }
  }

  const setPixel = (x: number, y: number, color: [number, number, number]) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const offset = (y * width + x) * channels;
    raw[offset] = color[0];
    raw[offset + 1] = color[1];
    raw[offset + 2] = color[2];
  };

  const drawMiniGlyph = (x: number, y: number) => {
    // 2x3 block: sparse enough to still pass border-line dominance checks.
    setPixel(x, y, textColor);
    setPixel(x + 1, y, textColor);
    setPixel(x, y + 1, textColor);
    setPixel(x + 1, y + 1, textColor);
    setPixel(x, y + 2, textColor);
    setPixel(x + 1, y + 2, textColor);
  };

  const topY = 1;
  const bottomY = height - bar + 1;
  for (const x of [Math.floor(width * 0.28), Math.floor(width * 0.7)]) {
    drawMiniGlyph(x, topY);
    drawMiniGlyph(x, bottomY);
  }

  return sharp(raw, { raw: { width, height, channels } }).png().toBuffer();
};

const makeScreenshotLikeWithTopCaptionPng = async () => {
  const width = 420;
  const height = 760;
  const channels = 3;
  const raw = Buffer.alloc(width * height * channels);

  const setPixel = (x: number, y: number, color: [number, number, number]) => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const offset = (y * width + x) * channels;
    raw[offset] = color[0];
    raw[offset + 1] = color[1];
    raw[offset + 2] = color[2];
  };

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let color: [number, number, number] = [8, 8, 8];
      if (y < 110) color = [0, 0, 0];
      if (y >= 180 && y < 620 && x >= 22 && x < 398) color = [40, 120, 220];
      setPixel(x, y, color);
    }
  }

  const drawMiniGlyph = (x: number, y: number) => {
    for (let dy = 0; dy < 3; dy += 1) {
      for (let dx = 0; dx < 2; dx += 1) {
        setPixel(x + dx, y + dy, [240, 240, 240]);
      }
    }
  };
  for (const x of [54, 112, 158, 196, 240, 282, 326]) {
    drawMiniGlyph(x, 26);
    drawMiniGlyph(x, 32);
  }

  return sharp(raw, { raw: { width, height, channels } }).png().toBuffer();
};

describe("borderCrop", () => {
  it("applies crop for clear white borders", async () => {
    const input = await makeBorderedPng({
      width: 300,
      height: 200,
      border: 20,
      borderColor: [255, 255, 255],
      centerColor: [220, 30, 30],
    });

    const decision = await analyzeBorderCrop(input);

    expect(decision.applied).toBe(true);
    expect(decision.cropBox.left).toBeGreaterThanOrEqual(18);
    expect(decision.cropBox.top).toBeGreaterThanOrEqual(18);
    expect(decision.cropBox.width).toBeLessThan(300);
    expect(decision.cropBox.height).toBeLessThan(200);
  });

  it("applies crop for clear black borders", async () => {
    const input = await makeBorderedPng({
      width: 260,
      height: 260,
      border: 16,
      borderColor: [0, 0, 0],
      centerColor: [20, 200, 60],
    });

    const decision = await analyzeBorderCrop(input);

    expect(decision.applied).toBe(true);
    expect(decision.trimmed.left).toBeGreaterThanOrEqual(14);
    expect(decision.trimmed.right).toBeGreaterThanOrEqual(14);
  });

  it("skips crop on noisy edges", async () => {
    const width = 300;
    const height = 220;
    const channels = 3;
    const raw = Buffer.alloc(width * height * channels);

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const isEdge = x < 20 || x >= width - 20 || y < 20 || y >= height - 20;
        const noise = (x * 13 + y * 7) % 255;
        const value = isEdge ? noise : 120;
        const offset = (y * width + x) * channels;
        raw[offset] = value;
        raw[offset + 1] = (value + 60) % 255;
        raw[offset + 2] = (value + 120) % 255;
      }
    }
    const input = await sharp(raw, { raw: { width, height, channels } }).png().toBuffer();

    const decision = await analyzeBorderCrop(input);
    expect(decision.applied).toBe(false);
  });

  it("applies crop for top and bottom bars only", async () => {
    const input = await makeHorizontalBarsPng({
      width: 320,
      height: 240,
      bar: 24,
      barColor: [0, 0, 0],
      centerColor: [140, 180, 220],
    });

    const decision = await analyzeBorderCrop(input);
    expect(decision.applied).toBe(true);
    expect(decision.trimmed.top).toBeGreaterThanOrEqual(20);
    expect(decision.trimmed.bottom).toBeGreaterThanOrEqual(20);
    expect(decision.trimmed.left).toBe(0);
    expect(decision.trimmed.right).toBe(0);
  });

  it("skips crop when bars include text-like sparse marks", async () => {
    const input = await makeHorizontalBarsWithSparseTextPng({
      width: 320,
      height: 240,
      bar: 24,
      barColor: [0, 0, 0],
      centerColor: [140, 180, 220],
      textColor: [40, 40, 40],
    });

    const decision = await analyzeBorderCrop(input);
    expect(decision.applied).toBe(false);
    expect(decision.reason).toBe("text-near-edge");
  });

  it("still crops text-like bars when text guard is disabled", async () => {
    const input = await makeHorizontalBarsWithSparseTextPng({
      width: 320,
      height: 240,
      bar: 24,
      barColor: [0, 0, 0],
      centerColor: [140, 180, 220],
      textColor: [40, 40, 40],
    });

    const decision = await analyzeBorderCrop(input, {
      textGuardEnabled: false,
    });
    expect(decision.applied).toBe(true);
    expect(decision.trimmed.top).toBeGreaterThan(0);
    expect(decision.trimmed.bottom).toBeGreaterThan(0);
  });

  it("skips deep trims when remaining ratio gate fails", async () => {
    const input = await makeBorderedPng({
      width: 240,
      height: 240,
      border: 80,
      borderColor: [255, 255, 255],
      centerColor: [100, 120, 140],
    });

    const decision = await analyzeBorderCrop(input, {
      maxTrimRatioPerSide: 0.45,
      minRemainingRatio: 0.7,
      minConfidence: 0.5,
    });

    expect(decision.applied).toBe(false);
    expect(decision.reason).toBe("remaining-ratio-too-low");
  });

  it("applies extract using decision crop box", async () => {
    const input = await makeBorderedPng({
      width: 240,
      height: 180,
      border: 20,
      borderColor: [255, 255, 255],
      centerColor: [10, 100, 240],
    });

    const decision = await analyzeBorderCrop(input);
    const cropped = await applyBorderCrop(input, decision);
    const metadata = await sharp(cropped).metadata();

    expect(metadata.width).toBe(decision.cropBox.width);
    expect(metadata.height).toBe(decision.cropBox.height);
  });

  it("detects centered embedded image rectangle in screenshot-like layout", async () => {
    const width = 420;
    const height = 760;
    const channels = 3;
    const raw = Buffer.alloc(width * height * channels);

    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        let color: [number, number, number] = [242, 242, 242];
        if (y < 90) color = [250, 250, 250];
        if (y >= 180 && y < 620 && x >= 22 && x < 398) color = [40, 120, 220];
        const offset = (y * width + x) * channels;
        raw[offset] = color[0];
        raw[offset + 1] = color[1];
        raw[offset + 2] = color[2];
      }
    }

    const input = await sharp(raw, { raw: { width, height, channels } }).png().toBuffer();
    const decision = await detectEmbeddedImageRect(input);

    expect(decision.applied).toBe(true);
    expect(decision.cropBox.left).toBeGreaterThanOrEqual(16);
    expect(decision.cropBox.top).toBeGreaterThanOrEqual(160);
    expect(decision.cropBox.width).toBeGreaterThanOrEqual(340);
    expect(decision.cropBox.height).toBeGreaterThanOrEqual(380);
  });

  it("skips embedded rect crop when discarded top band has caption-like text", async () => {
    const input = await makeScreenshotLikeWithTopCaptionPng();
    const decision = await detectEmbeddedImageRect(input);

    expect(decision.applied).toBe(false);
    expect(decision.reason).toBe("rect-text-near-edge");
  });

  it("allows embedded rect crop when rect text guard is disabled", async () => {
    const input = await makeScreenshotLikeWithTopCaptionPng();
    const decision = await detectEmbeddedImageRect(input, { textGuardEnabled: false });

    expect(decision.applied).toBe(true);
    expect(decision.reason).toBe("rect-applied");
  });

  it("skips embedded rect detection for full-frame photos", async () => {
    const input = await makeBorderedPng({
      width: 360,
      height: 260,
      border: 0,
      borderColor: [0, 0, 0],
      centerColor: [40, 130, 230],
    });

    const decision = await detectEmbeddedImageRect(input);
    expect(decision.applied).toBe(false);
  });
});
