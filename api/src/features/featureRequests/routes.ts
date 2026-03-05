import { randomUUID } from "crypto";
import { Hono } from "hono";
import { ensureSameOrigin } from "../../auth/csrf.js";
import { getSessionUser } from "../../auth/session.js";
import {
  mutateConvexCreateFeatureRequest,
  queryConvexFeatureRequests,
} from "../../convex/client.js";
import { jsonError } from "../../http/responses.js";

const featureRequestsRouter = new Hono();

const toResponseItem = (row: {
  requestId: string;
  title: string;
  description: string;
  status: string;
  createdByAlias: string;
  createdAt: number;
}) => ({
  id: row.requestId,
  title: row.title,
  description: row.description,
  status: row.status,
  createdByAlias: row.createdByAlias,
  createdAt: new Date(row.createdAt).toISOString(),
});

featureRequestsRouter.get("/", async (c) => {
  const rawLimit = Number(c.req.query("limit") ?? "50");
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 100) : 50;
  const rows = await queryConvexFeatureRequests(limit);
  return c.json({ items: rows.map((row) => toResponseItem(row)) });
});

featureRequestsRouter.post("/", async (c) => {
  const csrfError = ensureSameOrigin(c);
  if (csrfError) {
    return csrfError;
  }

  const user = await getSessionUser(c);
  if (!user) {
    return jsonError(c, 401, "Unauthorized");
  }
  if (user.role !== "uploader" && user.role !== "admin") {
    return jsonError(c, 403, "Forbidden");
  }

  const body = await c.req.json().catch(() => ({}));
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const description = typeof body?.description === "string" ? body.description.trim() : "";

  if (title.length < 3 || title.length > 120) {
    return jsonError(c, 400, "Title must be between 3 and 120 characters");
  }
  if (description.length < 10 || description.length > 2000) {
    return jsonError(c, 400, "Description must be between 10 and 2000 characters");
  }

  const now = Date.now();
  const requestId = randomUUID();
  await mutateConvexCreateFeatureRequest({
    requestId,
    title,
    description,
    status: "open",
    createdByAuthUserId: user.id,
    createdByAlias: user.alias,
    createdAt: now,
    updatedAt: now,
  });

  return c.json(
    {
      ok: true,
      item: toResponseItem({
        requestId,
        title,
        description,
        status: "open",
        createdByAlias: user.alias,
        createdAt: now,
      }),
    },
    201,
  );
});

export default featureRequestsRouter;
