import { Hono } from "hono";
import { getSessionUser, requireUploader } from "../auth/session.js";
import { ensureSameOrigin } from "../auth/csrf.js";
import { parseCommentBody } from "../contracts/comments.js";
import { env } from "../env.js";
import { AppError } from "../http/errors.js";
import { readPayload } from "../http/readPayload.js";
import {
  createComment,
  createImageUpload,
  loadImageDetail,
  reprocessImage,
  validateUpload,
} from "../services/images/actions.js";
import { fetchRecentImages, fetchTopCards, pickThumbUrl } from "../services/images/cards.js";
import { normalizePublicAssetUrl } from "../storage/publicUrls.js";

const TOPLIST_MIN_COMPARISONS = env.TOPLIST_MIN_COMPARISONS ?? 10;

const imagesRouter = new Hono();

imagesRouter.post("/", requireUploader, async (c) => {
  const body = await c.req.parseBody();
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";

  const uploadCheck = validateUpload(body.file);
  if (!uploadCheck.ok) {
    return c.json({ error: { message: uploadCheck.message } }, uploadCheck.status as any);
  }

  const authUser = (c as any).get("authUser") as { id: string; email?: string; alias?: string };
  const created = await createImageUpload({
    authUser,
    title,
    description,
    upload: uploadCheck.upload,
    type: uploadCheck.type,
    ext: uploadCheck.ext,
  });

  return c.json(created, (created as any).httpStatus ?? (created.duplicate ? 200 : 201));
});

imagesRouter.get("/recent", async (c) => {
  const rawLimit = Number(c.req.query("limit") ?? "4");
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 12) : 4;
  const rows = await fetchRecentImages(limit);

  return c.json({ items: rows });
});

imagesRouter.get("/top", async (c) => {
  const rawLimit = Number(c.req.query("limit") ?? "50");
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 100) : 50;
  const rawMin = Number(c.req.query("min") ?? `${TOPLIST_MIN_COMPARISONS}`);
  const minComparisons = Number.isFinite(rawMin) && rawMin >= 0 ? rawMin : TOPLIST_MIN_COMPARISONS;

  const rows = await fetchTopCards(limit, minComparisons);

  return c.json(
    rows.map((row) => ({
      id: row.id,
      score: row.score ?? 0,
      votes: row.votes ?? 0,
      thumb_url: pickThumbUrl(row.variantUrls) || normalizePublicAssetUrl(row.originalUrl) || "",
    })),
  );
});

imagesRouter.get("/:id", async (c) => {
  const imageId = c.req.param("id");
  const detail = await loadImageDetail(imageId);
  if (!detail) {
    return c.json({ error: { message: "Image not found" } }, 404);
  }

  return c.json(detail);
});

imagesRouter.post("/:id/comments", async (c) => {
  const csrfError = ensureSameOrigin(c);
  if (csrfError) {
    return csrfError;
  }

  const user = await getSessionUser(c);
  if (!user) {
    return c.json({ error: { message: "Unauthorized" } }, 401);
  }

  const body = await readPayload(c);
  let text = "";
  try {
    text = parseCommentBody(body);
  } catch (err) {
    if (err instanceof AppError) {
      return c.json({ error: { message: err.message } }, err.status as any);
    }
    throw err;
  }

  const imageId = c.req.param("id");
  const comment = await createComment({ imageId, user: { id: user.id, alias: user.alias }, text });
  if (!comment) {
    return c.json({ error: { message: "Image not found" } }, 404);
  }

  return c.json({ comment }, 201);
});

imagesRouter.post("/:id/reprocess", async (c) => {
  if (env.NODE_ENV === "production") {
    return c.json({ error: { message: "Not available" } }, 404);
  }

  const imageId = c.req.param("id");
  const result = await reprocessImage(imageId);
  if (!result.ok) {
    return c.json({ error: { message: result.message } }, result.status as any);
  }

  return c.json({ ok: true });
});

export { fetchRecentImages, fetchTopCards };
export default imagesRouter;
