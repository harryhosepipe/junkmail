import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { randomUUID } from "crypto";
import authRouter from "../features/auth/http/routes.js";
import convexRouter from "../features/convex/http/routes.js";
import feedRouter from "../features/feed/http/routes.js";
import featureRequestsRouter from "../features/featureRequests/http/routes.js";
import imagesRouter from "../features/images/http/routes.js";
import matchupsRouter from "../features/matchups/http/routes.js";
import uploadsRouter from "../features/uploads/http/routes.js";
import telegramRouter from "../features/telegram/http/routes.js";
import votesRouter from "../features/voting/http/routes.js";
import { env } from "../env.js";
import { setRequestId } from "../platform/http/context.js";
import { toErrorResponse } from "../platform/http/errors.js";

export const createApp = () => {
  const app = new Hono();
  const api = new Hono();
  const corsOrigin = env.WEB_ORIGIN ?? "http://127.0.0.1:4321";

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
