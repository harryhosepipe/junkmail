import { badRequest } from "../http/errors.js";

export const ALIAS_MIN_LENGTH = 2;
export const ALIAS_MAX_LENGTH = 32;

export const parseAliasPatch = (body: unknown) => {
  const data = (body ?? {}) as Record<string, unknown>;
  const alias = typeof data.alias === "string" ? data.alias.trim() : "";

  if (alias.length < ALIAS_MIN_LENGTH || alias.length > ALIAS_MAX_LENGTH) {
    throw badRequest(`Alias must be ${ALIAS_MIN_LENGTH}-${ALIAS_MAX_LENGTH} characters.`);
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(alias)) {
    throw badRequest("Alias can only contain letters, numbers, underscores, and hyphens.");
  }

  return alias;
};
