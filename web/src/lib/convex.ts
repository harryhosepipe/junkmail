import { ConvexClient } from "convex/browser";

const deploymentUrl = import.meta.env.PUBLIC_CONVEX_URL;

if (!deploymentUrl) {
  throw new Error("PUBLIC_CONVEX_URL is required to initialize Convex in the web app.");
}

export const convex = new ConvexClient(deploymentUrl);
