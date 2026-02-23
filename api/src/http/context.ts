import type { Context } from "hono";
import type { AuthUserProfile } from "../auth/userProfile.js";

export const setRequestId = (c: Context, requestId: string) => {
  c.set("requestId", requestId);
};

export const getRequestId = (c: Context): string | undefined => {
  const value = c.get("requestId");
  return typeof value === "string" ? value : undefined;
};

export const getAuthUser = (c: Context): AuthUserProfile | undefined => {
  const value = c.get("authUser");
  if (!value || typeof value !== "object") return undefined;
  const user = value as Partial<AuthUserProfile>;
  if (
    typeof user.id !== "string" ||
    typeof user.email !== "string" ||
    typeof user.alias !== "string" ||
    typeof user.role !== "string" ||
    typeof user.createdAt !== "string"
  ) {
    return undefined;
  }
  return user as AuthUserProfile;
};
