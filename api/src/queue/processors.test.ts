import { beforeEach, describe, expect, it, vi } from "vitest";

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
    default: vi.fn(() => ({ resize })),
  };
});

import { processImageJob, processVoteJob, toBuffer } from "./processors.js";

const makeStream = async function* (chunks: number[][]) {
  for (const chunk of chunks) {
    yield Uint8Array.from(chunk);
  }
};

describe("queue processors", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
