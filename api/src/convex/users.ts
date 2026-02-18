import { makeFunctionReference } from "convex/server";
import { createConvexClient } from "./core.js";
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

const userProfileByEmailRef = makeFunctionReference<
  "query",
  { emailLower: string },
  ConvexUserProfile | null
>("users:getByEmail");
const userProfileByAuthIdRef = makeFunctionReference<
  "query",
  { authUserId: string },
  ConvexUserProfile | null
>("users:getByAuthUserId");
const userProfileByTelegramIdRef = makeFunctionReference<
  "query",
  { telegramUserId: number },
  ConvexUserProfile | null
>("users:getByTelegramUserId");
const upsertUserProfileRef = makeFunctionReference<
  "mutation",
  UpsertUserProfileArgs,
  { ok: boolean }
>("users:upsertByAuthUserId");
const updateUserAliasRef = makeFunctionReference<
  "mutation",
  { authUserId: string; alias: string; updatedAt?: number },
  { ok: boolean }
>("users:updateAlias");
const upsertTelegramUserRef = makeFunctionReference<
  "mutation",
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
  const { client } = createConvexClient();
  return client.query(userProfileByEmailRef, { emailLower: email.toLowerCase() });
};

export const queryConvexUserProfileByAuthUserId = async (authUserId: string) => {
  const { client } = createConvexClient();
  return client.query(userProfileByAuthIdRef, { authUserId });
};

export const queryConvexUserProfileByTelegramUserId = async (telegramUserId: number) => {
  const { client } = createConvexClient();
  return client.query(userProfileByTelegramIdRef, { telegramUserId });
};

export const mutateConvexUpsertUserProfile = async (args: UpsertUserProfileArgs) => {
  const { client } = createConvexClient();
  return client.mutation(upsertUserProfileRef, args);
};

export const mutateConvexUpdateUserAlias = async (args: {
  authUserId: string;
  alias: string;
  updatedAt?: number;
}) => {
  const { client } = createConvexClient();
  return client.mutation(updateUserAliasRef, args);
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
  const { client } = createConvexClient();
  return client.mutation(upsertTelegramUserRef, args);
};
