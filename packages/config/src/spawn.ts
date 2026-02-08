import { spawn, type SpawnOptionsWithoutStdio } from "node:child_process";
import type { Env } from "./env.js";

export type SpawnWithEnvOptions = SpawnOptionsWithoutStdio & {
  env: Env;
};

// Spawn a child process with the validated env merged into its environment.
// This is intended for root dev runners (web/api/worker) so they don't do implicit .env loading.
export function spawnWithValidatedEnv(
  command: string,
  args: string[],
  options: SpawnWithEnvOptions,
) {
  const childEnv: NodeJS.ProcessEnv = {
    ...process.env,
    ...Object.fromEntries(Object.entries(options.env).map(([k, v]) => [k, String(v)])),
  };

  return spawn(command, args, {
    ...options,
    env: childEnv,
    stdio: options.stdio ?? "inherit",
  });
}
