import { beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";

const requireUploader = vi.hoisted(() => vi.fn());
const queryConvexImageByUploadId = vi.hoisted(() => vi.fn());
const mutateConvexRecordImageUploadProcessing = vi.hoisted(() => vi.fn());
const validateUpload = vi.hoisted(() => vi.fn());
const queueAdd = vi.hoisted(() => vi.fn());
const s3Send = vi.hoisted(() => vi.fn());
const publicObjectUrl = vi.hoisted(() => vi.fn());
const normalizePublicAssetUrl = vi.hoisted(() => vi.fn());

vi.mock("../../auth/session.js", () => ({
  getSessionUser: vi.fn(),
  requireUploader,
  requireAdmin: vi.fn(),
}));

vi.mock("../../convex/client.js", () => ({
  mutateConvexRecordImageUploadReceived: vi.fn(),
  mutateConvexRecordImageUploadProcessing,
  queryConvexDedupeStats: vi.fn(),
  queryConvexImageByUploadId,
  queryConvexRecentDedupeEvents: vi.fn(),
}));

vi.mock("../../queue/index.js", () => ({
  imageQueue: {
    add: queueAdd,
  },
}));

vi.mock("../../services/images/actions.js", () => ({
  validateUpload,
}));

vi.mock("../../storage/client.js", () => ({
  s3Client: { send: s3Send },
  storageBucket: "junkmail",
  publicObjectUrl,
}));

vi.mock("../../storage/publicUrls.js", () => ({
  normalizePublicAssetUrl,
}));

import uploadsRouter from "../../routes/uploads.js";

const createTestApp = () => {
  const app = new Hono();
  app.route("/api/v1/uploads", uploadsRouter);
  return app;
};

describe("uploads complete route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireUploader.mockImplementation(async (c: any, next: any) => {
      c.set("authUser", { id: "user-1" });
      await next();
    });
    s3Send.mockResolvedValue({});
    queueAdd.mockResolvedValue({});
    mutateConvexRecordImageUploadProcessing.mockResolvedValue({ ok: true });
    publicObjectUrl.mockImplementation((key: string) => `http://localhost/${key}`);
    normalizePublicAssetUrl.mockImplementation((value: string) => value);
  });

  it("stores upload and enqueues processing for pending upload", async () => {
    queryConvexImageByUploadId.mockResolvedValue({
      imageId: "img-1",
      uploadId: "up-1",
      uploaderAuthUserId: "user-1",
      description: "initial description",
      status: "pending",
    });

    validateUpload.mockImplementation((file: File) => ({
      ok: true,
      upload: file,
      type: "image/jpeg",
      ext: "jpg",
      status: 200,
    }));

    const app = createTestApp();
    const form = new FormData();
    form.set("uploadId", "up-1");
    form.set("description", "final description");
    form.set("file", new File([new Uint8Array([1, 2, 3])], "img.jpg", { type: "image/jpeg" }));

    const response = await app.request("http://localhost/api/v1/uploads/complete", {
      method: "POST",
      body: form,
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      uploadId: "up-1",
      imageId: "img-1",
      status: "processing",
    });

    expect(s3Send).toHaveBeenCalledTimes(1);
    expect(mutateConvexRecordImageUploadProcessing).toHaveBeenCalledWith(
      expect.objectContaining({
        imageId: "img-1",
        uploadId: "up-1",
        uploaderAuthUserId: "user-1",
        description: "final description",
        status: "processing",
        mime: "image/jpeg",
      }),
    );
    expect(queueAdd).toHaveBeenCalledWith(
      "process",
      expect.objectContaining({
        imageId: "img-1",
        uploadId: "up-1",
        ext: "jpg",
        contentType: "image/jpeg",
        dedupeV2: true,
      }),
      expect.any(Object),
    );
  });

  it("returns existing public upload state without writing or queueing", async () => {
    queryConvexImageByUploadId.mockResolvedValue({
      imageId: "img-public",
      uploadId: "up-public",
      status: "public",
      matchedImageId: "img-existing",
      rejectReason: null,
      originalUrl: "http://cdn.local/original.jpg",
    });

    const app = createTestApp();
    const form = new FormData();
    form.set("uploadId", "up-public");
    form.set("file", new File([new Uint8Array([1])], "img.jpg", { type: "image/jpeg" }));

    const response = await app.request("http://localhost/api/v1/uploads/complete", {
      method: "POST",
      body: form,
    });

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      uploadId: "up-public",
      imageId: "img-public",
      status: "public",
      matchedImageId: "img-existing",
      rejectReason: null,
      originalUrl: "http://cdn.local/original.jpg",
    });

    expect(validateUpload).not.toHaveBeenCalled();
    expect(s3Send).not.toHaveBeenCalled();
    expect(mutateConvexRecordImageUploadProcessing).not.toHaveBeenCalled();
    expect(queueAdd).not.toHaveBeenCalled();
  });
});
