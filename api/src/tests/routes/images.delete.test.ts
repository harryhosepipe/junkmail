import { beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";

const requireUploader = vi.hoisted(() => vi.fn());
const executeDeleteImage = vi.hoisted(() => vi.fn());

vi.mock("../../platform/auth/session.js", () => ({
  getSessionUser: vi.fn(),
  requireUploader,
  requireAdmin: vi.fn(),
}));

vi.mock("../../platform/auth/csrf.js", () => ({
  ensureSameOrigin: vi.fn(() => null),
}));

vi.mock("../../features/images/application/actions.js", () => ({
  createComment: vi.fn(),
  createImageUpload: vi.fn(),
  loadImageDetail: vi.fn(),
  reprocessImage: vi.fn(),
  validateUpload: vi.fn(),
}));

vi.mock("../../features/images/application/DeleteImage.js", () => ({
  executeDeleteImage,
}));

vi.mock("../../shared/application/images/cards.js", () => ({
  fetchRecentImages: vi.fn(async () => []),
  fetchTopCards: vi.fn(async () => []),
  pickThumbUrl: vi.fn(() => ""),
}));

vi.mock("../../platform/storage/publicUrls.js", () => ({
  normalizePublicAssetUrl: vi.fn((value) => value),
}));

import imagesRouter from "../../features/images/http/routes.js";

const createTestApp = () => {
  const app = new Hono();
  app.route("/api/v1/images", imagesRouter);
  return app;
};

describe("image delete route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUploader.mockImplementation(async (_c: any, next: any) => next());
  });

  it("returns 404 when image does not exist", async () => {
    executeDeleteImage.mockResolvedValue({
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
  });

  it("deletes image metadata and storage objects", async () => {
    executeDeleteImage.mockResolvedValue({
      ok: true,
      imageId: "img-1",
      deletedCounts: { images: 1, comments: 2 },
      storage: { attempted: 2, deleted: 2, failed: 0 },
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
  });

  it("returns success even if storage deletion partially fails", async () => {
    executeDeleteImage.mockResolvedValue({
      ok: true,
      imageId: "img-2",
      deletedCounts: { images: 1 },
      storage: { attempted: 2, deleted: 1, failed: 1 },
    });

    const app = createTestApp();
    const response = await app.request("http://localhost/api/v1/images/img-2", {
      method: "DELETE",
    });

    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload.storage).toEqual({ attempted: 2, deleted: 1, failed: 1 });
  });
});
