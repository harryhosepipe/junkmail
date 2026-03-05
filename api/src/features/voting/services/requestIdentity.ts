import type { Context } from "hono";
import { env } from "../../../env.js";
import { hashWithSalt } from "../../../auth/voter.js";

const IP_HASH_SALT = env.IP_HASH_SALT ?? env.VOTE_HASH_SALT ?? "junkmail-dev-vote";

const getClientIp = (c: Context) => {
  const forwarded = c.req.header("x-forwarded-for") || c.req.header("x-real-ip");
  if (forwarded) {
    return forwarded.split(",")[0]?.trim() || "unknown";
  }

  const raw = c.req.raw as { socket?: { remoteAddress?: string } };
  return raw.socket?.remoteAddress || "unknown";
};

export const getClientIpHash = (c: Context) => hashWithSalt(getClientIp(c), IP_HASH_SALT);
