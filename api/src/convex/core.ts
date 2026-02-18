import { ConvexHttpClient } from "convex/browser";
import { env } from "../env.js";

export const resolveConvexUrl = () =>
  env.CONVEX_URL || env.PUBLIC_CONVEX_URL || env.CONVEX_SELF_HOSTED_URL || "";

export const resolveConvexAdminKey = () =>
  env.CONVEX_ADMIN_KEY || env.CONVEX_SELF_HOSTED_ADMIN_KEY || "";

export const createConvexClient = () => {
  const url = resolveConvexUrl();
  if (!url) {
    throw new Error(
      "Convex URL is missing. Set CONVEX_URL (or PUBLIC_CONVEX_URL / CONVEX_SELF_HOSTED_URL).",
    );
  }

  const client = new ConvexHttpClient(url);
  const adminKey = resolveConvexAdminKey();
  if (adminKey) {
    // Convex runtime supports setAdminAuth, but this method is currently missing
    // from the published TypeScript type for ConvexHttpClient.
    (client as unknown as { setAdminAuth?: (token: string) => void }).setAdminAuth?.(adminKey);
  }

  return { client, url };
};
