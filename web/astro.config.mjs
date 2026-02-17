import { defineConfig, envField } from "astro/config";
import node from "@astrojs/node";
import svelte from "@astrojs/svelte";

const apiProxyTarget =
  process.env.API_PROXY_TARGET ?? process.env.API_BASE_URL ?? "http://localhost:8787";
const apiProxyOrigin =
  process.env.API_PROXY_ORIGIN ??
  process.env.WEB_ORIGIN ??
  process.env.APP_ORIGIN ??
  "http://web.localhost";
const assetsProxyTarget = process.env.ASSETS_PROXY_TARGET ?? "http://localhost:9010";
const convexProxyTarget = process.env.CONVEX_PROXY_TARGET ?? "http://localhost:3210";

export default defineConfig({
  output: "static",
  integrations: [svelte()],
  adapter: node({
    mode: "standalone",
  }),
  env: {
    schema: {
      // Used by server-side fetches in `.astro` pages during dev/prerender.
      API_BASE_URL: envField.string({
        context: "server",
        access: "public",
        default: "http://localhost:8787",
      }),
    },
  },
  server: {
    // Caddy front door uses *.localhost for stable dev hostnames.
    allowedHosts: [".trycloudflare.com", ".localhost"],
  },
  vite: {
    server: {
      proxy: {
        "/api": {
          target: apiProxyTarget,
          changeOrigin: true,
          headers: {
            origin: apiProxyOrigin,
          },
        },
        "/assets": {
          target: assetsProxyTarget,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/assets/, ""),
        },
        "/convex": {
          target: convexProxyTarget,
          changeOrigin: true,
          ws: true,
          rewrite: (path) => path.replace(/^\/convex/, ""),
        },
      },
    },
  },
});
