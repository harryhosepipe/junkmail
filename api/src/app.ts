import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { randomUUID } from "crypto";
import authRouter from "./routes/auth.js";
import convexRouter from "./routes/convex.js";
import feedRouter from "./routes/feed.js";
import featureRequestsRouter from "./routes/featureRequests.js";
import imagesRouter from "./routes/images.js";
import matchupsRouter from "./routes/matchups.js";
import uploadsRouter from "./routes/uploads.js";
import telegramRouter from "./routes/telegram.js";
import votesRouter from "./routes/votes.js";
import { env } from "./env.js";
import { setRequestId } from "./http/context.js";
import { toErrorResponse } from "./http/errors.js";

export const createApp = () => {
  const app = new Hono();
  const api = new Hono();
  const corsOrigin =
    env.CORS_ORIGIN ??
    env.WEB_ORIGIN ??
    env.WEB_BASE_URL ??
    env.APP_ORIGIN ??
    "http://web.localhost";

  app.use("*", logger());
  app.use("*", async (c, next) => {
    const requestId = randomUUID();
    setRequestId(c, requestId);
    await next();
    c.header("x-request-id", requestId);
  });

  app.onError((err, c) => {
    return toErrorResponse(err, c);
  });

  api.use(
    "*",
    cors({
      origin: corsOrigin,
      credentials: true,
    }),
  );

  api.get("/health", (c) => c.json({ ok: true }));
  api.route("/convex", convexRouter);
  api.route("/auth", authRouter);
  api.route("/feed", feedRouter);
  api.route("/feature-requests", featureRequestsRouter);
  api.route("/images", imagesRouter);
  api.route("/uploads", uploadsRouter);
  api.route("/matchups", matchupsRouter);
  api.route("/telegram", telegramRouter);
  api.route("/votes", votesRouter);
  app.route("/api/v1", api);

  return app;
};

export const app = createApp();
