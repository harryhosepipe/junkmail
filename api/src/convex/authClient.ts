import { makeFunctionReference } from "convex/server";
import { createConvexClient } from "./core.js";

const createAuthTokenRef = makeFunctionReference<
  "mutation",
  {
    tokenHash: string;
    userAuthUserId: string;
    expiresAt: number;
    createdAt?: number;
  },
  { ok: boolean }
>("auth:createAuthToken");
const consumeAuthTokenRef = makeFunctionReference<
  "mutation",
  { tokenHash: string; now?: number },
  { userAuthUserId: string } | null
>("auth:consumeAuthToken");
const createSessionRef = makeFunctionReference<
  "mutation",
  { tokenHash: string; userAuthUserId: string; expiresAt: number; createdAt?: number },
  { ok: boolean }
>("auth:createSession");
const deleteSessionByTokenHashRef = makeFunctionReference<
  "mutation",
  { tokenHash: string },
  { ok: boolean }
>("auth:deleteSessionByTokenHash");
const getSessionUserAuthUserIdRef = makeFunctionReference<
  "query",
  { tokenHash: string; now?: number },
  { userAuthUserId: string } | null
>("auth:getSessionUserAuthUserId");

export const mutateConvexCreateAuthToken = async (args: {
  tokenHash: string;
  userAuthUserId: string;
  expiresAt: number;
  createdAt?: number;
}) => {
  const { client } = createConvexClient();
  return client.mutation(createAuthTokenRef, args);
};

export const mutateConvexConsumeAuthToken = async (args: { tokenHash: string; now?: number }) => {
  const { client } = createConvexClient();
  return client.mutation(consumeAuthTokenRef, args);
};

export const mutateConvexCreateSession = async (args: {
  tokenHash: string;
  userAuthUserId: string;
  expiresAt: number;
  createdAt?: number;
}) => {
  const { client } = createConvexClient();
  return client.mutation(createSessionRef, args);
};

export const mutateConvexDeleteSessionByTokenHash = async (args: { tokenHash: string }) => {
  const { client } = createConvexClient();
  return client.mutation(deleteSessionByTokenHashRef, args);
};

export const queryConvexSessionUserAuthUserId = async (args: {
  tokenHash: string;
  now?: number;
}) => {
  const { client } = createConvexClient();
  return client.query(getSessionUserAuthUserIdRef, args);
};
