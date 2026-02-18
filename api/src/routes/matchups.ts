import { Hono } from "hono";
import { createMatchupPayload } from "../services/matchups/createMatchupPayload.js";

const matchupsRouter = new Hono();

matchupsRouter.get("/next", async (c) => {
  const payload = await createMatchupPayload(c);
  if (!payload) {
    return c.json({ error: { message: "Not enough images" } }, 404);
  }

  return c.json(payload);
});

export { createMatchupPayload };
export default matchupsRouter;
