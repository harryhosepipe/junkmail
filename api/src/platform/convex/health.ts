import { createConvexClient } from "./core.js";
import { queryRef } from "./refs.js";

type ConvexHealth = {
  ok: boolean;
  timestamp: number;
  environment: string;
};

const healthPingRef = queryRef<Record<string, never>, ConvexHealth>("health:ping");

export const queryConvexHealth = async () => {
  const { client, url } = createConvexClient();
  const result = await client.query(healthPingRef, {});
  return { url, result };
};
