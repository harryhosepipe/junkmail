import { Hono } from "hono";
import type { Context } from "hono";
import { createHash } from "crypto";
import { and, count, eq, gt, isNull } from "drizzle-orm";
import { db } from "../db/client.js";
import { authTokens, images, users } from "../db/schema.js";
import { getCookie } from "hono/cookie";
import { sendMagicLinkEmail } from "../auth/email.js";
import {
  clearSessionCookie,
  createSession,
  deleteSession,
  getSessionUser,
  getSessionToken,
  setSessionCookie,
} from "../auth/session.js";
import { ensureSameOrigin } from "../auth/csrf.js";
import { generateToken, hashToken } from "../auth/tokens.js";
import { resolveInvitedUploaderByEmail } from "../auth/userProfile.js";
import { queryConvexVoteCountForProfile, mutateConvexUpsertUserProfile } from "../convex/client.js";
import { env } from "../env.js";

const authRouter = new Hono();
const MAGIC_LINK_TTL_MINUTES = env.MAGIC_LINK_TTL_MINUTES ?? 30;
const VOTER_COOKIE_NAME = "jm_voter";
const VOTE_HASH_SALT = env.VOTE_HASH_SALT ?? "junkmail-dev-vote";
const ALIAS_MIN_LENGTH = 2;
const ALIAS_MAX_LENGTH = 32;

const readPayload = async (c: Context) => {
  const contentType = c.req.header("content-type") || "";
  if (contentType.includes("application/json")) {
    try {
      return await c.req.json();
    } catch {
      return {};
    }
  }

  try {
    return await c.req.parseBody();
  } catch {
    return {};
  }
};

const normalizeEmail = (value: string) => value.trim().toLowerCase();
const hashValue = (value: string, salt: string) =>
  createHash("sha256").update(`${salt}:${value}`).digest("hex");

const normalizeAlias = (value: string) => value.trim();

const safeNextPath = (value?: string | null) => {
  if (!value) {
    return "/upload";
  }

  if (value.startsWith("/") && !value.startsWith("//")) {
    return value;
  }

  return "/upload";
};

authRouter.post("/request-link", async (c) => {
  const body = await readPayload(c);
  const email = typeof body.email === "string" ? normalizeEmail(body.email) : "";

  if (!email || !email.includes("@")) {
    return c.json({ error: { message: "Valid email required" } }, 400);
  }

  const invited = await resolveInvitedUploaderByEmail(email);

  if (!invited) {
    return c.json({ ok: true });
  }

  const token = generateToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + MAGIC_LINK_TTL_MINUTES * 60 * 1000);

  await db.insert(authTokens).values({ userId: invited.id, tokenHash, expiresAt });

  const apiOrigin = env.API_ORIGIN ?? env.API_BASE_URL ?? new URL(c.req.url).origin;
  const link = new URL("/api/v1/auth/verify", apiOrigin);
  link.searchParams.set("token", token);

  if (typeof body.next === "string") {
    link.searchParams.set("next", body.next);
  }

  await sendMagicLinkEmail({ to: email, link: link.toString() });

  return c.json({ ok: true });
});

authRouter.get("/verify", async (c) => {
  const token = c.req.query("token");
  const next = c.req.query("next");
  const webBaseUrl =
    env.WEB_ORIGIN ??
    env.WEB_BASE_URL ??
    env.APP_ORIGIN ??
    env.CORS_ORIGIN ??
    new URL(c.req.url).origin;

  if (!token) {
    const errorUrl = new URL("/login", webBaseUrl);
    errorUrl.searchParams.set("error", "invalid");
    return c.redirect(errorUrl.toString(), 302);
  }

  const tokenHash = hashToken(token);
  const now = new Date();
  const result = await db
    .select({ id: authTokens.id, userId: authTokens.userId })
    .from(authTokens)
    .where(
      and(
        eq(authTokens.tokenHash, tokenHash),
        isNull(authTokens.usedAt),
        gt(authTokens.expiresAt, now),
      ),
    )
    .limit(1);

  if (!result[0]) {
    const errorUrl = new URL("/login", webBaseUrl);
    errorUrl.searchParams.set("error", "invalid");
    return c.redirect(errorUrl.toString(), 302);
  }

  await db.update(authTokens).set({ usedAt: now }).where(eq(authTokens.id, result[0].id));

  const session = await createSession(result[0].userId);
  setSessionCookie(c, session.token, session.expiresAt);

  const redirectUrl = new URL(safeNextPath(next), webBaseUrl);
  return c.redirect(redirectUrl.toString(), 302);
});

authRouter.post("/logout", async (c) => {
  const csrfError = ensureSameOrigin(c);
  if (csrfError) {
    return csrfError;
  }

  const token = getSessionToken(c);
  if (token) {
    await deleteSession(token);
  }

  clearSessionCookie(c);
  return c.json({ ok: true });
});

authRouter.get("/me", async (c) => {
  const user = await getSessionUser(c);
  if (!user) {
    return c.json({ error: { message: "Unauthorized" } }, 401);
  }

  return c.json({ user });
});

authRouter.get("/profile", async (c) => {
  const user = await getSessionUser(c);
  if (!user) {
    return c.json({ error: { message: "Unauthorized" } }, 401);
  }

  const voterId = getCookie(c, VOTER_COOKIE_NAME);
  const voterHash = voterId ? hashValue(voterId, VOTE_HASH_SALT) : undefined;

  const [uploadStats, voteStats] = await Promise.all([
    db.select({ count: count() }).from(images).where(eq(images.uploaderId, user.id)).limit(1),
    queryConvexVoteCountForProfile({ authUserId: user.id, voterHash }).catch(() => ({ count: 0 })),
  ]);

  const uploadedImages = Number(uploadStats[0]?.count ?? 0);
  const votesCast = Number(voteStats?.count ?? 0);

  return c.json({
    profile: {
      id: user.id,
      email: user.email,
      alias: user.alias,
      role: user.role,
      createdAt: user.createdAt,
      uploadedImages,
      votesCast,
    },
  });
});

authRouter.patch("/profile", async (c) => {
  const csrfError = ensureSameOrigin(c);
  if (csrfError) {
    return csrfError;
  }

  const user = await getSessionUser(c);
  if (!user) {
    return c.json({ error: { message: "Unauthorized" } }, 401);
  }

  const body = await readPayload(c);
  const alias = typeof body.alias === "string" ? normalizeAlias(body.alias) : "";

  if (alias.length < ALIAS_MIN_LENGTH || alias.length > ALIAS_MAX_LENGTH) {
    return c.json(
      {
        error: {
          message: `Alias must be ${ALIAS_MIN_LENGTH}-${ALIAS_MAX_LENGTH} characters.`,
        },
      },
      400,
    );
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(alias)) {
    return c.json(
      {
        error: {
          message: "Alias can only contain letters, numbers, underscores, and hyphens.",
        },
      },
      400,
    );
  }

  await db.update(users).set({ alias }).where(eq(users.id, user.id));

  try {
    await mutateConvexUpsertUserProfile({
      authUserId: user.id,
      email: user.email,
      alias,
      role: user.role,
    });
  } catch {
    // Keep profile updates working if Convex sync is unavailable.
  }

  return c.json({ ok: true, profile: { ...user, alias } });
});

export default authRouter;
