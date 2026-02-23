import { makeFunctionReference } from "convex/server";
import { createConvexClient } from "./core.js";
import type { ConvexFeatureRequest } from "./types.js";

const listFeatureRequestsRef = makeFunctionReference<
  "query",
  { limit?: number },
  ConvexFeatureRequest[]
>("featureRequests:listFeatureRequests");

const createFeatureRequestRef = makeFunctionReference<
  "mutation",
  {
    requestId: string;
    title: string;
    description: string;
    status?: string;
    createdByAuthUserId: string;
    createdByAlias: string;
    createdAt?: number;
    updatedAt?: number;
  },
  { ok: boolean }
>("featureRequests:createFeatureRequest");

export const queryConvexFeatureRequests = async (limit?: number) => {
  const { client } = createConvexClient();
  return client.query(listFeatureRequestsRef, { limit });
};

export const mutateConvexCreateFeatureRequest = async (args: {
  requestId: string;
  title: string;
  description: string;
  status?: string;
  createdByAuthUserId: string;
  createdByAlias: string;
  createdAt?: number;
  updatedAt?: number;
}) => {
  const { client } = createConvexClient();
  return client.mutation(createFeatureRequestRef, args);
};
