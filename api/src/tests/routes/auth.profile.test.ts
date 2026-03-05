import { createHash } from "crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";

const state = vi.hoisted(() => ({
  sessionUser: null as null | {
    id: string;
    email: string;
    alias: string;
    role: string;
    createdAt: string;
  },
  uploadedImages: 0,
  voteCount: 0,
}));

const queryConvexVoteCountForProfile = vi.hoisted(() => vi.fn());
const queryConvexUploaderImageCount = vi.hoisted(() => vi.fn());
const mutateConvexUpsertUserProfile = vi.hoisted(() => vi.fn());
const mutateConvexUpdateUserAlias = vi.hoisted(() => vi.fn());
const getSessionUser = vi.hoisted(() => vi.fn());
const ensureSameOrigin = vi.hoisted(() => vi.fn());

vi.mock("../../platform/auth/session.js", () => ({
  getSessionUser,
  clearSessionCookie: vi.fn(),
  createSession: vi.fn(),
  deleteSession: vi.fn(),
  getSessionToken: vi.fn(),
  setSessionCookie: vi.fn(),
}));

vi.mock("../../platform/auth/csrf.js", () => ({
  ensureSameOrigin,
}));

vi.mock("../../platform/auth/email.js", () => ({
  sendMagicLinkEmail: vi.fn(),
}));

vi.mock("../../platform/auth/userProfile.js", () => ({
  resolveInvitedUploaderByEmail: vi.fn(),
}));

vi.mock("../../platform/convex/client.js", () => ({
  queryConvexUploaderImageCount,
  queryConvexVoteCountForProfile,
  mutateConvexUpdateUserAlias,
  mutateConvexUpsertUserProfile,
  mutateConvexConsumeAuthToken: vi.fn(),
  mutateConvexCreateAuthToken: vi.fn(),
}));

import authRouter from "../../features/auth/http/routes.js";

const createTestApp = () => {
  const app = new Hono();
  app.route("/api/v1/auth", authRouter);
  return app;
};

describe("auth profile routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.sessionUser = null;
    state.uploadedImages = 0;
    state.voteCount = 0;
    ensureSameOrigin.mockReturnValue(null);
    getSessionUser.mockImplementation(async () => state.sessionUser);
    queryConvexUploaderImageCount.mockImplementation(async () => ({ count: state.uploadedImages }));
    queryConvexVoteCountForProfile.mockImplementation(async () => ({ count: state.voteCount }));
    mutateConvexUpdateUserAlias.mockResolvedValue({ ok: true });
    mutateConvexUpsertUserProfile.mockResolvedValue({ ok: true });
  });

  it("returns 401 from GET /profile when not logged in", async () => {
    const app = createTestApp();
    const response = await app.request("http://localhost/api/v1/auth/profile");
    expect(response.status).toBe(401);
  });

  it("returns signup date and stats from GET /profile", async () => {
    state.sessionUser = {
      id: "user-1",
      email: "test@example.com",
      alias: "tester",
      role: "uploader",
      createdAt: "2026-01-01T00:00:00.000Z",
    };
    state.uploadedImages = 7;
    state.voteCount = 12;

    const app = createTestApp();
    const response = await app.request("http://localhost/api/v1/auth/profile", {
      headers: {
        cookie: "jm_voter=abc123",
      },
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.profile.createdAt).toBe("2026-01-01T00:00:00.000Z");
    expect(body.profile.uploadedImages).toBe(7);
    expect(body.profile.votesCast).toBe(12);

    const expectedHash = createHash("sha256").update("junkmail-dev-vote:abc123").digest("hex");
    expect(queryConvexVoteCountForProfile).toHaveBeenCalledWith({
      authUserId: "user-1",
      voterHash: expectedHash,
    });
  });

  it("rejects invalid alias on PATCH /profile", async () => {
    state.sessionUser = {
      id: "user-1",
      email: "test@example.com",
      alias: "tester",
      role: "uploader",
      createdAt: "2026-01-01T00:00:00.000Z",
    };

    const app = createTestApp();
    const response = await app.request("http://localhost/api/v1/auth/profile", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ alias: "bad alias" }),
    });

    expect(response.status).toBe(400);
    expect(mutateConvexUpsertUserProfile).not.toHaveBeenCalled();
  });

  it("updates alias on PATCH /profile", async () => {
    state.sessionUser = {
      id: "user-2",
      email: "edit@example.com",
      alias: "old_alias",
      role: "uploader",
      createdAt: "2026-01-02T00:00:00.000Z",
    };

    const app = createTestApp();
    const response = await app.request("http://localhost/api/v1/auth/profile", {
      method: "PATCH",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ alias: "new_alias" }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.profile.alias).toBe("new_alias");
    expect(mutateConvexUpdateUserAlias).toHaveBeenCalledWith({
      authUserId: "user-2",
      alias: "new_alias",
    });
    expect(mutateConvexUpsertUserProfile).toHaveBeenCalledWith({
      authUserId: "user-2",
      email: "edit@example.com",
      alias: "new_alias",
      role: "uploader",
    });
  });
});
