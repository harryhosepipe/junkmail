#!/usr/bin/env node
import { spawn } from "node:child_process";
import process from "node:process";

const TUNNEL_TARGET = process.env.TUNNEL_TARGET ?? "http://web.localhost";

const urlRegex = /https:\/\/[a-z0-9-]+\.trycloudflare\.com/gi;

function spawnInherit(cmd, args, opts = {}) {
  return spawn(cmd, args, { stdio: "inherit", ...opts });
}

function spawnPipe(cmd, args, opts = {}) {
  return spawn(cmd, args, { stdio: ["ignore", "pipe", "pipe"], ...opts });
}

function onceTrycloudflareUrl(proc, timeoutMs = 30_000) {
  return new Promise((resolve, reject) => {
    let stdoutBuf = "";
    let stderrBuf = "";
    let done = false;

    const finish = (err, url) => {
      if (done) return;
      done = true;
      clearTimeout(t);
      proc.stdout?.removeListener("data", onStdout);
      proc.stderr?.removeListener("data", onStderr);
      if (err) reject(err);
      else resolve(url);
    };

    const scan = (chunk) => {
      const match = String(chunk).match(urlRegex);
      if (match && match[0]) return match[0];
      return null;
    };

    const onStdout = (d) => {
      stdoutBuf += String(d);
      const url = scan(d) ?? scan(stdoutBuf);
      if (url) finish(null, url);
    };
    const onStderr = (d) => {
      stderrBuf += String(d);
      const url = scan(d) ?? scan(stderrBuf);
      if (url) finish(null, url);
    };

    proc.stdout?.on("data", onStdout);
    proc.stderr?.on("data", onStderr);

    proc.once("exit", (code) => {
      finish(new Error(`cloudflared exited before producing a URL (code ${code ?? "unknown"})`));
    });

    const t = setTimeout(() => {
      finish(new Error("Timed out waiting for trycloudflare URL from cloudflared"));
    }, timeoutMs);
  });
}

const cloudflared = spawnPipe("cloudflared", ["tunnel", "--url", TUNNEL_TARGET, "--no-autoupdate"]);

// Mirror tunnel logs while we parse the URL once.
cloudflared.stdout?.pipe(process.stdout);
cloudflared.stderr?.pipe(process.stderr);

let compose = null;
let apps = null;
let shuttingDown = false;

function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  if (apps && apps.exitCode == null) {
    apps.kill("SIGINT");
  }
  if (compose && compose.exitCode == null) {
    compose.kill("SIGINT");
  }
  if (cloudflared.exitCode == null) {
    cloudflared.kill("SIGINT");
  }

  setTimeout(() => process.exit(exitCode), 250);
}

process.on("SIGINT", () => shutdown(130));
process.on("SIGTERM", () => shutdown(143));

try {
  const publicUrl = await onceTrycloudflareUrl(cloudflared);
  // One public origin. Caddy routes /api/* and /assets/* under the same host.
  const env = {
    ...process.env,
    APP_ORIGIN: publicUrl,
    WEB_ORIGIN: publicUrl,
    API_ORIGIN: publicUrl,
    // Keep legacy names aligned for any remaining code paths/docs.
    WEB_BASE_URL: publicUrl,
    API_BASE_URL: publicUrl,
    CORS_ORIGIN: publicUrl,
  };

  console.log("");
  console.log(`[staging] trycloudflare URL: ${publicUrl}`);
  console.log(`[staging] starting infra (Caddy entrypoint on :80)`);

  compose = spawnInherit(
    "docker",
    [
      "compose",
      "--profile",
      "host",
      "up",
      "-d",
      "caddy",
      "postgres",
      "redis",
      "minio",
      "minio-init",
      "convex-backend",
      "convex-dashboard",
    ],
    { env },
  );

  compose.once("exit", (code) => {
    if (code !== 0) {
      shutdown(code ?? 1);
    } else {
      console.log(`[staging] starting apps (web + api + worker) on host`);
      apps = spawnInherit("bun", ["run", "dev:apps"], { env });
      apps.once("exit", (appsCode) => shutdown(appsCode ?? 0));
    }
  });
} catch (err) {
  console.error(`[staging] ${err instanceof Error ? err.message : String(err)}`);
  shutdown(1);
}
