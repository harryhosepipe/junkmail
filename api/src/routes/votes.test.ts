import { beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";

const state = vi.hoisted(() => ({
  sessionUser: null as null | { id: string },
  rateLimitCount: 1,
  imageRows: [{ imageId: "img-a" }, { imageId: "img-b" }],
  validation: {
    acceptedForScoring: true,
    validationStatus: "accepted",
    rejectionReason: null as string | null,
  },
  queueShouldFail: false,
}));

const ensureSameOrigin = vi.hoisted(() => vi.fn());
const getSessionUser = vi.hoisted(() => vi.fn());
const queryConvexPublicImagesByIds = vi.hoisted(() => vi.fn());
const mutateConvexValidateAndConsumeMatchupToken = vi.hoisted(() => vi.fn());
const mutateConvexCreateVoteEvent = vi.hoisted(() => vi.fn());
const mutateConvexProjectVoteEvent = vi.hoisted(() => vi.fn());
const queueAdd = vi.hoisted(() => vi.fn());
const redisIncr = vi.hoisted(() => vi.fn());
const redisExpire = vi.hoisted(() => vi.fn());

vi.mock("../auth/csrf.js", () => ({
  ensureSameOrigin,
}));

vi.mock("../auth/session.js", () => ({
  getSessionUser,
}));

vi.mock("../queue/connection.js", () => ({
  redis: {
    incr: redisIncr,
    expire: redisExpire,
  },
}));

vi.mock("../queue/index.js", () => ({
  voteQueue: {
    add: queueAdd,
  },
}));

vi.mock("../convex/client.js", () => ({
  queryConvexPublicImagesByIds,
  mutateConvexValidateAndConsumeMatchupToken,
  mutateConvexCreateVoteEvent,
  mutateConvexProjectVoteEvent,
}));

import votesRouter from "./votes.js";

const createTestApp = () => {
  const app = new Hono();
  app.route("/api/v1/votes", votesRouter);
  return app;
};

describe("votes route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.sessionUser = null;
    state.rateLimitCount = 1;
    state.imageRows = [{ imageId: "img-a" }, { imageId: "img-b" }];
    state.validation = {
      acceptedForScoring: true,
      validationStatus: "accepted",
      rejectionReason: null,
    };
    state.queueShouldFail = false;

    ensureSameOrigin.mockReturnValue(null);
    getSessionUser.mockImplementation(async () => state.sessionUser);
    redisIncr.mockImplementation(async () => state.rateLimitCount);
    redisExpire.mockResolvedValue(1);
    queryConvexPublicImagesByIds.mockImplementation(async () => state.imageRows);
    mutateConvexValidateAndConsumeMatchupToken.mockImplementation(async () => state.validation);
    mutateConvexCreateVoteEvent.mockResolvedValue({ ok: true, alreadyExists: false });
    mutateConvexProjectVoteEvent.mockResolvedValue({ ok: true, projectionStatus: "applied" });
    queueAdd.mockImplementation(async () => {
      if (state.queueShouldFail) {
        throw new Error("queue down");
      }
    });
  });

  it("accepts valid matchup token and enqueues projection", async () => {
    const app = createTestApp();
    const response = await app.request("http://localhost/api/v1/votes", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: "jm_voter=voter-1",
      },
      body: JSON.stringify({
        image_a_id: "img-a",
        image_b_id: "img-b",
        winner_id: "img-a",
        matchup_token: "token-1",
      }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.acceptedForScoring).toBe(true);
    expect(body.validationStatus).toBe("accepted");
    expect(body.eventId).toEqual(expect.any(String));
    expect(queueAdd).toHaveBeenCalledTimes(1);
    expect(mutateConvexProjectVoteEvent).not.toHaveBeenCalled();
  });

  it("records replay tokens but does not enqueue scoring", async () => {
    state.validation = {
      acceptedForScoring: false,
      validationStatus: "rejected_replay",
      rejectionReason: "token_replayed",
    };

    const app = createTestApp();
    const response = await app.request("http://localhost/api/v1/votes", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: "jm_voter=voter-1",
      },
      body: JSON.stringify({
        image_a_id: "img-a",
        image_b_id: "img-b",
        winner_id: "img-b",
        matchup_token: "token-replay",
      }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.acceptedForScoring).toBe(false);
    expect(body.validationStatus).toBe("rejected_replay");
    expect(queueAdd).not.toHaveBeenCalled();
    expect(mutateConvexCreateVoteEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        validationStatus: "rejected_replay",
        rejectionReason: "token_replayed",
      }),
    );
  });

  it("falls back to direct projection when queue add fails", async () => {
    state.queueShouldFail = true;

    const app = createTestApp();
    const response = await app.request("http://localhost/api/v1/votes", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: "jm_voter=voter-1",
      },
      body: JSON.stringify({
        image_a_id: "img-a",
        image_b_id: "img-b",
        winner_id: "img-a",
        matchup_token: "token-2",
      }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.ok).toBe(true);
    expect(body.acceptedForScoring).toBe(true);
    expect(mutateConvexProjectVoteEvent).toHaveBeenCalledTimes(1);
  });

  it("records invalid token votes but does not score them", async () => {
    state.validation = {
      acceptedForScoring: false,
      validationStatus: "rejected_invalid_token",
      rejectionReason: "token_not_found",
    };

    const app = createTestApp();
    const response = await app.request("http://localhost/api/v1/votes", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: "jm_voter=voter-2",
      },
      body: JSON.stringify({
        image_a_id: "img-a",
        image_b_id: "img-b",
        winner_id: "img-b",
        matchup_token: "bad-token",
      }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.acceptedForScoring).toBe(false);
    expect(body.validationStatus).toBe("rejected_invalid_token");
    expect(queueAdd).not.toHaveBeenCalled();
    expect(mutateConvexCreateVoteEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        validationStatus: "rejected_invalid_token",
        rejectionReason: "token_not_found",
      }),
    );
  });

  it("records expired token votes but does not score them", async () => {
    state.validation = {
      acceptedForScoring: false,
      validationStatus: "rejected_expired",
      rejectionReason: "token_expired",
    };

    const app = createTestApp();
    const response = await app.request("http://localhost/api/v1/votes", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: "jm_voter=voter-3",
      },
      body: JSON.stringify({
        image_a_id: "img-a",
        image_b_id: "img-b",
        winner_id: "img-a",
        matchup_token: "expired-token",
      }),
    });

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.acceptedForScoring).toBe(false);
    expect(body.validationStatus).toBe("rejected_expired");
    expect(queueAdd).not.toHaveBeenCalled();
    expect(mutateConvexCreateVoteEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        validationStatus: "rejected_expired",
        rejectionReason: "token_expired",
      }),
    );
  });

  it("handles replay race: one accepted and one replay for same token", async () => {
    mutateConvexValidateAndConsumeMatchupToken
      .mockResolvedValueOnce({
        acceptedForScoring: true,
        validationStatus: "accepted",
        rejectionReason: null,
      })
      .mockResolvedValueOnce({
        acceptedForScoring: false,
        validationStatus: "rejected_replay",
        rejectionReason: "token_replayed",
      });

    const app = createTestApp();
    const req = {
      method: "POST",
      headers: {
        "content-type": "application/json",
        cookie: "jm_voter=voter-race",
      },
      body: JSON.stringify({
        image_a_id: "img-a",
        image_b_id: "img-b",
        winner_id: "img-a",
        matchup_token: "same-token",
      }),
    } as const;

    const [resA, resB] = await Promise.all([
      app.request("http://localhost/api/v1/votes", req),
      app.request("http://localhost/api/v1/votes", req),
    ]);

    expect(resA.status).toBe(200);
    expect(resB.status).toBe(200);

    const [bodyA, bodyB] = await Promise.all([resA.json(), resB.json()]);
    const acceptedCount = [bodyA, bodyB].filter((body) => body.acceptedForScoring).length;
    const replayCount = [bodyA, bodyB].filter(
      (body) => body.validationStatus === "rejected_replay",
    ).length;

    expect(acceptedCount).toBe(1);
    expect(replayCount).toBe(1);
    expect(queueAdd).toHaveBeenCalledTimes(1);
    expect(mutateConvexCreateVoteEvent).toHaveBeenCalledTimes(2);
  });
});
