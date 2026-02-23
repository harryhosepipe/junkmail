import { Hono } from "hono";
import { getSessionUser, requireUploader } from "../auth/session.js";
import { ensureSameOrigin } from "../auth/csrf.js";
import { parseCommentBody } from "../contracts/comments.js";
import { env } from "../env.js";
import { getAuthUser } from "../http/context.js";
import { AppError } from "../http/errors.js";
import { readPayload } from "../http/readPayload.js";
import { jsonError } from "../http/responses.js";
import { toHttpStatus } from "../http/status.js";
import { executeDeleteImage } from "../application/images/DeleteImage.js";
import {
  createComment,
  createImageUpload,
  loadImageDetail,
  reprocessImage,
  validateUpload,
} from "../services/images/actions.js";
import { fetchRecentImages, fetchTopCards } from "../services/images/cards.js";
import {
  mapToplistRowsToHttp,
  parseRecentLimit,
  parseToplistQuery,
} from "../services/images/http.js";
import { mapImageUploadDomainToHttp } from "../presentation/http/images/mappers.js";

const imagesRouter = new Hono();

imagesRouter.post("/", requireUploader, async (c) => {
  const body = await c.req.parseBody();
  const description = typeof body.description === "string" ? body.description.trim() : "";

  const uploadCheck = validateUpload(body.file);
  if (!uploadCheck.ok) {
    return jsonError(c, toHttpStatus(uploadCheck.status), uploadCheck.message);
  }

  const authUser = getAuthUser(c);
  if (!authUser) {
    return jsonError(c, 401, "Unauthorized");
  }
  const created = await createImageUpload({
    authUser,
    description,
    upload: uploadCheck.upload,
    type: uploadCheck.type,
    ext: uploadCheck.ext,
  });

  const response = mapImageUploadDomainToHttp(created);
  return c.json(response.body, response.status);
});

imagesRouter.get("/recent", async (c) => {
  const limit = parseRecentLimit(c.req.query("limit"));
  const rows = await fetchRecentImages(limit);

  return c.json({ items: rows });
});

imagesRouter.get("/top", async (c) => {
  const { limit, minComparisons } = parseToplistQuery(c.req.query("limit"), c.req.query("min"));

  const rows = await fetchTopCards(limit, minComparisons);
  return c.json(mapToplistRowsToHttp(rows));
});

imagesRouter.get("/:id", async (c) => {
  const imageId = c.req.param("id");
  const detail = await loadImageDetail(imageId);
  if (!detail) {
    return jsonError(c, 404, "Image not found");
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
    return jsonError(c, 401, "Unauthorized");
  }

  const body = await readPayload(c);
  let text = "";
  try {
    text = parseCommentBody(body);
  } catch (err) {
    if (err instanceof AppError) {
      return jsonError(c, toHttpStatus(err.status), err.message);
    }
    throw err;
  }

  const imageId = c.req.param("id");
  const comment = await createComment({ imageId, user: { id: user.id, alias: user.alias }, text });
  if (!comment) {
    return jsonError(c, 404, "Image not found");
  }

  return c.json({ comment }, 201);
});

imagesRouter.post("/:id/reprocess", async (c) => {
  if (env.NODE_ENV === "production") {
    return jsonError(c, 404, "Not available");
  }

  const imageId = c.req.param("id");
  const result = await reprocessImage(imageId);
  if (!result.ok) {
    return jsonError(c, toHttpStatus(result.status), result.message);
  }

  return c.json({ ok: true });
});

imagesRouter.delete("/:id", requireUploader, async (c) => {
  const imageId = c.req.param("id");
  const result = await executeDeleteImage(imageId);
  if (!result.ok) {
    return jsonError(c, toHttpStatus(result.status), result.message);
  }

  return c.json({
    ok: true,
    imageId: result.imageId,
    deletedCounts: result.deletedCounts,
    storage: result.storage,
  });
});

export { fetchRecentImages, fetchTopCards };
export default imagesRouter;
