import { makeFunctionReference } from "convex/server";
import type { DefaultFunctionArgs } from "convex/server";

export const queryRef = <Args extends DefaultFunctionArgs, Result>(name: string) =>
  makeFunctionReference<"query", Args, Result>(name);

export const mutationRef = <Args extends DefaultFunctionArgs, Result>(name: string) =>
  makeFunctionReference<"mutation", Args, Result>(name);
