import type { Context, Next } from "hono";
import { getCookie, setCookie, deleteCookie } from "hono/cookie";
import { and, eq, gt } from "drizzle-orm";
import { db } from "../db/client.js";
import { sessions, users } from "../db/schema.js";
import { ensureSameOrigin } from "./csrf.js";
import { generateToken, hashToken } from "./tokens.js";

const SESSION_COOKIE_NAME = "jm_session";
const SESSION_TTL_DAYS = Number(process.env.SESSION_TTL_DAYS) || 30;
const SESSION_TTL_MS = SESSION_TTL_DAYS * 24 * 60 * 60 * 1000;
const isProd = process.env.NODE_ENV === "production";

export const createSession = async (userId: string) => {
  const token = generateToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);

  await db.insert(sessions).values({ userId, tokenHash, expiresAt });

  return { token, expiresAt };
};

export const setSessionCookie = (c: Context, token: string, expiresAt: Date) => {
  setCookie(c, SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "Lax",
    path: "/",
    expires: expiresAt,
  });
};

export const clearSessionCookie = (c: Context) => {
  deleteCookie(c, SESSION_COOKIE_NAME, { path: "/" });
};

export const getSessionToken = (c: Context) => getCookie(c, SESSION_COOKIE_NAME);

export const deleteSession = async (token: string) => {
  const tokenHash = hashToken(token);
  await db.delete(sessions).where(eq(sessions.tokenHash, tokenHash));
};

export const getSessionUser = async (c: Context) => {
  const token = getSessionToken(c);
  if (!token) {
    return null;
  }

  const tokenHash = hashToken(token);
  const result = await db
    .select({ id: users.id, email: users.email, role: users.role })
    .from(sessions)
    .innerJoin(users, eq(sessions.userId, users.id))
    .where(and(eq(sessions.tokenHash, tokenHash), gt(sessions.expiresAt, new Date())))
    .limit(1);

  return result[0] ?? null;
};

export const requireUploader = async (c: Context, next: Next) => {
  const csrfError = ensureSameOrigin(c);
  if (csrfError) {
    return csrfError;
  }

  const user = await getSessionUser(c);
  if (!user) {
    return c.json({ error: { message: "Unauthorized" } }, 401);
  }

  if (user.role !== "uploader") {
    return c.json({ error: { message: "Forbidden" } }, 403);
  }

  c.set("authUser", user);
  return next();
};
