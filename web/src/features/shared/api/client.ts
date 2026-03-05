export class ApiError extends Error {
  status: number;
  payload: unknown;

  constructor(message: string, status: number, payload: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

type ApiRequestInit = Omit<RequestInit, "credentials"> & {
  credentials?: RequestCredentials;
};

const toMessage = (payload: unknown, fallback: string) => {
  if (!payload || typeof payload !== "object") return fallback;
  const maybeError = (payload as { error?: { message?: unknown } }).error;
  if (maybeError && typeof maybeError.message === "string" && maybeError.message.trim()) {
    return maybeError.message;
  }
  return fallback;
};

const parseJson = async (response: Response) => {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const joinUrl = (baseUrl: string, path: string) => {
  if (!baseUrl) return path;
  return `${baseUrl}${path}`;
};

export const createApiClient = (baseUrl = "") => {
  const request = async <T = unknown>(path: string, init: ApiRequestInit = {}): Promise<T> => {
    const response = await fetch(joinUrl(baseUrl, path), {
      ...init,
      credentials: init.credentials ?? "include",
    });
    const payload = await parseJson(response);
    if (!response.ok) {
      throw new ApiError(
        toMessage(payload, `Request failed (${response.status})`),
        response.status,
        payload,
      );
    }
    return payload as T;
  };

  return {
    request,
    get: <T = unknown>(path: string, init: ApiRequestInit = {}) =>
      request<T>(path, {
        ...init,
        method: "GET",
      }),
    post: <T = unknown>(path: string, body?: BodyInit | null, init: ApiRequestInit = {}) =>
      request<T>(path, {
        ...init,
        method: "POST",
        body: body ?? null,
      }),
    patch: <T = unknown>(path: string, body?: BodyInit | null, init: ApiRequestInit = {}) =>
      request<T>(path, {
        ...init,
        method: "PATCH",
        body: body ?? null,
      }),
  };
};
