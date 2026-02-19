import type { Context } from "hono";
import { createMatchupPayload } from "../../services/matchups/createMatchupPayload.js";

export const executeGetNextMatchup = (context: Context) => createMatchupPayload(context);
