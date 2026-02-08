import { ConvexClient } from "convex/browser";

const configuredUrl = import.meta.env.PUBLIC_CONVEX_URL;
const proxiedUrl =
  typeof window !== "undefined" ? `${window.location.origin}/convex` : "http://localhost:3210";

const pageProtocol = typeof window !== "undefined" ? window.location.protocol : "";
const isSecurePage = pageProtocol === "https:";
const isMixedContentRisk = isSecurePage && Boolean(configuredUrl?.startsWith("http://"));
const deploymentUrl = !configuredUrl || isMixedContentRisk ? proxiedUrl : configuredUrl;

export const realtimeEnabled = Boolean(deploymentUrl);
export const realtimeDisabledReason = "";

export const convex = realtimeEnabled ? new ConvexClient(deploymentUrl) : null;
