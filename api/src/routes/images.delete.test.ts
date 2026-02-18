import { beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";

const requireUploader = vi.hoisted(() => vi.fn());
const s3Send = vi.hoisted(() => vi.fn());
const deleteImage = vi.hoisted(() => vi.fn());

vi.mock("../auth/session.js", () => ({
  getSessionUser: vi.fn(),
  requireUploader,
  requireAdmin: vi.fn(),
}));

vi.mock("../auth/csrf.js", () => ({
  ensureSameOrigin: vi.fn(() => null),
}));

vi.mock("../services/images/actions.js", () => ({
  createComment: vi.fn(),
  createImageUpload: vi.fn(),
  deleteImage,
  loadImageDetail: vi.fn(),
  reprocessImage: vi.fn(),
  validateUpload: vi.fn(),
}));

vi.mock("../services/images/cards.js", () => ({
  fetchRecentImages: vi.fn(async () => []),
  fetchTopCards: vi.fn(async () => []),
  pickThumbUrl: vi.fn(() => ""),
}));

vi.mock("../storage/client.js", () => ({
  s3Client: { send: s3Send },
  storageBucket: "junkmail",
  publicObjectUrl: vi.fn(() => "http://localhost/object"),
}));

vi.mock("../storage/publicUrls.js", () => ({
  normalizePublicAssetUrl: vi.fn((value) => value),
}));

import imagesRouter from "./images.js";

const createTestApp = () => {
  const app = new Hono();
  app.route("/api/v1/images", imagesRouter);
  return app;
};

describe("image delete route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUploader.mockImplementation(async (_c: any, next: any) => next());
    s3Send.mockResolvedValue({});
  });

  it("returns 404 when image does not exist", async () => {
    deleteImage.mockResolvedValue({
      ok: false,
      status: 404,
      message: "Image not found",
    });

    const app = createTestApp();
    const response = await app.request("http://localhost/api/v1/images/missing-image", {
      method: "DELETE",
    });

    expect(response.status).toBe(404);
    const payload = await response.json();
    expect(payload.error.message).toBe("Image not found");
    expect(s3Send).not.toHaveBeenCalled();
  });

  it("deletes image metadata and storage objects", async () => {
    deleteImage.mockResolvedValue({
      ok: true,
      imageId: "img-1",
      storageKeys: ["images/img-1/original.jpg", "images/img-1/full.webp"],
      deletedCounts: { images: 1, comments: 2 },
    });

    const app = createTestApp();
    const response = await app.request("http://localhost/api/v1/images/img-1", {
      method: "DELETE",
    });

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.ok).toBe(true);
    expect(payload.imageId).toBe("img-1");
    expect(payload.deletedCounts).toEqual({ images: 1, comments: 2 });
    expect(payload.storage).toEqual({ attempted: 2, deleted: 2, failed: 0 });
    expect(s3Send).toHaveBeenCalledTimes(2);
  });

  it("returns success even if storage deletion partially fails", async () => {
    deleteImage.mockResolvedValue({
      ok: true,
      imageId: "img-2",
      storageKeys: ["images/img-2/original.jpg", "images/img-2/feed.webp"],
      deletedCounts: { images: 1 },
    });
    s3Send.mockResolvedValueOnce({}).mockRejectedValueOnce(new Error("storage unavailable"));

    const app = createTestApp();
    const response = await app.request("http://localhost/api/v1/images/img-2", {
      method: "DELETE",
    });

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.storage).toEqual({ attempted: 2, deleted: 1, failed: 1 });
  });
});
