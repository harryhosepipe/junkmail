import {
  mutateConvexUpsertUserProfile,
  queryConvexUserProfileByAuthUserId,
  queryConvexUserProfileByEmail,
  type ConvexUserProfile,
} from "../convex/client.js";

export type AuthUserProfile = {
  id: string;
  email: string;
  alias: string;
  role: string;
  createdAt: string;
};

const fallbackAliasFromEmail = (email: string, id: string) => {
  const base = email.split("@")[0]?.trim();
  if (base) {
    return base;
  }
  return `user-${id.slice(0, 8)}`;
};

const mapConvexProfile = (profile: ConvexUserProfile): AuthUserProfile => ({
  id: profile.authUserId,
  email: profile.email,
  alias: profile.alias || fallbackAliasFromEmail(profile.email, profile.authUserId),
  role: profile.role,
  createdAt: new Date(profile.createdAt).toISOString(),
});

export const resolveAuthUserProfileById = async (authUserId: string) => {
  const convex = await queryConvexUserProfileByAuthUserId(authUserId);
  if (!convex) {
    return null;
  }
  return mapConvexProfile(convex);
};

export const resolveInvitedUploaderByEmail = async (email: string) => {
  const emailLower = email.toLowerCase();
  const convex = await queryConvexUserProfileByEmail(emailLower);
  if (convex?.role !== "uploader") {
    return null;
  }
  return mapConvexProfile(convex);
};

export const ensureAuthUserProfile = async (args: {
  authUserId: string;
  email: string;
  alias: string;
  role: string;
}) => {
  await mutateConvexUpsertUserProfile(args);
};
