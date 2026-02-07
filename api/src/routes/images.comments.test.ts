import { beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";

const state = vi.hoisted(() => ({
  imageExists: true,
  insertedComment: {
    id: "comment-1",
    body: "Nice junkmail",
    createdAt: new Date("2026-02-07T00:00:00.000Z"),
  },
  insertedValues: null as null | {
    imageId: string;
    userId: string;
    body: string;
  },
  sessionUser: null as null | {
    id: string;
    alias: string;
    email: string;
    role: string;
  },
}));

const ensureSameOrigin = vi.hoisted(() => vi.fn());
const getSessionUser = vi.hoisted(() => vi.fn());

vi.mock("../db/client.js", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => (state.imageExists ? [{ id: "image-1" }] : [])),
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn((values: { imageId: string; userId: string; body: string }) => {
        state.insertedValues = values;
        return {
          returning: vi.fn(async () => [state.insertedComment]),
        };
      }),
    })),
  },
}));

vi.mock("../auth/session.js", () => ({
  getSessionUser,
  requireUploader: vi.fn(),
}));

vi.mock("../auth/csrf.js", () => ({
  ensureSameOrigin,
}));

vi.mock("../queue/connection.js", () => ({
  redis: {
    get: vi.fn(),
    set: vi.fn(),
  },
}));

vi.mock("../queue/index.js", () => ({
  imageQueue: {
    add: vi.fn(),
  },
}));

vi.mock("../storage/client.js", () => ({
  publicObjectUrl: vi.fn(() => "http://localhost/object"),
  s3Client: {
    send: vi.fn(),
  },
  storageBucket: "junkmail",
}));

vi.mock("../storage/publicUrls.js", () => ({
  extractStorageObjectKey: vi.fn(),
  normalizePublicAssetData: vi.fn((value) => value),
  normalizePublicAssetUrl: vi.fn((value) => value),
}));

vi.mock("../convex/client.js", () => ({
  queryConvexRatingsByImageIds: vi.fn(async () => []),
  queryConvexTopRatings: vi.fn(async () => []),
}));

vi.mock("../auth/userProfile.js", () => ({
  resolveAuthUserProfileById: vi.fn(async () => null),
}));

import imagesRouter from "./images.js";

const createTestApp = () => {
  const app = new Hono();
  app.route("/api/v1/images", imagesRouter);
  return app;
};

describe("image comments routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.imageExists = true;
    state.insertedValues = null;
    state.sessionUser = null;
    ensureSameOrigin.mockReturnValue(null);
    getSessionUser.mockImplementation(async () => state.sessionUser);
  });

  it("returns 401 when posting comment without auth", async () => {
    const app = createTestApp();
    const response = await app.request("http://localhost/api/v1/images/image-1/comments", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ body: "hello" }),
    });

    expect(response.status).toBe(401);
  });

  it("returns 404 when posting comment for missing image", async () => {
    state.imageExists = false;
    state.sessionUser = {
      id: "user-1",
      alias: "junklord",
      email: "user@example.com",
      role: "uploader",
    };

    const app = createTestApp();
    const response = await app.request("http://localhost/api/v1/images/image-1/comments", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ body: "hello" }),
    });

    expect(response.status).toBe(404);
  });

  it("returns 400 for empty comment", async () => {
    state.sessionUser = {
      id: "user-1",
      alias: "junklord",
      email: "user@example.com",
      role: "uploader",
    };

    const app = createTestApp();
    const response = await app.request("http://localhost/api/v1/images/image-1/comments", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ body: "   " }),
    });

    expect(response.status).toBe(400);
  });

  it("creates comment when payload is valid", async () => {
    state.sessionUser = {
      id: "user-1",
      alias: "junklord",
      email: "user@example.com",
      role: "uploader",
    };

    const app = createTestApp();
    const response = await app.request("http://localhost/api/v1/images/image-1/comments", {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({ body: "  Nice junkmail  " }),
    });

    expect(response.status).toBe(201);
    const payload = await response.json();
    expect(payload.comment.userAlias).toBe("junklord");
    expect(payload.comment.body).toBe("Nice junkmail");
    expect(state.insertedValues).toEqual({
      imageId: "image-1",
      userId: "user-1",
      body: "Nice junkmail",
    });
  });
});
