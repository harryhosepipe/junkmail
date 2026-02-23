import { runConvexMutation, runConvexQuery } from "./calls.js";
import { mutationRef, queryRef } from "./refs.js";
import type { ConvexUserProfile } from "./types.js";

type UpsertUserProfileArgs = {
  authUserId: string;
  email: string;
  alias: string;
  role: string;
  inviteToken?: string;
  telegramUserId?: number;
  telegramUsername?: string;
  createdAt?: number;
  updatedAt?: number;
};

const userProfileByEmailRef = queryRef<{ emailLower: string }, ConvexUserProfile | null>(
  "users:getByEmail",
);
const userProfileByAuthIdRef = queryRef<{ authUserId: string }, ConvexUserProfile | null>(
  "users:getByAuthUserId",
);
const userProfileByTelegramIdRef = queryRef<{ telegramUserId: number }, ConvexUserProfile | null>(
  "users:getByTelegramUserId",
);
const upsertUserProfileRef = mutationRef<UpsertUserProfileArgs, { ok: boolean }>(
  "users:upsertByAuthUserId",
);
const updateUserAliasRef = mutationRef<
  { authUserId: string; alias: string; updatedAt?: number },
  { ok: boolean }
>("users:updateAlias");
const upsertTelegramUserRef = mutationRef<
  {
    telegramUserId: number;
    email: string;
    alias: string;
    role: string;
    telegramUsername?: string;
    inviteToken?: string;
    createdAt?: number;
    updatedAt?: number;
  },
  { authUserId: string }
>("users:upsertTelegramUser");

export const queryConvexUserProfileByEmail = async (email: string) => {
  return runConvexQuery((client) =>
    client.query(userProfileByEmailRef, { emailLower: email.toLowerCase() }),
  );
};

export const queryConvexUserProfileByAuthUserId = async (authUserId: string) => {
  return runConvexQuery((client) => client.query(userProfileByAuthIdRef, { authUserId }));
};

export const queryConvexUserProfileByTelegramUserId = async (telegramUserId: number) => {
  return runConvexQuery((client) => client.query(userProfileByTelegramIdRef, { telegramUserId }));
};

export const mutateConvexUpsertUserProfile = async (args: UpsertUserProfileArgs) => {
  return runConvexMutation((client) => client.mutation(upsertUserProfileRef, args));
};

export const mutateConvexUpdateUserAlias = async (args: {
  authUserId: string;
  alias: string;
  updatedAt?: number;
}) => {
  return runConvexMutation((client) => client.mutation(updateUserAliasRef, args));
};

export const mutateConvexUpsertTelegramUser = async (args: {
  telegramUserId: number;
  email: string;
  alias: string;
  role: string;
  telegramUsername?: string;
  inviteToken?: string;
  createdAt?: number;
  updatedAt?: number;
}) => {
  return runConvexMutation((client) => client.mutation(upsertTelegramUserRef, args));
};
