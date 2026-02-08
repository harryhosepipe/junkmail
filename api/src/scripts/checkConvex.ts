import { queryConvexHealth } from "../convex/client.js";
import { getEnv } from "../env.js";

const run = async () => {
  getEnv();
  const { url, result } = await queryConvexHealth();
  console.log(
    JSON.stringify(
      {
        ok: true,
        url,
        ping: result,
      },
      null,
      2,
    ),
  );
};

run().catch((error) => {
  const message = error instanceof Error ? error.message : "Convex check failed";
  console.error(JSON.stringify({ ok: false, error: message }, null, 2));
  process.exit(1);
});
