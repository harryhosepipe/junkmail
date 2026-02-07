import { and, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { users } from "../db/schema.js";
import {
  mutateConvexUpsertUserProfile,
  queryConvexUserProfileByAuthUserId,
  queryConvexUserProfileByEmail,
  type ConvexUserProfile,
} from "../convex/client.js";

export type AuthUserProfile = {
  id: string;
  email: string;
  role: string;
};

const mapConvexProfile = (profile: ConvexUserProfile): AuthUserProfile => ({
  id: profile.authUserId,
  email: profile.email,
  role: profile.role,
});

const upsertConvexFromPostgres = async (user: {
  id: string;
  email: string;
  role: string;
  createdAt?: Date;
}) => {
  try {
    await mutateConvexUpsertUserProfile({
      authUserId: user.id,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt?.getTime(),
    });
  } catch {
    // Keep auth paths resilient if Convex is unavailable.
  }
};

export const resolveAuthUserProfileById = async (authUserId: string) => {
  try {
    const convex = await queryConvexUserProfileByAuthUserId(authUserId);
    if (convex) {
      return mapConvexProfile(convex);
    }
  } catch {
    // Fall back to Postgres below.
  }

  const result = await db
    .select({
      id: users.id,
      email: users.email,
      role: users.role,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, authUserId))
    .limit(1);

  const user = result[0];
  if (!user) {
    return null;
  }

  await upsertConvexFromPostgres(user);
  return {
    id: user.id,
    email: user.email,
    role: user.role,
  } satisfies AuthUserProfile;
};

export const resolveInvitedUploaderByEmail = async (email: string) => {
  const emailLower = email.toLowerCase();
  try {
    const convex = await queryConvexUserProfileByEmail(emailLower);
    if (convex?.role === "uploader") {
      return mapConvexProfile(convex);
    }
    if (convex) {
      return null;
    }
  } catch {
    // Fall back to Postgres lookup below.
  }

  const result = await db
    .select({
      id: users.id,
      email: users.email,
      role: users.role,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(and(eq(users.email, emailLower), eq(users.role, "uploader")))
    .limit(1);

  const user = result[0];
  if (!user) {
    return null;
  }

  await upsertConvexFromPostgres(user);
  return {
    id: user.id,
    email: user.email,
    role: user.role,
  } satisfies AuthUserProfile;
};
