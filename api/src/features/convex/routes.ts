import { Hono } from "hono";
import { queryConvexHealth, resolveConvexUrl } from "../../convex/client.js";
import { jsonError } from "../../http/responses.js";

const convexRouter = new Hono();

convexRouter.get("/health", async (c) => {
  const configuredUrl = resolveConvexUrl();
  if (!configuredUrl) {
    return jsonError(c, 500, "Convex URL is not configured", "convex_unconfigured");
  }

  try {
    const { url, result } = await queryConvexHealth();
    return c.json({
      ok: true,
      convex: {
        url,
        ping: result,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Convex health query failed";
    return jsonError(c, 502, message, "convex_health_failed");
  }
});

export default convexRouter;
