import { Hono } from "hono";
import { getOrCreateVoterHash } from "../auth/voter.js";
import { createMatchupPayload } from "../services/matchups/createMatchupPayload.js";

const matchupsRouter = new Hono();

matchupsRouter.get("/next", async (c) => {
  const voterHash = getOrCreateVoterHash(c);
  const payload = await createMatchupPayload({ voterHash });
  if (!payload) {
    return c.json({ error: { message: "Not enough images" } }, 404);
  }

  return c.json(payload);
});

export default matchupsRouter;
