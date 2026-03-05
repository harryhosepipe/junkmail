import { Hono } from "hono";
import { getCookie } from "hono/cookie";
import { sendMagicLinkEmail } from "../../auth/email.js";
import {
  clearSessionCookie,
  createSession,
  deleteSession,
  getSessionUser,
  getSessionToken,
  setSessionCookie,
} from "../../auth/session.js";
import { ensureSameOrigin } from "../../auth/csrf.js";
import { generateToken, hashToken } from "../../auth/tokens.js";
import { deriveVoterHash, VOTER_COOKIE_NAME } from "../../auth/voter.js";
import { parseAliasPatch } from "../../contracts/profile.js";
import { resolveInvitedUploaderByEmail } from "../../auth/userProfile.js";
import { mutateConvexConsumeAuthToken, mutateConvexCreateAuthToken } from "../../convex/client.js";
import { env } from "../../env.js";
import { AppError } from "../../http/errors.js";
import { readPayload } from "../../http/readPayload.js";
import { jsonError } from "../../http/responses.js";
import { toHttpStatus } from "../../http/status.js";
import { buildProfileSummary, updateAliasAndProfile } from "./services/profile.js";

const authRouter = new Hono();
const MAGIC_LINK_TTL_MINUTES = env.MAGIC_LINK_TTL_MINUTES ?? 30;

const normalizeEmail = (value: string) => value.trim().toLowerCase();

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
    return jsonError(c, 400, "Valid email required");
  }

  const invited = await resolveInvitedUploaderByEmail(email);

  if (!invited) {
    return c.json({ ok: true });
  }

  const token = generateToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(Date.now() + MAGIC_LINK_TTL_MINUTES * 60 * 1000);

  await mutateConvexCreateAuthToken({
    tokenHash,
    userAuthUserId: invited.id,
    expiresAt: expiresAt.getTime(),
  });

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
  const consumed = await mutateConvexConsumeAuthToken({ tokenHash, now: Date.now() });

  if (!consumed) {
    const errorUrl = new URL("/login", webBaseUrl);
    errorUrl.searchParams.set("error", "invalid");
    return c.redirect(errorUrl.toString(), 302);
  }

  const session = await createSession(consumed.userAuthUserId);
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
    return jsonError(c, 401, "Unauthorized");
  }

  return c.json({ user });
});

authRouter.get("/profile", async (c) => {
  const user = await getSessionUser(c);
  if (!user) {
    return jsonError(c, 401, "Unauthorized");
  }

  const voterId = getCookie(c, VOTER_COOKIE_NAME);
  const voterHash = voterId ? deriveVoterHash(voterId) : undefined;
  const profile = await buildProfileSummary({ user, voterHash });

  return c.json({
    profile,
  });
});

authRouter.patch("/profile", async (c) => {
  const csrfError = ensureSameOrigin(c);
  if (csrfError) {
    return csrfError;
  }

  const user = await getSessionUser(c);
  if (!user) {
    return jsonError(c, 401, "Unauthorized");
  }

  const body = await readPayload(c);
  let alias = "";
  try {
    alias = parseAliasPatch(body);
  } catch (err) {
    if (err instanceof AppError) {
      return jsonError(c, toHttpStatus(err.status), err.message);
    }
    throw err;
  }

  const profile = await updateAliasAndProfile({ user, alias });

  return c.json({ ok: true, profile });
});

export default authRouter;
