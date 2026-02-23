import { Hono } from "hono";
import { getOrCreateVoterHash } from "../auth/voter.js";
import { jsonError } from "../http/responses.js";
import { createMatchupPayload } from "../services/matchups/createMatchupPayload.js";

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
