import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { analyzeBorderCrop, applyBorderCrop } from "./borderCrop.js";

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
});
