import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { computeImageFingerprint, isNearDuplicate, similarityAnchor } from "./perceptualHash.js";

const makeSolidWithCenter = async (args: {
  width: number;
  height: number;
  bg: [number, number, number];
  center: [number, number, number];
}) => {
  const { width, height, bg, center } = args;
  const channels = 3;
  const raw = Buffer.alloc(width * height * channels);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const inCenter = x > width * 0.2 && x < width * 0.8 && y > height * 0.2 && y < height * 0.8;
      const color = inCenter ? center : bg;
      const idx = (y * width + x) * channels;
      raw[idx] = color[0];
      raw[idx + 1] = color[1];
      raw[idx + 2] = color[2];
    }
  }
  return sharp(raw, { raw: { width, height, channels } }).png().toBuffer();
};

describe("perceptualHash", () => {
  it("builds stable fingerprint", async () => {
    const input = await makeSolidWithCenter({
      width: 320,
      height: 220,
      bg: [240, 240, 240],
      center: [40, 100, 220],
    });
    const first = await computeImageFingerprint(input);
    const second = await computeImageFingerprint(input);

    expect(first).toEqual(second);
    expect(first.full).toHaveLength(16);
    expect(similarityAnchor(first, 2)).toHaveLength(2);
  });

  it("matches near-duplicate crop variant", async () => {
    const base = await makeSolidWithCenter({
      width: 380,
      height: 600,
      bg: [245, 245, 245],
      center: [30, 130, 230],
    });
    const cropped = await sharp(base)
      .extract({ left: 12, top: 18, width: 356, height: 564 })
      .toBuffer();

    const baseFp = await computeImageFingerprint(base);
    const cropFp = await computeImageFingerprint(cropped);

    expect(
      isNearDuplicate({
        incoming: cropFp,
        existing: baseFp,
      }),
    ).toBe(true);
  });

  it("matches near-duplicate with stronger aspect change", async () => {
    const base = await makeSolidWithCenter({
      width: 700,
      height: 420,
      bg: [245, 245, 245],
      center: [30, 130, 230],
    });
    const cropped = await sharp(base)
      .extract({ left: 140, top: 30, width: 340, height: 340 })
      .toBuffer();

    const baseFp = await computeImageFingerprint(base);
    const cropFp = await computeImageFingerprint(cropped);

    expect(
      isNearDuplicate({
        incoming: cropFp,
        existing: baseFp,
      }),
    ).toBe(true);
  });

  it("does not match clearly different image", async () => {
    const a = await makeSolidWithCenter({
      width: 360,
      height: 240,
      bg: [245, 245, 245],
      center: [35, 115, 220],
    });
    const b = await makeSolidWithCenter({
      width: 360,
      height: 240,
      bg: [5, 5, 5],
      center: [220, 40, 20],
    });

    const aFp = await computeImageFingerprint(a);
    const bFp = await computeImageFingerprint(b);

    expect(
      isNearDuplicate({
        incoming: aFp,
        existing: bFp,
      }),
    ).toBe(false);
  });
});
