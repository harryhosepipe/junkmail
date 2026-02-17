import { beforeEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";

const state = vi.hoisted(() => ({
  selectedUserId: "user-1",
  telegramUpsertValues: null as null | Record<string, unknown>,
  convexUpsertValues: null as null | Record<string, unknown>,
  queuedJob: null as null | Record<string, unknown>,
  s3PutCount: 0,
}));

const mutateConvexUpsertImageContent = vi.hoisted(() => vi.fn());
const mutateConvexUpsertTelegramUser = vi.hoisted(() => vi.fn());

vi.mock("../convex/client.js", () => ({
  mutateConvexUpsertImageContent,
  mutateConvexUpsertTelegramUser,
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
    state.telegramUpsertValues = null;
    state.convexUpsertValues = null;
    state.queuedJob = null;
    state.s3PutCount = 0;
    mutateConvexUpsertTelegramUser.mockImplementation(async (values) => {
      state.telegramUpsertValues = values;
      return { authUserId: state.selectedUserId };
    });
    mutateConvexUpsertImageContent.mockImplementation(async (values) => {
      state.convexUpsertValues = values;
      return { ok: true };
    });
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
    expect(state.telegramUpsertValues).toMatchObject({
      email: "tg-777@telegram.local",
      role: "uploader",
      telegramUserId: 777,
      telegramUsername: "poster",
    });
    expect(state.s3PutCount).toBe(1);
    expect(state.convexUpsertValues).toMatchObject({
      uploaderAuthUserId: "user-1",
      status: "processing",
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
