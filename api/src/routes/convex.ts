import { Hono } from "hono";
import { queryConvexHealth, resolveConvexUrl } from "../convex/client.js";

const convexRouter = new Hono();

convexRouter.get("/health", async (c) => {
  const configuredUrl = resolveConvexUrl();
  if (!configuredUrl) {
    return c.json(
      {
        ok: false,
        error: "Convex URL is not configured",
      },
      500,
    );
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
    return c.json(
      {
        ok: false,
        error: message,
      },
      502,
    );
  }
});

export default convexRouter;
