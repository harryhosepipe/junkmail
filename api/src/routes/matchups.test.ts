import { beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";

const state = vi.hoisted(() => ({
  rows: [] as Array<{
    imageId: string;
    title?: string;
    description?: string;
    originalUrl?: string;
    variantUrls?: Record<string, unknown>;
    createdAt: number;
  }>,
  ratings: [] as Array<{ imageId: string; score?: number; comparisonsCount?: number }>,
  issuedTokens: [] as Array<Record<string, unknown>>,
}));

const queryConvexPublicImages = vi.hoisted(() => vi.fn());
const queryConvexRatingsByImageIds = vi.hoisted(() => vi.fn());
const mutateConvexIssueMatchupToken = vi.hoisted(() => vi.fn());
const redisGet = vi.hoisted(() => vi.fn());
const redisSet = vi.hoisted(() => vi.fn());
const generateToken = vi.hoisted(() => vi.fn());

vi.mock("../convex/client.js", () => ({
  queryConvexPublicImages,
  queryConvexRatingsByImageIds,
  mutateConvexIssueMatchupToken,
}));

vi.mock("../queue/connection.js", () => ({
  redis: {
    get: redisGet,
    set: redisSet,
  },
}));

vi.mock("../auth/tokens.js", () => ({
  generateToken,
}));

import matchupsRouter from "./matchups.js";

const createTestApp = () => {
  const app = new Hono();
  app.route("/api/v1/matchups", matchupsRouter);
  return app;
};

describe("matchups route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.rows = [];
    state.ratings = [];
    state.issuedTokens = [];

    queryConvexPublicImages.mockImplementation(async () => state.rows);
    queryConvexRatingsByImageIds.mockImplementation(async () => state.ratings);
    mutateConvexIssueMatchupToken.mockImplementation(async (args) => {
      state.issuedTokens.push(args);
      return { ok: true };
    });
    redisGet.mockResolvedValue(null);
    redisSet.mockResolvedValue("OK");
    generateToken.mockImplementation(() => `token-${state.issuedTokens.length + 1}`);
  });

  it("returns 404 when there are fewer than two public images", async () => {
    state.rows = [
      {
        imageId: "img-1",
        title: "One",
        description: "",
        originalUrl: "/assets/a.jpg",
        variantUrls: {},
        createdAt: Date.now(),
      },
    ];

    const app = createTestApp();
    const response = await app.request("http://localhost/api/v1/matchups/next");
    expect(response.status).toBe(404);
  });

  it("issues matchup payload and token when candidates exist", async () => {
    const now = Date.now();
    state.rows = [
      {
        imageId: "img-a",
        title: "A",
        description: "",
        originalUrl: "/assets/a.jpg",
        variantUrls: {},
        createdAt: now,
      },
      {
        imageId: "img-b",
        title: "B",
        description: "",
        originalUrl: "/assets/b.jpg",
        variantUrls: {},
        createdAt: now - 10,
      },
      {
        imageId: "img-c",
        title: "C",
        description: "",
        originalUrl: "/assets/c.jpg",
        variantUrls: {},
        createdAt: now - 20,
      },
    ];
    state.ratings = [
      { imageId: "img-a", score: 10, comparisonsCount: 2 },
      { imageId: "img-b", score: 11, comparisonsCount: 2 },
      { imageId: "img-c", score: 9, comparisonsCount: 1 },
    ];

    const app = createTestApp();
    const response = await app.request("http://localhost/api/v1/matchups/next");
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.matchup_token).toEqual(expect.stringContaining("token-"));
    expect(body.a?.id).toBeTruthy();
    expect(body.b?.id).toBeTruthy();
    expect(body.a?.id).not.toBe(body.b?.id);
    expect(state.issuedTokens).toHaveLength(1);
  });
});
