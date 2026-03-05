import {
  mutateConvexUpdateUserAlias,
  mutateConvexUpsertUserProfile,
  queryConvexUploaderImageCount,
  queryConvexVoteCountForProfile,
} from "../../../platform/convex/client.js";

export type SessionUserLike = {
  id: string;
  email: string;
  alias: string;
  role: string;
  createdAt: string;
};

export const buildProfileSummary = async (args: { user: SessionUserLike; voterHash?: string }) => {
  const { user, voterHash } = args;
  const [uploadStats, voteStats] = await Promise.all([
    queryConvexUploaderImageCount(user.id).catch(() => ({ count: 0 })),
    queryConvexVoteCountForProfile({ authUserId: user.id, voterHash }).catch(() => ({ count: 0 })),
  ]);

  const uploadedImages = Number(uploadStats?.count ?? 0);
  const votesCast = Number(voteStats?.count ?? 0);

  return {
    id: user.id,
    email: user.email,
    alias: user.alias,
    role: user.role,
    createdAt: user.createdAt,
    uploadedImages,
    votesCast,
  };
};

export const updateAliasAndProfile = async (args: { user: SessionUserLike; alias: string }) => {
  const { user, alias } = args;

  // Keep both records in sync. updateAlias mutates the primary field and upsert
  // preserves compatibility with existing profile reads during migration.
  await mutateConvexUpdateUserAlias({
    authUserId: user.id,
    alias,
  });
  await mutateConvexUpsertUserProfile({
    authUserId: user.id,
    email: user.email,
    alias,
    role: user.role,
  });

  return { ...user, alias };
};
