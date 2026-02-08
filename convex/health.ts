import { query } from "./_generated/server";
import { env } from "./env";

export const ping = query({
  args: {},
  handler: async () => {
    return {
      ok: true,
      timestamp: Date.now(),
      environment: env.NODE_ENV,
    };
  },
});
