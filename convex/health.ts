import { query } from "./_generated/server";

export const ping = query({
  args: {},
  handler: async () => {
    return {
      ok: true,
      timestamp: Date.now(),
      environment: process.env.NODE_ENV ?? "development",
    };
  },
});
