import type { Context } from "hono";
import { getRequestId } from "./context.js";
import type { HttpStatus } from "./status.js";

type ErrorPayload = {
  error: {
    message: string;
    code: string;
  } & Record<string, unknown>;
  requestId: string;
};

const defaultCodeByStatus: Partial<Record<HttpStatus, string>> = {
  400: "bad_request",
  401: "unauthorized",
  403: "forbidden",
  404: "not_found",
  409: "conflict",
  429: "rate_limited",
  500: "internal_error",
  502: "bad_gateway",
  503: "service_unavailable",
};

export const jsonError = (
  c: Context,
  status: HttpStatus,
  message: string,
  code?: string,
  details?: Record<string, unknown>,
) => {
  const requestId = getRequestId(c) || "unknown";
  const resolvedCode = code || defaultCodeByStatus[status] || "unknown_error";
  const body: ErrorPayload = {
    error: details ? { message, code: resolvedCode, ...details } : { message, code: resolvedCode },
    requestId,
  };
  return c.json(body, status);
};
