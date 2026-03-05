import { beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";

const resolveConvexUrl = vi.hoisted(() => vi.fn());
const queryConvexHealth = vi.hoisted(() => vi.fn());

vi.mock("../../platform/convex/client.js", () => ({
  resolveConvexUrl,
  queryConvexHealth,
}));

import convexRouter from "../../features/convex/http/routes.js";

const createTestApp = () => {
  const app = new Hono();
  app.route("/api/v1/convex", convexRouter);
  return app;
};

describe("convex route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 500 when convex URL is not configured", async () => {
    resolveConvexUrl.mockReturnValue("");

    const app = createTestApp();
    const response = await app.request("http://localhost/api/v1/convex/health");

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.error?.code).toBe("convex_unconfigured");
    expect(body.error?.message).toBe("Convex URL is not configured");
    expect(body.requestId).toBeDefined();
  });

  it("returns health payload when convex query succeeds", async () => {
    resolveConvexUrl.mockReturnValue("http://convex.localhost");
    queryConvexHealth.mockResolvedValue({
      url: "http://convex.localhost",
      result: { ok: true },
    });

    const app = createTestApp();
    const response = await app.request("http://localhost/api/v1/convex/health");

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.convex?.url).toBe("http://convex.localhost");
  });

  it("returns 502 when convex query fails", async () => {
    resolveConvexUrl.mockReturnValue("http://convex.localhost");
    queryConvexHealth.mockRejectedValue(new Error("upstream down"));

    const app = createTestApp();
    const response = await app.request("http://localhost/api/v1/convex/health");

    expect(response.status).toBe(502);
    const body = await response.json();
    expect(body.error?.code).toBe("convex_health_failed");
    expect(body.error?.message).toBe("upstream down");
  });
});
