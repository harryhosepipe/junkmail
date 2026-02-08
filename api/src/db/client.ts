import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { env, getEnv } from "../env.js";

getEnv();

const connectionString = env.DATABASE_URL ?? "postgres://junkmail:junkmail@localhost:5433/junkmail";

export const pool = new Pool({ connectionString });
export const db = drizzle(pool);
