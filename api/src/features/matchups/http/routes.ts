import { Hono } from "hono";
import { getOrCreateVoterHash } from "../../../platform/auth/voter.js";
import { jsonError } from "../../../platform/http/responses.js";
import { createMatchupPayload } from "../application/createMatchupPayload.js";

const matchupsRouter = new Hono();

matchupsRouter.get("/next", async (c) => {
  const voterHash = getOrCreateVoterHash(c);
  const payload = await createMatchupPayload({ voterHash });
  if (!payload) {
    return jsonError(c, 404, "Not enough images");
  }

  return c.json(payload);
});

export default matchupsRouter;
