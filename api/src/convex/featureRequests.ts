import { runConvexMutation, runConvexQuery } from "./calls.js";
import { mutationRef, queryRef } from "./refs.js";
import type { ConvexFeatureRequest } from "./types.js";

const listFeatureRequestsRef = queryRef<{ limit?: number }, ConvexFeatureRequest[]>(
  "featureRequests:listFeatureRequests",
);

const createFeatureRequestRef = mutationRef<
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
  return runConvexQuery((client) => client.query(listFeatureRequestsRef, { limit }));
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
  return runConvexMutation((client) => client.mutation(createFeatureRequestRef, args));
};
