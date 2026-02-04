import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import imagesRouter from "./routes/images.js";

const app = new Hono();
const api = new Hono();

const isProd = process.env.NODE_ENV === "production";
const corsOrigin = process.env.CORS_ORIGIN || "http://localhost:4321";

app.use("*", logger());

app.onError((err, c) => {
  return c.json(
    {
      error: {
        message: err.message || "Unexpected error"
      }
    },
    500
  );
});

api.use(
  "*",
  cors({
    origin: isProd ? corsOrigin : "*",
    credentials: isProd
  })
);

api.get("/health", (c) => c.json({ ok: true }));
api.route("/images", imagesRouter);
app.route("/api/v1", api);

const port = Number(process.env.PORT) || 8787;

serve({ fetch: app.fetch, port });
