import { Hono } from "hono";
import { executeGetNextMatchup } from "../application/voting/GetNextMatchup.js";

const matchupsRouter = new Hono();

matchupsRouter.get("/next", async (c) => {
  const payload = await executeGetNextMatchup(c);
  if (!payload) {
    return c.json({ error: { message: "Not enough images" } }, 404);
  }

  return c.json(payload);
});

export { executeGetNextMatchup as createMatchupPayload };
export default matchupsRouter;
