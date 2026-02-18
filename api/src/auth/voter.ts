import { createHash } from "crypto";
import type { Context } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { env } from "../env.js";
import { generateToken } from "./tokens.js";

export const VOTER_COOKIE_NAME = "jm_voter";

export const hashWithSalt = (value: string, salt: string) =>
  createHash("sha256").update(`${salt}:${value}`).digest("hex");

// Keep a stable anonymous voter id in a cookie so rate limits and anti-replay checks
// can work consistently even for signed-out users.
export const getOrCreateVoterId = (c: Context) => {
  const existing = getCookie(c, VOTER_COOKIE_NAME);
  if (existing) {
    return existing;
  }

  const token = generateToken();
  setCookie(c, VOTER_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "Lax",
    secure: env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return token;
};
