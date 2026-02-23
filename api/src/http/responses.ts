import type { Context } from "hono";
import type { HttpStatus } from "./status.js";

type ErrorPayload = {
  error: {
    message: string;
    code?: string;
  };
};

export const jsonError = (c: Context, status: HttpStatus, message: string, code?: string) => {
  const body: ErrorPayload = code ? { error: { message, code } } : { error: { message } };
  return c.json(body, status);
};
