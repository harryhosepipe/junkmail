import type { Context } from "hono";
import { getRequestId } from "./context.js";
import { toHttpStatus } from "./status.js";

export class AppError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export const badRequest = (message: string, code = "bad_request") =>
  new AppError(400, code, message);

export const unauthorized = (message = "Unauthorized", code = "unauthorized") =>
  new AppError(401, code, message);

export const forbidden = (message = "Forbidden", code = "forbidden") =>
  new AppError(403, code, message);

export const notFound = (message = "Not found", code = "not_found") =>
  new AppError(404, code, message);

export const serviceUnavailable = (message = "Service unavailable", code = "service_unavailable") =>
  new AppError(503, code, message);

export const toErrorResponse = (err: unknown, c: Context) => {
  const requestId = getRequestId(c);
  if (err instanceof AppError) {
    c.status(toHttpStatus(err.status));
    return c.json({
      error: {
        code: err.code,
        message: err.message,
      },
      requestId,
    });
  }

  const message = err instanceof Error ? err.message : "Unexpected error";
  c.status(500);
  return c.json({
    error: {
      code: "internal_error",
      message,
    },
    requestId,
  });
};
