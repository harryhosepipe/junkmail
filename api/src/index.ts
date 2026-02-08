import { serve } from "@hono/node-server";
import { app } from "./app.js";
import { env, getEnv } from "./env.js";

// Fail fast if env is missing/invalid.
getEnv();

const port = env.PORT ?? 8787;

serve({ fetch: app.fetch, port });
