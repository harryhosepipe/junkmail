import { beforeEach, describe, expect, it, vi } from "vitest";

const deleteImage = vi.hoisted(() => vi.fn());
const s3Send = vi.hoisted(() => vi.fn());

vi.mock("../../services/images/actions.js", () => ({
  deleteImage,
}));

vi.mock("../../storage/client.js", () => ({
  s3Client: { send: s3Send },
  storageBucket: "junkmail",
}));

import { executeDeleteImage } from "./DeleteImage.js";

describe("executeDeleteImage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns not found result from delete service", async () => {
    deleteImage.mockResolvedValue({
      ok: false,
      status: 404,
      message: "Image not found",
    });

    await expect(executeDeleteImage("missing")).resolves.toEqual({
      ok: false,
      status: 404,
      message: "Image not found",
    });
    expect(s3Send).not.toHaveBeenCalled();
  });

  it("deletes all storage keys and reports summary", async () => {
    deleteImage.mockResolvedValue({
      ok: true,
      imageId: "img-1",
      storageKeys: ["images/img-1/original.jpg", "images/img-1/full.webp"],
      deletedCounts: { images: 1, comments: 2 },
    });
    s3Send.mockResolvedValue({});

    await expect(executeDeleteImage("img-1")).resolves.toEqual({
      ok: true,
      imageId: "img-1",
      deletedCounts: { images: 1, comments: 2 },
      storage: { attempted: 2, deleted: 2, failed: 0 },
    });
    expect(s3Send).toHaveBeenCalledTimes(2);
  });

  it("reports partial failure when storage deletion fails", async () => {
    deleteImage.mockResolvedValue({
      ok: true,
      imageId: "img-2",
      storageKeys: ["images/img-2/original.jpg", "images/img-2/full.webp"],
      deletedCounts: { images: 1 },
    });
    s3Send.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error("storage unavailable"));

    await expect(executeDeleteImage("img-2")).resolves.toEqual({
      ok: true,
      imageId: "img-2",
      deletedCounts: { images: 1 },
      storage: { attempted: 2, deleted: 1, failed: 1 },
    });
  });
});
