import { Hono } from "hono";
import { getOrCreateVoterHash } from "../auth/voter.js";
import { createMatchupPayload } from "../services/matchups/createMatchupPayload.js";
import { fetchRecentImages, fetchTopCards } from "../services/images/cards.js";

const feedRouter = new Hono();

feedRouter.get("/home", async (c) => {
  const rawLimit = Number(c.req.query("limit") ?? "8");
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 20) : 8;
  const recentLimit = Math.max(1, Math.floor(limit / 2));
  const topLimit = Math.max(1, limit - recentLimit);

  const [recent, top] = await Promise.all([
    fetchRecentImages(recentLimit),
    fetchTopCards(topLimit),
  ]);

  const seen = new Set<string>();
  const feed: Array<Record<string, unknown>> = [];

  const pushUnique = (item: Record<string, unknown>) => {
    const id = item.id as string | undefined;
    if (!id || seen.has(id)) return;
    seen.add(id);
    feed.push(item);
  };

  const max = Math.max(recent.length, top.length);
  for (let i = 0; i < max; i += 1) {
    if (recent[i]) pushUnique(recent[i] as Record<string, unknown>);
    if (top[i]) pushUnique(top[i] as Record<string, unknown>);
  }

  if (feed.length < limit) {
    for (const item of recent) {
      pushUnique(item as Record<string, unknown>);
      if (feed.length >= limit) break;
    }
  }

  if (feed.length < limit) {
    for (const item of top) {
      pushUnique(item as Record<string, unknown>);
      if (feed.length >= limit) break;
    }
  }

  const voterHash = getOrCreateVoterHash(c);
  const matchup = await createMatchupPayload({ voterHash });

  return c.json({ matchup, feed: feed.slice(0, limit) });
});

export default feedRouter;
