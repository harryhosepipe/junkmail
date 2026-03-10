import { createHash } from "crypto";
import type { Context } from "hono";
import { getCookie, setCookie } from "hono/cookie";
import { env } from "../../env.js";
import { votingConfig } from "../../features/voting/application/votingConfig.js";
import { generateToken } from "./tokens.js";

export const VOTER_COOKIE_NAME = "jm_voter";
const VOTE_HASH_SALT = votingConfig.voteHashSalt;

export const hashWithSalt = (value: string, salt: string) =>
  createHash("sha256").update(`${salt}:${value}`).digest("hex");

export const deriveVoterHash = (voterId: string) => hashWithSalt(voterId, VOTE_HASH_SALT);

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

export const getOrCreateVoterHash = (c: Context) => deriveVoterHash(getOrCreateVoterId(c));
