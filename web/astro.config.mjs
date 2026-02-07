import { defineConfig } from "astro/config";
import node from "@astrojs/node";
import svelte from "@astrojs/svelte";

export default defineConfig({
  output: "static",
  integrations: [svelte()],
  adapter: node({
    mode: "standalone",
  }),
  server: {
    allowedHosts: [".trycloudflare.com"],
  },
  vite: {
    server: {
      proxy: {
        "/api": {
          target: "http://localhost:8787",
          changeOrigin: true,
          headers: {
            origin: "http://localhost:4321",
          },
        },
        "/assets": {
          target: "http://localhost:9010",
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/assets/, ""),
        },
      },
    },
  },
});
