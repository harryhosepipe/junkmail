import type { Context } from "hono";
import { env } from "../env.js";

const allowedOrigins = new Set(
  [env.WEB_ORIGIN, env.WEB_BASE_URL, env.APP_ORIGIN, env.CORS_ORIGIN].filter(Boolean) as string[],
);
const isProd = env.NODE_ENV === "production";

const getOrigin = (c: Context) => {
  const origin = c.req.header("origin");
  if (origin) {
    return origin;
  }

  const referer = c.req.header("referer");
  if (!referer) {
    return null;
  }

  try {
    return new URL(referer).origin;
  } catch {
    return null;
  }
};

export const ensureSameOrigin = (c: Context) => {
  if (!allowedOrigins.size) {
    return null;
  }

  const origin = getOrigin(c);
  let requestOrigin: string | null = null;
  try {
    requestOrigin = new URL(c.req.url).origin;
  } catch {
    requestOrigin = null;
  }

  // Primary check: same-origin requests are always allowed.
  if (origin && requestOrigin && origin === requestOrigin) {
    return null;
  }

  if (!origin) {
    if (isProd) {
      return c.json({ error: { message: "Origin required" } }, 403);
    }
    return null;
  }

  if (!allowedOrigins.has(origin)) {
    return c.json({ error: { message: "Origin not allowed" } }, 403);
  }

  return null;
};
