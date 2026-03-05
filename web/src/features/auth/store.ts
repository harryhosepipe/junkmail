import { createAuthApi, type Profile, type SessionUser } from "./api";

type AuthSessionState = {
  state: "loading" | "guest" | "authed";
  user: SessionUser | null;
};

export const createAuthSessionStore = (apiBaseUrl = "") => {
  const api = createAuthApi(apiBaseUrl);
  const session: AuthSessionState = {
    state: "loading",
    user: null,
  };

  const loadSession = async () => {
    try {
      const data = await api.getMe();
      session.user = data?.user ?? null;
      session.state = session.user ? "authed" : "guest";
      return session;
    } catch {
      session.user = null;
      session.state = "guest";
      return session;
    }
  };

  const logout = async () => {
    await api.logout().catch(() => null);
    session.user = null;
    session.state = "guest";
    return session;
  };

  return {
    session,
    loadSession,
    logout,
  };
};

export const createProfileStore = (apiBaseUrl = "") => {
  const api = createAuthApi(apiBaseUrl);
  const state: {
    loading: boolean;
    saving: boolean;
    errorMessage: string;
    successMessage: string;
    profile: Profile | null;
  } = {
    loading: true,
    saving: false,
    errorMessage: "",
    successMessage: "",
    profile: null,
  };

  const load = async () => {
    state.loading = true;
    state.errorMessage = "";
    state.successMessage = "";
    try {
      const data = await api.getProfile();
      state.profile = data?.profile ?? null;
    } catch (error) {
      state.profile = null;
      state.errorMessage = "Could not load profile.";
      throw error;
    } finally {
      state.loading = false;
    }
    return state;
  };

  const saveAlias = async (alias: string) => {
    state.saving = true;
    state.errorMessage = "";
    state.successMessage = "";
    try {
      const data = await api.patchProfile(alias);
      state.profile = {
        ...(state.profile ?? {}),
        ...(data?.profile ?? {}),
        alias: data?.profile?.alias ?? alias.trim(),
      };
      state.successMessage = "Profile updated.";
    } finally {
      state.saving = false;
    }
    return state;
  };

  return {
    state,
    load,
    saveAlias,
  };
};
