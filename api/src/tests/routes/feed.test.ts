import { beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";

const getOrCreateVoterHash = vi.hoisted(() => vi.fn());
const fetchRecentImages = vi.hoisted(() => vi.fn());
const fetchTopCards = vi.hoisted(() => vi.fn());
const createMatchupPayload = vi.hoisted(() => vi.fn());

vi.mock("../../platform/auth/voter.js", () => ({
  getOrCreateVoterHash,
}));

vi.mock("../../shared/application/images/cards.js", () => ({
  fetchRecentImages,
  fetchTopCards,
}));

vi.mock("../../features/matchups/application/createMatchupPayload.js", () => ({
  createMatchupPayload,
}));

import feedRouter from "../../features/feed/http/routes.js";

const createTestApp = () => {
  const app = new Hono();
  app.route("/api/v1/feed", feedRouter);
  return app;
};

describe("feed route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getOrCreateVoterHash.mockReturnValue("voter-1");
    createMatchupPayload.mockResolvedValue({ a: { id: "a" }, b: { id: "b" } });
  });

  it("returns deduped mixed feed and matchup payload", async () => {
    fetchRecentImages.mockResolvedValue([
      { id: "img-1", source: "recent" },
      { id: "img-2", source: "recent" },
    ]);
    fetchTopCards.mockResolvedValue([
      { id: "img-2", source: "top" },
      { id: "img-3", source: "top" },
    ]);

    const app = createTestApp();
    const response = await app.request("http://localhost/api/v1/feed/home?limit=4");

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.feed).toHaveLength(3);
    expect(body.feed.map((item: { id: string }) => item.id)).toEqual(["img-1", "img-2", "img-3"]);
    expect(body.matchup).toEqual({ a: { id: "a" }, b: { id: "b" } });
    expect(createMatchupPayload).toHaveBeenCalledWith({ voterHash: "voter-1" });
  });

  it("caps limit at 20 and defaults invalid limit to 8", async () => {
    fetchRecentImages.mockResolvedValue([]);
    fetchTopCards.mockResolvedValue([]);

    const app = createTestApp();
    await app.request("http://localhost/api/v1/feed/home?limit=200");
    expect(fetchRecentImages).toHaveBeenCalledWith(10);
    expect(fetchTopCards).toHaveBeenCalledWith(10);

    await app.request("http://localhost/api/v1/feed/home?limit=abc");
    expect(fetchRecentImages).toHaveBeenLastCalledWith(4);
    expect(fetchTopCards).toHaveBeenLastCalledWith(4);
  });
});
