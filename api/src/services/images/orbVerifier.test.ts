import { afterEach, describe, expect, it, vi } from "vitest";
import { verifyOrbCandidates } from "./orbVerifier.js";

describe("orbVerifier", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("sends auth header when shared secret is provided", async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ verified: false }),
    }));
    vi.stubGlobal("fetch", fetchMock as any);

    await verifyOrbCandidates({
      verifierUrl: "http://localhost:9090/verify/orb",
      uploadBuffer: Buffer.from([1, 2, 3]),
      candidates: [{ imageId: "img-1", url: "https://example.com/a.jpg" }],
      minInliers: 20,
      minInlierRatio: 0.25,
      minMatches: 60,
      sharedSecret: "secret-token",
      retries: 0,
    });

    const args = (fetchMock.mock.calls as any[])[0]?.[1] as any;
    expect(args.headers.authorization).toBe("Bearer secret-token");
  });

  it("retries on transient server errors", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 503 })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ verified: true, matchedImageId: "img-9" }),
      });
    vi.stubGlobal("fetch", fetchMock as any);

    const result = await verifyOrbCandidates({
      verifierUrl: "http://localhost:9090/verify/orb",
      uploadBuffer: Buffer.from([3, 2, 1]),
      candidates: [{ imageId: "img-9", url: "https://example.com/b.jpg" }],
      minInliers: 20,
      minInlierRatio: 0.25,
      minMatches: 60,
      retries: 1,
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.verified).toBe(true);
    expect(result.matchedImageId).toBe("img-9");
  });

  it("returns unverified on HTTP 422 without throwing", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      json: async () => ({ detail: "unprocessable payload" }),
    });
    vi.stubGlobal("fetch", fetchMock as any);

    const result = await verifyOrbCandidates({
      verifierUrl: "http://localhost:9090/verify/orb",
      uploadBuffer: Buffer.from([9, 9, 9]),
      candidates: [{ imageId: "img-1", url: "https://example.com/a.jpg" }],
      minInliers: 20,
      minInlierRatio: 0.25,
      minMatches: 60,
      retries: 1,
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ verified: false });
  });
});
