export const publicApiBaseUrl = import.meta.env.PUBLIC_API_BASE_URL ?? "/api";

export const serverApiBaseUrl =
  import.meta.env.API_BASE_URL ?? import.meta.env.PUBLIC_API_BASE_URL ?? "http://localhost:8787";
