import type { Context } from "hono";

export const readPayload = async (c: Context) => {
  const contentType = c.req.header("content-type") || "";
  if (contentType.includes("application/json")) {
    try {
      return await c.req.json();
    } catch {
      return {};
    }
  }

  try {
    return await c.req.parseBody();
  } catch {
    return {};
  }
};
