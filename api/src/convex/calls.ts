import type { ConvexHttpClient } from "convex/browser";
import { createConvexClient } from "./core.js";

const withConvexClient = async <T>(fn: (client: ConvexHttpClient) => Promise<T>): Promise<T> => {
  const { client } = createConvexClient();
  return fn(client);
};

export const runConvexQuery = withConvexClient;
export const runConvexMutation = withConvexClient;
