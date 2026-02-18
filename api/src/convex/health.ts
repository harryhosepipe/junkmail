import { makeFunctionReference } from "convex/server";
import { createConvexClient } from "./core.js";

type ConvexHealth = {
  ok: boolean;
  timestamp: number;
  environment: string;
};

const healthPingRef = makeFunctionReference<"query", Record<string, never>, ConvexHealth>(
  "health:ping",
);

export const queryConvexHealth = async () => {
  const { client, url } = createConvexClient();
  const result = await client.query(healthPingRef, {});
  return { url, result };
};
