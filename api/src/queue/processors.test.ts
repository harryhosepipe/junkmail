import { beforeEach, describe, expect, it, vi } from "vitest";

const sharpFactory = vi.hoisted(() => vi.fn());
const analyzeBorderCrop = vi.hoisted(() => vi.fn());
const applyBorderCrop = vi.hoisted(() => vi.fn());

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
    expect(analyzeBorderCrop).toHaveBeenCalledTimes(1);
    expect(applyBorderCrop).toHaveBeenCalledTimes(1);

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

    analyzeBorderCrop.mockResolvedValue({
      applied: true,
      reason: "applied",
      confidence: 0.92,
      originalWidth: 1200,
      originalHeight: 800,
      cropBox: { left: 50, top: 30, width: 1100, height: 740 },
      trimmed: { top: 30, right: 50, bottom: 30, left: 50 },
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
    expect(mutateConvexSetImageProcessingResult).toHaveBeenCalledWith(
      expect.objectContaining({
        variantUrls: expect.objectContaining({
          thumb: expect.objectContaining({
            cropApplied: true,
            cropReason: "applied",
            cropConfidence: 0.92,
            cropBox: { left: 50, top: 30, width: 1100, height: 740 },
          }),
        }),
      }),
    );
  });
});
