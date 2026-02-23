import { runConvexMutation, runConvexQuery } from "./calls.js";
import { mutationRef, queryRef } from "./refs.js";

const createAuthTokenRef = mutationRef<
  {
    tokenHash: string;
    userAuthUserId: string;
    expiresAt: number;
    createdAt?: number;
  },
  { ok: boolean }
>("auth:createAuthToken");
const consumeAuthTokenRef = mutationRef<
  { tokenHash: string; now?: number },
  { userAuthUserId: string } | null
>("auth:consumeAuthToken");
const createSessionRef = mutationRef<
  { tokenHash: string; userAuthUserId: string; expiresAt: number; createdAt?: number },
  { ok: boolean }
>("auth:createSession");
const deleteSessionByTokenHashRef = mutationRef<{ tokenHash: string }, { ok: boolean }>(
  "auth:deleteSessionByTokenHash",
);
const getSessionUserAuthUserIdRef = queryRef<
  { tokenHash: string; now?: number },
  { userAuthUserId: string } | null
>("auth:getSessionUserAuthUserId");

export const mutateConvexCreateAuthToken = async (args: {
  tokenHash: string;
  userAuthUserId: string;
  expiresAt: number;
  createdAt?: number;
}) => {
  return runConvexMutation((client) => client.mutation(createAuthTokenRef, args));
};

export const mutateConvexConsumeAuthToken = async (args: { tokenHash: string; now?: number }) => {
  return runConvexMutation((client) => client.mutation(consumeAuthTokenRef, args));
};

export const mutateConvexCreateSession = async (args: {
  tokenHash: string;
  userAuthUserId: string;
  expiresAt: number;
  createdAt?: number;
}) => {
  return runConvexMutation((client) => client.mutation(createSessionRef, args));
};

export const mutateConvexDeleteSessionByTokenHash = async (args: { tokenHash: string }) => {
  return runConvexMutation((client) => client.mutation(deleteSessionByTokenHashRef, args));
};

export const queryConvexSessionUserAuthUserId = async (args: {
  tokenHash: string;
  now?: number;
}) => {
  return runConvexQuery((client) => client.query(getSessionUserAuthUserIdRef, args));
};
