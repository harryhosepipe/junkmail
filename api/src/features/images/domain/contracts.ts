import { badRequest } from "../../../platform/http/errors.js";

export const COMMENT_MAX_LENGTH = 500;

export const parseCommentBody = (body: unknown) => {
  const data = (body ?? {}) as Record<string, unknown>;
  const text = typeof data.body === "string" ? data.body.trim() : "";
  if (!text) {
    throw badRequest("Comment cannot be empty.");
  }
  if (text.length > COMMENT_MAX_LENGTH) {
    throw badRequest(`Comment cannot exceed ${COMMENT_MAX_LENGTH} characters.`);
  }
  return text;
};
