import { beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";

const state = vi.hoisted(() => ({
  selectedUserId: "user-1",
  insertedUserValues: null as null | Record<string, unknown>,
  insertedImageValues: null as null | Record<string, unknown>,
  insertedRatingValues: null as null | Record<string, unknown>,
  queuedJob: null as null | Record<string, unknown>,
  s3PutCount: 0,
  insertCall: 0,
}));

vi.mock("../db/client.js", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => []),
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(async () => undefined),
      })),
    })),
    insert: vi.fn(() => {
      // telegram handler inserts in order: users (maybe), images, ratings
      const call = state.insertCall;
      state.insertCall += 1;

      if (call === 0) {
        return {
          values: vi.fn((values: Record<string, unknown>) => {
            state.insertedUserValues = values;
            return {
              returning: vi.fn(async () => [{ id: state.selectedUserId }]),
            };
          }),
        };
      }

      if (call === 1) {
        return {
          values: vi.fn((values: Record<string, unknown>) => {
            state.insertedImageValues = values;
            return Promise.resolve(undefined);
          }),
        };
      }

      return {
        values: vi.fn((values: Record<string, unknown>) => {
          state.insertedRatingValues = values;
          return Promise.resolve(undefined);
        }),
      };
    }),
  },
}));

vi.mock("../queue/index.js", () => ({
  imageQueue: {
    add: vi.fn((name: string, payload: Record<string, unknown>) => {
      state.queuedJob = { name, payload };
      return Promise.resolve(undefined);
    }),
  },
}));

vi.mock("../storage/client.js", () => ({
  publicObjectUrl: vi.fn(() => "http://localhost/object"),
  s3Client: {
    send: vi.fn(async () => {
      state.s3PutCount += 1;
      return undefined;
    }),
  },
  storageBucket: "junkmail",
}));

import telegramRouter from "./telegram.js";

const createTestApp = () => {
  const app = new Hono();
  app.route("/api/v1/telegram", telegramRouter);
  return app;
};

describe("telegram webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.insertedUserValues = null;
    state.insertedImageValues = null;
    state.insertedRatingValues = null;
    state.queuedJob = null;
    state.s3PutCount = 0;
    state.insertCall = 0;
    process.env.TELEGRAM_BOT_TOKEN = "test-token";
    process.env.TELEGRAM_ALLOWED_CHAT_IDS = "-100123";
    delete process.env.TELEGRAM_WEBHOOK_SECRET_TOKEN;

    const fetchMock = vi.fn(async (url: string) => {
      if (url.includes("/getFile")) {
        return new Response(
          JSON.stringify({ ok: true, result: { file_path: "photos/file.jpg" } }),
          {
            status: 200,
            headers: { "content-type": "application/json" },
          },
        );
      }

      if (url.includes("/file/bot")) {
        const body = new Uint8Array([1, 2, 3, 4]);
        return new Response(body, { status: 200 });
      }

      return new Response("not found", { status: 404 });
    });

    vi.stubGlobal("fetch", fetchMock);
  });

  it("ingests photo messages from allowed chat", async () => {
    const app = createTestApp();
    const response = await app.request("http://localhost/api/v1/telegram/webhook", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        update_id: 1,
        message: {
          message_id: 10,
          chat: { id: -100123, type: "supergroup", title: "junkmail" },
          from: { id: 777, username: "poster", first_name: "Poster" },
          photo: [{ file_id: "file-1", file_size: 123, width: 10, height: 10 }],
        },
      }),
    });

    expect(response.status).toBe(201);
    expect(state.insertedUserValues).toMatchObject({
      email: "tg-777@telegram.local",
      role: "uploader",
      telegramUserId: 777,
      telegramUsername: "poster",
    });
    expect(state.s3PutCount).toBe(1);
    expect(state.insertedImageValues).toMatchObject({
      uploaderId: "user-1",
      status: "processing",
    });
    expect(state.insertedRatingValues).toMatchObject({
      score: 0,
      comparisonsCount: 0,
    });
    expect(state.queuedJob?.name).toBe("process");
  });

  it("requires secret token header when configured", async () => {
    process.env.TELEGRAM_WEBHOOK_SECRET_TOKEN = "secret";
    const app = createTestApp();
    const response = await app.request("http://localhost/api/v1/telegram/webhook", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ update_id: 1 }),
    });
    expect(response.status).toBe(401);
  });
});
