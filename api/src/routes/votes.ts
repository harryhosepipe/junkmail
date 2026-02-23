import { Hono } from "hono";
import { ensureSameOrigin } from "../auth/csrf.js";
import { getOrCreateVoterHash } from "../auth/voter.js";
import { getSessionUser } from "../auth/session.js";
import { parseVotePayload, type VotePayload } from "../contracts/votes.js";
import { AppError } from "../http/errors.js";
import { submitVote } from "../services/votes/submitVote.js";
import { mapVoteSubmitDomainToHttp } from "../presentation/http/votes/mappers.js";
import { getClientIpHash } from "../services/votes/requestIdentity.js";
import { allowedByVoteRateLimit } from "../services/votes/rateLimit.js";
import { jsonError } from "../http/responses.js";
import { toHttpStatus } from "../http/status.js";

const votesRouter = new Hono();

votesRouter.post("/", async (c) => {
  const csrfError = ensureSameOrigin(c);
  if (csrfError) {
    return csrfError;
  }

  const body = await c.req.json().catch(() => ({}));
  let payload: VotePayload;
  try {
    payload = parseVotePayload(body);
  } catch (err) {
    if (err instanceof AppError) {
      return jsonError(c, toHttpStatus(err.status), err.message);
    }
    throw err;
  }

  const voterHash = getOrCreateVoterHash(c);
  const ipHash = getClientIpHash(c);
  const sessionUser = await getSessionUser(c);

  const allowedIp = await allowedByVoteRateLimit(ipHash, "ip");
  const allowedVoter = await allowedByVoteRateLimit(voterHash, "voter");
  if (!allowedIp.allowed || !allowedVoter.allowed) {
    const retryAfterSeconds = Math.max(
      allowedIp.retryAfterSeconds,
      allowedVoter.retryAfterSeconds,
      1,
    );
    c.header("Retry-After", String(retryAfterSeconds));
    return c.json(
      {
        error: {
          message: `Too many votes. Slow down and try again in ${retryAfterSeconds}s.`,
          code: "rate_limited",
          retryAfterSeconds,
        },
      },
      429,
    );
  }

  const result = await submitVote({
    payload,
    voterHash,
    ipHash,
    sessionUserId: sessionUser?.id,
  });

  const response = mapVoteSubmitDomainToHttp(result);
  return c.json(response.body, response.status);
});

export default votesRouter;
