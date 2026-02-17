import { getEnv } from "../env.js";
import { queryConvexBackfillCounts } from "../convex/client.js";

const run = async () => {
  getEnv();
  const counts = await queryConvexBackfillCounts();
  console.log(
    JSON.stringify(
      {
        ok: true,
        message: "Postgres backfill retired. Convex is the source of truth.",
        convex: counts,
      },
      null,
      2,
    ),
  );
};

run().catch((error) => {
  const message = error instanceof Error ? error.message : "Convex status check failed";
  console.error(JSON.stringify({ ok: false, error: message }, null, 2));
  process.exitCode = 1;
});
