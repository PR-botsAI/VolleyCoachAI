import Constants from "expo-constants";
import { useAuthStore } from "../stores/auth";
import { getIdToken } from "./firebase";
import type { ApiResponse } from "@volleycoach/shared";

const BASE_URL =
  Constants.expoConfig?.extra?.apiUrl ?? "http://localhost:3000/api";

interface RequestConfig extends Omit<RequestInit, "body"> {
  body?: Record<string, unknown> | FormData;
  params?: Record<string, string | number | boolean | undefined>;
  skipAuth?: boolean;
}

class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

function buildUrl(
  path: string,
  params?: Record<string, string | number | boolean | undefined>
): string {
  const url = new URL(path, BASE_URL);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        url.searchParams.append(key, String(value));
      }
    });
  }
  return url.toString();
}

/**
 * Get a fresh Firebase ID token for API requests.
 * Falls back to the cached token in the auth store if Firebase
 * token refresh fails.
 */
async function getAuthToken(): Promise<string | null> {
  try {
    // Get a fresh token from Firebase (auto-refreshes if expired)
    const freshToken = await getIdToken();
    if (freshToken) {
      // Update the store with the fresh token
      useAuthStore.getState().setFirebaseIdToken(freshToken);
      return freshToken;
    }
  } catch {
    // Fall back to cached token
  }

  return useAuthStore.getState().firebaseIdToken;
}

async function request<T>(
  path: string,
  config: RequestConfig = {}
): Promise<ApiResponse<T>> {
  const { body, params, skipAuth, ...init } = config;

  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(init.headers as Record<string, string>),
  };

  if (!skipAuth) {
    const token = await getAuthToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }

  if (body && !(body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const url = buildUrl(path, params);

  let response = await fetch(url, {
    ...init,
    headers,
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  });

  // Handle token refresh on 401
  if (response.status === 401 && !skipAuth) {
    // Force refresh the Firebase token
    const freshToken = await getIdToken(true);
    if (freshToken) {
      useAuthStore.getState().setFirebaseIdToken(freshToken);
      headers["Authorization"] = `Bearer ${freshToken}`;
      response = await fetch(url, {
        ...init,
        headers,
        body:
          body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
      });
    }
  }

  const json = (await response.json()) as ApiResponse<T>;

  if (!response.ok) {
    throw new ApiError(
      response.status,
      json.error?.code ?? "UNKNOWN_ERROR",
      json.error?.message ?? "An unexpected error occurred",
      json.error?.details
    );
  }

  return json;
}

export const api = {
  get: <T>(path: string, config?: RequestConfig) =>
    request<T>(path, { ...config, method: "GET" }),

  post: <T>(
    path: string,
    body?: Record<string, unknown>,
    config?: RequestConfig
  ) => request<T>(path, { ...config, method: "POST", body }),

  put: <T>(
    path: string,
    body?: Record<string, unknown>,
    config?: RequestConfig
  ) => request<T>(path, { ...config, method: "PUT", body }),

  patch: <T>(
    path: string,
    body?: Record<string, unknown>,
    config?: RequestConfig
  ) => request<T>(path, { ...config, method: "PATCH", body }),

  delete: <T>(path: string, config?: RequestConfig) =>
    request<T>(path, { ...config, method: "DELETE" }),

  upload: <T>(path: string, formData: FormData, config?: RequestConfig) =>
    request<T>(path, { ...config, method: "POST", body: formData }),
};

export { ApiError, BASE_URL };
