import { Hono } from "hono";
import { requireUploader } from "../auth/session.js";
import {
  completeUpload,
  getDedupeStats,
  getRecentDedupeEvents,
  getUploadStatus,
  initUpload,
} from "../services/uploads/workflows.js";

const uploadsRouter = new Hono();

uploadsRouter.post("/init", requireUploader, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const authUser = (c as any).get("authUser") as { id: string };
  const response = await initUpload({
    authUserId: authUser.id,
    description: typeof body?.description === "string" ? body.description : undefined,
    mime: typeof body?.mime === "string" ? body.mime : undefined,
  });
  return c.json(response.body, response.status as any);
});

uploadsRouter.post("/complete", requireUploader, async (c) => {
  const body = await c.req.parseBody();
  const response = await completeUpload(body as Record<string, unknown>);
  return c.json(response.body, response.status as any);
});

uploadsRouter.get("/:id/status", requireUploader, async (c) => {
  const uploadId = c.req.param("id");
  const response = await getUploadStatus(uploadId);
  return c.json(response.body, response.status as any);
});

uploadsRouter.get("/dedupe/stats", requireUploader, async (c) => {
  const stats = await getDedupeStats(c.req.query("windowHours"), c.req.query("sampleLimit"));
  return c.json(stats);
});

uploadsRouter.get("/dedupe/events", requireUploader, async (c) => {
  const items = await getRecentDedupeEvents(c.req.query("limit"));
  return c.json({ items });
});

export default uploadsRouter;
