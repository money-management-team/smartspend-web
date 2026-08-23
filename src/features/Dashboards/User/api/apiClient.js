const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(
    message,
    { status = 0, errors = {}, retryAfter = null, code = "REQUEST_FAILED" } = {},
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.errors = errors;
    this.retryAfter = retryAfter;
    this.code = code;
  }
}

export function getAuthToken() {
  return localStorage.getItem("token") ?? sessionStorage.getItem("token");
}

export function clearAuthSession() {
  [localStorage, sessionStorage].forEach((storage) => {
    storage.removeItem("token");
    storage.removeItem("token_type");
    storage.removeItem("user");
    storage.removeItem("workspace");
  });
}

function createQueryString(query = {}) {
  const params = new URLSearchParams();

  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      params.set(key, String(value));
    }
  });

  const queryString = params.toString();
  return queryString ? `?${queryString}` : "";
}

export async function apiRequest(
  endpoint,
  { method = "GET", query, body, headers = {}, signal } = {},
) {
  const token = getAuthToken();
  const requestHeaders = {
    Accept: "application/json",
    "Accept-Language": localStorage.getItem("i18nextLng") ?? "ar",
    ...headers,
  };

  if (token) {
    requestHeaders.Authorization = `Bearer ${token}`;
  }

  if (body !== undefined) {
    requestHeaders["Content-Type"] = "application/json";
  }

  let response;

  try {
    response = await fetch(`${API_BASE_URL}${endpoint}${createQueryString(query)}`, {
      method,
      headers: requestHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal,
    });
  } catch (error) {
    if (error.name === "AbortError") throw error;

    throw new ApiError("", { code: "NETWORK_ERROR" });
  }

  const result = await response.json().catch(() => null);

  if (response.status === 401) {
    clearAuthSession();

    if (window.location.pathname !== "/signin") {
      window.location.assign("/signin");
    }
  }

  if (!response.ok || result?.status === false) {
    const retryAfter = response.headers.get("Retry-After");
    throw new ApiError(result?.message ?? "", {
      status: response.status,
      errors: result?.errors ?? {},
      retryAfter,
      code: response.status === 429 ? "RATE_LIMITED" : "REQUEST_FAILED",
    });
  }

  return result;
}

export function getApiErrorMessage(error, t) {
  if (error?.code === "NETWORK_ERROR") {
    return t("api.errors.network");
  }

  if (error?.code === "RATE_LIMITED") {
    return t("api.errors.rateLimited", {
      seconds: error.retryAfter ?? t("api.errors.aFew"),
    });
  }

  if (error?.code === "WORKSPACE_UNAVAILABLE") {
    return t("api.errors.workspaceUnavailable");
  }

  return error?.message || t("api.errors.requestFailed");
}

export function toMoneyString(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) return "";
  return number.toFixed(4);
}

export function createIdempotencyKey() {
  if (globalThis.crypto?.randomUUID) {
    return `transfer-${globalThis.crypto.randomUUID()}`;
  }

  return `transfer-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}
