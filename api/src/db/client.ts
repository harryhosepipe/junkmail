import "../env.js";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const connectionString =
  process.env.DATABASE_URL || "postgres://junkmail:junkmail@localhost:5433/junkmail";

export const pool = new Pool({ connectionString });
export const db = drizzle(pool);
