import { createApiClient } from "../shared/api/client";

type SessionUser = {
  id?: string;
  email?: string;
  alias?: string;
  role?: string;
};

type SessionResponse = {
  user?: SessionUser;
};

type Profile = {
  alias?: string;
  email?: string;
  createdAt?: string;
  votesCast?: number;
  uploadedImages?: number;
};

type ProfileResponse = {
  profile?: Profile;
};

export const createAuthApi = (apiBaseUrl = "") => {
  const api = createApiClient(apiBaseUrl);
  return {
    getMe: () => api.get<SessionResponse>("/api/v1/auth/me"),
    logout: () =>
      api.post("/api/v1/auth/logout", null, {
        headers: { "Content-Type": "application/json" },
      }),
    getProfile: () => api.get<ProfileResponse>("/api/v1/auth/profile"),
    patchProfile: (alias: string) =>
      api.patch<ProfileResponse>("/api/v1/auth/profile", JSON.stringify({ alias }), {
        headers: { "Content-Type": "application/json" },
      }),
  };
};

export type { SessionUser, Profile };
