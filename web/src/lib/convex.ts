import { ConvexClient } from "convex/browser";

// Always use the same-origin proxy to avoid mixed-content issues when sharing the app over a tunnel (HTTPS page).
// `/convex` is forwarded by the dev server (vite proxy) to the Convex backend.
const proxiedUrl = typeof window !== "undefined" ? `${window.location.origin}/convex` : "";

export const realtimeEnabled = Boolean(proxiedUrl);
export const realtimeDisabledReason = "";

export const convex = realtimeEnabled ? new ConvexClient(proxiedUrl) : null;
