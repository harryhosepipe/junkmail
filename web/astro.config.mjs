import { defineConfig, envField } from "astro/config";
import node from "@astrojs/node";
import svelte from "@astrojs/svelte";

export default defineConfig({
  output: "static",
  integrations: [svelte()],
  adapter: node({
    mode: "standalone",
  }),
  env: {
    schema: {
      // Used by server-side fetches in `.astro` pages during dev/prerender.
      // In Docker Compose, this is overridden to the internal service URL (api-dev:8787).
      API_BASE_URL: envField.string({ context: "server", access: "public", default: "http://api.localhost" }),
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
          target: "http://api-dev:8787",
          changeOrigin: true,
          headers: {
            origin: "http://localhost:4321",
          },
        },
        "/assets": {
          target: "http://minio:9000",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/assets/, ""),
        },
        "/convex": {
          target: "http://convex-backend:3210",
          changeOrigin: true,
          ws: true,
          rewrite: (path) => path.replace(/^\/convex/, ""),
        },
      },
    },
  },
});
