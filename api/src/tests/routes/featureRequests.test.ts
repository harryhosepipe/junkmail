import { beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";

const ensureSameOrigin = vi.hoisted(() => vi.fn());
const getSessionUser = vi.hoisted(() => vi.fn());
const queryConvexFeatureRequests = vi.hoisted(() => vi.fn());
const mutateConvexCreateFeatureRequest = vi.hoisted(() => vi.fn());

vi.mock("../../platform/auth/csrf.js", () => ({
  ensureSameOrigin,
}));

vi.mock("../../platform/auth/session.js", () => ({
  getSessionUser,
  requireUploader: vi.fn(),
  requireAdmin: vi.fn(),
}));

vi.mock("../../platform/convex/client.js", () => ({
  queryConvexFeatureRequests,
  mutateConvexCreateFeatureRequest,
}));

import featureRequestsRouter from "../../features/featureRequests/http/routes.js";

const createTestApp = () => {
  const app = new Hono();
  app.route("/api/v1/feature-requests", featureRequestsRouter);
  return app;
};

describe("feature requests route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ensureSameOrigin.mockReturnValue(null);
    getSessionUser.mockResolvedValue({
      id: "user-1",
      alias: "pablo",
      role: "uploader",
    });
    queryConvexFeatureRequests.mockResolvedValue([]);
    mutateConvexCreateFeatureRequest.mockResolvedValue({ ok: true });
  });

  it("lists feature requests", async () => {
    queryConvexFeatureRequests.mockResolvedValue([
      {
        requestId: "fr-1",
        title: "Add favorites",
        description: "Let users favorite images and filter by favorites.",
        status: "open",
        createdByAlias: "pablo",
        createdAt: 1700000000000,
      },
    ]);

    const app = createTestApp();
    const response = await app.request("http://localhost/api/v1/feature-requests?limit=10");
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.items).toHaveLength(1);
    expect(body.items[0].id).toBe("fr-1");
    expect(queryConvexFeatureRequests).toHaveBeenCalledWith(10);
  });

  it("requires auth to submit feature requests", async () => {
    getSessionUser.mockResolvedValue(null);
    const app = createTestApp();
    const response = await app.request("http://localhost/api/v1/feature-requests", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "Add dark mode",
        description: "Allow users to switch to dark mode in settings.",
      }),
    });

    expect(response.status).toBe(401);
    expect(mutateConvexCreateFeatureRequest).not.toHaveBeenCalled();
  });

  it("validates submission payload", async () => {
    const app = createTestApp();
    const response = await app.request("http://localhost/api/v1/feature-requests", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "x",
        description: "short",
      }),
    });

    expect(response.status).toBe(400);
    expect(mutateConvexCreateFeatureRequest).not.toHaveBeenCalled();
  });

  it("creates a feature request", async () => {
    const app = createTestApp();
    const response = await app.request("http://localhost/api/v1/feature-requests", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: "Support tags",
        description: "Let uploads include tags so browsing by topic is easier.",
      }),
    });

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.item.title).toBe("Support tags");
    expect(body.item.status).toBe("open");
    expect(mutateConvexCreateFeatureRequest).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "Support tags",
        description: "Let uploads include tags so browsing by topic is easier.",
        createdByAuthUserId: "user-1",
      }),
    );
  });
});
