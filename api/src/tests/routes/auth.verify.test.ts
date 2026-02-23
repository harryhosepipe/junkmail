import { beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";

const state = vi.hoisted(() => ({
  consumed: null as null | { userAuthUserId: string },
}));

const mutateConvexConsumeAuthToken = vi.hoisted(() => vi.fn());
const createSession = vi.hoisted(() => vi.fn());
const setSessionCookie = vi.hoisted(() => vi.fn());

vi.mock("../../auth/session.js", () => ({
  createSession,
  setSessionCookie,
  clearSessionCookie: vi.fn(),
  deleteSession: vi.fn(),
  getSessionToken: vi.fn(),
  getSessionUser: vi.fn(),
}));

vi.mock("../../auth/csrf.js", () => ({
  ensureSameOrigin: vi.fn(() => null),
}));

vi.mock("../../auth/email.js", () => ({
  sendMagicLinkEmail: vi.fn(),
}));

vi.mock("../../auth/userProfile.js", () => ({
  resolveInvitedUploaderByEmail: vi.fn(),
}));

vi.mock("../../convex/client.js", () => ({
  mutateConvexConsumeAuthToken,
  mutateConvexCreateAuthToken: vi.fn(),
  mutateConvexUpdateUserAlias: vi.fn(),
  mutateConvexUpsertUserProfile: vi.fn(),
  queryConvexUploaderImageCount: vi.fn(),
  queryConvexVoteCountForProfile: vi.fn(),
}));

import authRouter from "../../routes/auth.js";

const createTestApp = () => {
  const app = new Hono();
  app.route("/api/v1/auth", authRouter);
  return app;
};

describe("auth verify route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.consumed = null;
    mutateConvexConsumeAuthToken.mockImplementation(async () => state.consumed);
    createSession.mockResolvedValue({
      token: "session-token",
      expiresAt: new Date("2026-02-18T00:00:00.000Z"),
    });
  });

  it("redirects to login with invalid flag when token is missing", async () => {
    const app = createTestApp();
    const response = await app.request("http://localhost/api/v1/auth/verify");
    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("/login?error=invalid");
  });

  it("redirects to next path and sets session when token is valid", async () => {
    state.consumed = { userAuthUserId: "user-1" };
    const app = createTestApp();
    const response = await app.request(
      "http://localhost/api/v1/auth/verify?token=abc123&next=/profile",
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain("/profile");
    expect(createSession).toHaveBeenCalledWith("user-1");
    expect(setSessionCookie).toHaveBeenCalledTimes(1);
  });
});
