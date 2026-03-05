import {
  queryConvexDedupeStats,
  queryConvexRecentDedupeEvents,
} from "../platform/convex/client.js";
import { getEnv } from "../env.js";

const parseArg = (name: string, fallback?: number) => {
  const index = process.argv.findIndex((arg) => arg === name);
  if (index === -1) return fallback;
  const value = Number(process.argv[index + 1]);
  return Number.isFinite(value) ? value : fallback;
};

const run = async () => {
  getEnv();
  const windowHours = parseArg("--window-hours", 24) ?? 24;
  const sampleLimit = parseArg("--sample-limit", 2000) ?? 2000;
  const eventsLimit = parseArg("--events", 20) ?? 20;

  const [stats, events] = await Promise.all([
    queryConvexDedupeStats({ windowHours, sampleLimit }),
    queryConvexRecentDedupeEvents(eventsLimit),
  ]);

  console.log(
    JSON.stringify(
      {
        stats,
        recentEvents: events,
      },
      null,
      2,
    ),
  );
};

run().catch((error) => {
  const message = error instanceof Error ? error.message : "dedupe stats failed";
  console.error(JSON.stringify({ ok: false, error: message }, null, 2));
  process.exit(1);
});
