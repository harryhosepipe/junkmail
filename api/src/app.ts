import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import authRouter from "./routes/auth.js";
import convexRouter from "./routes/convex.js";
import feedRouter from "./routes/feed.js";
import imagesRouter from "./routes/images.js";
import matchupsRouter from "./routes/matchups.js";
import telegramRouter from "./routes/telegram.js";
import votesRouter from "./routes/votes.js";
import { env } from "./env.js";

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

  app.onError((err, c) => {
    return c.json(
      {
        error: {
          message: err.message || "Unexpected error",
        },
      },
      500,
    );
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
  api.route("/images", imagesRouter);
  api.route("/matchups", matchupsRouter);
  api.route("/telegram", telegramRouter);
  api.route("/votes", votesRouter);
  app.route("/api/v1", api);

  return app;
};

export const app = createApp();
