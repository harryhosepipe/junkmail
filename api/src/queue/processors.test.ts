import { beforeEach, describe, expect, it, vi } from "vitest";

const sharpFactory = vi.hoisted(() => vi.fn());
const analyzeBorderCrop = vi.hoisted(() => vi.fn());
const applyBorderCrop = vi.hoisted(() => vi.fn());
const detectEmbeddedImageRect = vi.hoisted(() => vi.fn());
const applyCropBox = vi.hoisted(() => vi.fn());

vi.mock("sharp", () => {
  const createEncoded = (label: string) => ({
    toBuffer: async () => Buffer.from(label),
  });

  const clone = () => ({
    avif: () => createEncoded("avif"),
    webp: () => createEncoded("webp"),
    png: () => createEncoded("png"),
    jpeg: () => createEncoded("jpeg"),
  });

  const resize = () => ({ clone });

  return {
    default: sharpFactory.mockImplementation(() => ({ resize })),
  };
});

vi.mock("./borderCrop.js", () => ({
  analyzeBorderCrop,
  applyBorderCrop,
  detectEmbeddedImageRect,
  applyCropBox,
}));

import { processImageJob, processVoteJob, toBuffer } from "./processors.js";

const makeStream = async function* (chunks: number[][]) {
  for (const chunk of chunks) {
    yield Uint8Array.from(chunk);
  }
};

describe("queue processors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    analyzeBorderCrop.mockResolvedValue({
      applied: false,
      reason: "not-needed",
      confidence: 0,
      originalWidth: 100,
      originalHeight: 100,
      cropBox: { left: 0, top: 0, width: 100, height: 100 },
      trimmed: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    applyBorderCrop.mockImplementation(async (input: Buffer) => input);
    detectEmbeddedImageRect.mockResolvedValue({
      applied: false,
      reason: "rect-no-candidate",
      confidence: 0,
      originalWidth: 100,
      originalHeight: 100,
      cropBox: { left: 0, top: 0, width: 100, height: 100 },
    });
    applyCropBox.mockImplementation(async (input: Buffer) => input);
  });

  it("toBuffer concatenates stream chunks", async () => {
    const result = await toBuffer(
      makeStream([
        [1, 2],
        [3, 4],
      ]),
    );
    expect(Array.from(result)).toEqual([1, 2, 3, 4]);
  });

  it("toBuffer throws when body is missing", async () => {
    await expect(toBuffer(null)).rejects.toThrow("Missing object body");
  });

  it("processVoteJob projects vote event", async () => {
    const mutateConvexProjectVoteEvent = vi.fn(async () => ({ ok: true }));

    await processVoteJob(
      {
        voteEventId: "vote-1",
        createdAt: 123,
      },
      { mutateConvexProjectVoteEvent },
    );

    expect(mutateConvexProjectVoteEvent).toHaveBeenCalledWith({
      voteEventId: "vote-1",
      now: 123,
    });
  });

  it("processImageJob writes variants and updates Convex", async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce({ Body: makeStream([[9, 9, 9]]) })
      .mockResolvedValue({});
    const mutateConvexSetImageProcessingResult = vi.fn(async () => ({ ok: true }));

    await processImageJob(
      {
        imageId: "img-1",
        key: "images/img-1/original.jpg",
        ext: "jpg",
        contentType: "image/jpeg",
      },
      {
        s3Client: { send },
        storageBucket: "junkmail",
        publicObjectUrl: (key) => `https://assets.local/${key}`,
        variantKey: (imageId, size, format) => `${imageId}/${size}.${format}`,
        mutateConvexSetImageProcessingResult,
      },
    );

    // 1 get original + (3 sizes * 3 puts)
    expect(send).toHaveBeenCalledTimes(10);
    expect(mutateConvexSetImageProcessingResult).toHaveBeenCalledTimes(1);
    expect(detectEmbeddedImageRect).toHaveBeenCalledTimes(1);
    expect(analyzeBorderCrop).toHaveBeenCalledTimes(1);
    expect(applyBorderCrop).not.toHaveBeenCalled();

    expect(mutateConvexSetImageProcessingResult).toHaveBeenCalledWith(
      expect.objectContaining({
        imageId: "img-1",
        status: "public",
        variantUrls: expect.objectContaining({
          thumb: expect.objectContaining({ avif: expect.stringContaining("img-1/thumb.avif") }),
          feed: expect.objectContaining({ webp: expect.stringContaining("img-1/feed.webp") }),
          full: expect.objectContaining({ jpg: expect.stringContaining("img-1/full.jpg") }),
        }),
      }),
    );
  });

  it("uses cropped buffer when crop analyzer applies", async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce({ Body: makeStream([[7, 7, 7]]) })
      .mockResolvedValue({});
    const mutateConvexSetImageProcessingResult = vi.fn(async () => ({ ok: true }));

    analyzeBorderCrop
      .mockResolvedValueOnce({
        applied: true,
        reason: "applied",
        confidence: 0.92,
        originalWidth: 1200,
        originalHeight: 800,
        cropBox: { left: 50, top: 30, width: 1100, height: 740 },
        trimmed: { top: 30, right: 50, bottom: 30, left: 50 },
      })
      .mockResolvedValueOnce({
        applied: false,
        reason: "not-needed",
        confidence: 0,
        originalWidth: 1100,
        originalHeight: 740,
        cropBox: { left: 0, top: 0, width: 1100, height: 740 },
        trimmed: { top: 0, right: 0, bottom: 0, left: 0 },
      });
    applyBorderCrop.mockResolvedValue(Buffer.from([5, 5, 5]));

    await processImageJob(
      {
        imageId: "img-2",
        key: "images/img-2/original.jpg",
        ext: "jpg",
        contentType: "image/jpeg",
      },
      {
        s3Client: { send },
        storageBucket: "junkmail",
        publicObjectUrl: (key) => `https://assets.local/${key}`,
        variantKey: (imageId, size, format) => `${imageId}/${size}.${format}`,
        mutateConvexSetImageProcessingResult,
      },
    );

    expect(sharpFactory).toHaveBeenCalledWith(Buffer.from([5, 5, 5]));
    expect(applyBorderCrop).toHaveBeenCalledTimes(1);
    expect(mutateConvexSetImageProcessingResult).toHaveBeenCalledWith(
      expect.objectContaining({
        variantUrls: expect.objectContaining({
          thumb: expect.objectContaining({
            cropApplied: true,
            cropReason: "bar-applied",
            cropConfidence: 0.92,
            cropMode: "border_only",
            cropPasses: 1,
            cropBox: { left: 50, top: 30, width: 1100, height: 740 },
          }),
        }),
      }),
    );
  });

  it("aggregates multi-pass crops to remove residual bars", async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce({ Body: makeStream([[8, 8, 8]]) })
      .mockResolvedValue({});
    const mutateConvexSetImageProcessingResult = vi.fn(async () => ({ ok: true }));

    analyzeBorderCrop
      .mockResolvedValueOnce({
        applied: true,
        reason: "applied",
        confidence: 0.9,
        originalWidth: 1000,
        originalHeight: 800,
        cropBox: { left: 0, top: 120, width: 1000, height: 560 },
        trimmed: { top: 120, right: 0, bottom: 120, left: 0 },
      })
      .mockResolvedValueOnce({
        applied: true,
        reason: "applied",
        confidence: 0.88,
        originalWidth: 1000,
        originalHeight: 560,
        cropBox: { left: 0, top: 20, width: 1000, height: 520 },
        trimmed: { top: 20, right: 0, bottom: 20, left: 0 },
      })
      .mockResolvedValueOnce({
        applied: false,
        reason: "not-needed",
        confidence: 0,
        originalWidth: 1000,
        originalHeight: 520,
        cropBox: { left: 0, top: 0, width: 1000, height: 520 },
        trimmed: { top: 0, right: 0, bottom: 0, left: 0 },
      });
    applyBorderCrop.mockResolvedValue(Buffer.from([4, 4, 4]));

    await processImageJob(
      {
        imageId: "img-3",
        key: "images/img-3/original.jpg",
        ext: "jpg",
        contentType: "image/jpeg",
      },
      {
        s3Client: { send },
        storageBucket: "junkmail",
        publicObjectUrl: (key) => `https://assets.local/${key}`,
        variantKey: (imageId, size, format) => `${imageId}/${size}.${format}`,
        mutateConvexSetImageProcessingResult,
      },
    );

    expect(analyzeBorderCrop).toHaveBeenCalledTimes(3);
    expect(applyBorderCrop).toHaveBeenCalledTimes(2);
    expect(mutateConvexSetImageProcessingResult).toHaveBeenCalledWith(
      expect.objectContaining({
        variantUrls: expect.objectContaining({
          thumb: expect.objectContaining({
            cropApplied: true,
            cropReason: "bar-applied-multi-pass",
            cropPasses: 2,
            cropMode: "border_only",
            cropBox: { left: 0, top: 140, width: 1000, height: 520 },
          }),
        }),
      }),
    );
  });

  it("applies embedded rect before border passes", async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce({ Body: makeStream([[8, 8, 8]]) })
      .mockResolvedValue({});
    const mutateConvexSetImageProcessingResult = vi.fn(async () => ({ ok: true }));

    detectEmbeddedImageRect.mockResolvedValue({
      applied: true,
      reason: "rect-applied",
      confidence: 0.78,
      originalWidth: 1200,
      originalHeight: 1600,
      cropBox: { left: 80, top: 260, width: 1040, height: 980 },
    });
    applyCropBox.mockResolvedValue(Buffer.from([6, 6, 6]));
    analyzeBorderCrop
      .mockResolvedValueOnce({
        applied: true,
        reason: "applied",
        confidence: 0.91,
        originalWidth: 1040,
        originalHeight: 980,
        cropBox: { left: 0, top: 40, width: 1040, height: 900 },
        trimmed: { top: 40, right: 0, bottom: 40, left: 0 },
      })
      .mockResolvedValueOnce({
        applied: false,
        reason: "not-needed",
        confidence: 0,
        originalWidth: 1040,
        originalHeight: 900,
        cropBox: { left: 0, top: 0, width: 1040, height: 900 },
        trimmed: { top: 0, right: 0, bottom: 0, left: 0 },
      });
    applyBorderCrop.mockResolvedValue(Buffer.from([7, 7, 7]));

    await processImageJob(
      {
        imageId: "img-4",
        key: "images/img-4/original.jpg",
        ext: "jpg",
        contentType: "image/jpeg",
      },
      {
        s3Client: { send },
        storageBucket: "junkmail",
        publicObjectUrl: (key) => `https://assets.local/${key}`,
        variantKey: (imageId, size, format) => `${imageId}/${size}.${format}`,
        mutateConvexSetImageProcessingResult,
      },
    );

    expect(applyCropBox).toHaveBeenCalledTimes(1);
    expect(applyBorderCrop).toHaveBeenCalledTimes(1);
    expect(mutateConvexSetImageProcessingResult).toHaveBeenCalledWith(
      expect.objectContaining({
        variantUrls: expect.objectContaining({
          thumb: expect.objectContaining({
            cropApplied: true,
            cropMode: "embedded_rect_then_border",
            cropPasses: 1,
            cropBox: { left: 80, top: 300, width: 1040, height: 900 },
            cropStages: expect.arrayContaining(["rect-applied", "applied"]),
          }),
        }),
      }),
    );
  });

  it("marks crop applied when only embedded rect detection runs", async () => {
    const send = vi
      .fn()
      .mockResolvedValueOnce({ Body: makeStream([[3, 3, 3]]) })
      .mockResolvedValue({});
    const mutateConvexSetImageProcessingResult = vi.fn(async () => ({ ok: true }));

    detectEmbeddedImageRect.mockResolvedValue({
      applied: true,
      reason: "rect-applied",
      confidence: 0.8,
      originalWidth: 900,
      originalHeight: 1200,
      cropBox: { left: 40, top: 120, width: 820, height: 860 },
    });
    applyCropBox.mockResolvedValue(Buffer.from([3, 3, 3]));
    analyzeBorderCrop.mockResolvedValue({
      applied: false,
      reason: "not-needed",
      confidence: 0,
      originalWidth: 820,
      originalHeight: 860,
      cropBox: { left: 0, top: 0, width: 820, height: 860 },
      trimmed: { top: 0, right: 0, bottom: 0, left: 0 },
    });

    await processImageJob(
      {
        imageId: "img-5",
        key: "images/img-5/original.jpg",
        ext: "jpg",
        contentType: "image/jpeg",
      },
      {
        s3Client: { send },
        storageBucket: "junkmail",
        publicObjectUrl: (key) => `https://assets.local/${key}`,
        variantKey: (imageId, size, format) => `${imageId}/${size}.${format}`,
        mutateConvexSetImageProcessingResult,
      },
    );

    expect(mutateConvexSetImageProcessingResult).toHaveBeenCalledWith(
      expect.objectContaining({
        variantUrls: expect.objectContaining({
          thumb: expect.objectContaining({
            cropApplied: true,
            cropReason: "rect-applied",
            cropMode: "embedded_rect",
            cropBox: { left: 40, top: 120, width: 820, height: 860 },
          }),
        }),
      }),
    );
  });
});
