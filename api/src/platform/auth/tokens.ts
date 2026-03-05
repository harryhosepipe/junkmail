import { createHash, randomBytes } from "crypto";

const TOKEN_BYTES = 32;

export const generateToken = () => randomBytes(TOKEN_BYTES).toString("base64url");

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
