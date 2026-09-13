const API_BASE_URL = (import.meta.env?.VITE_API_BASE_URL ?? "/api").replace(
  /\/$/,
  "",
);

const REQUEST_TIMEOUT_MS = 20_000;
const AUTH_TOKEN_KEY = "ACCESS_TOKEN";
const LEGACY_AUTH_TOKEN_KEY = "token";
const AUTH_SESSION_KEYS = [
  AUTH_TOKEN_KEY,
  LEGACY_AUTH_TOKEN_KEY,
  "token_type",
  "user",
  "workspace",
  "ROLE",
  "remember_login",
];

export const AUTH_SESSION_EXPIRED_EVENT = "smartspend:session-expired";

export class ApiError extends Error {
  constructor(
    message,
    {
      status = 0,
      errors = {},
      retryAfter = null,
      code = "REQUEST_FAILED",
      payload = null,
      cause,
    } = {},
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.errors = errors;
    this.retryAfter = retryAfter;
    this.code = code;
    this.payload = payload;

    if (cause !== undefined) this.cause = cause;
  }
}

function getBrowserStorage(storageName) {
  try {
    return globalThis[storageName] ?? null;
  } catch {
    return null;
  }
}

function readStorageValue(storage, key) {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
}

function writeStorageValue(storage, key, value) {
  try {
    storage?.setItem(key, value);
  } catch {
    // Authentication still works for the active tab when storage is blocked.
  }
}

function removeStorageValue(storage, key) {
  try {
    storage?.removeItem(key);
  } catch {
    // A blocked storage area is already unavailable to the application.
  }
}

function parseStoredJson(value) {
  if (!value) return null;

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function getAuthStorageEntry() {
  const storages = [
    getBrowserStorage("localStorage"),
    getBrowserStorage("sessionStorage"),
  ].filter(Boolean);

  for (const tokenKey of [AUTH_TOKEN_KEY, LEGACY_AUTH_TOKEN_KEY]) {
    for (const storage of storages) {
      const token = readStorageValue(storage, tokenKey);
      if (token) return { storage, token };
    }
  }

  return { storage: null, token: null };
}

export function getAuthToken() {
  return getAuthStorageEntry().token;
}

export function getStoredAuthSession() {
  const { storage, token } = getAuthStorageEntry();

  if (!storage || !token) {
    return {
      token: null,
      tokenType: "Bearer",
      user: null,
      workspace: null,
      role: "guest",
    };
  }

  const user = parseStoredJson(readStorageValue(storage, "user"));

  return {
    token,
    tokenType: readStorageValue(storage, "token_type") ?? "Bearer",
    user,
    workspace: parseStoredJson(readStorageValue(storage, "workspace")),
    role: readStorageValue(storage, "ROLE") ?? user?.role ?? "user",
  };
}

export function clearAuthSession() {
  [
    getBrowserStorage("localStorage"),
    getBrowserStorage("sessionStorage"),
  ]
    .filter(Boolean)
    .forEach((storage) => {
      AUTH_SESSION_KEYS.forEach((key) => removeStorageValue(storage, key));
    });
}

export function persistAuthSession(authData, { remember = true } = {}) {
  if (!authData?.token || !authData?.user) {
    throw new ApiError("", { code: "MALFORMED_RESPONSE" });
  }

  const storage = getBrowserStorage(
    remember ? "localStorage" : "sessionStorage",
  );

  clearAuthSession();

  writeStorageValue(storage, AUTH_TOKEN_KEY, authData.token);
  writeStorageValue(storage, "token_type", authData.token_type ?? "Bearer");
  writeStorageValue(storage, "user", JSON.stringify(authData.user));
  writeStorageValue(storage, "ROLE", authData.user.role ?? "user");
  writeStorageValue(storage, "remember_login", String(remember));

  if (authData.workspace) {
    writeStorageValue(storage, "workspace", JSON.stringify(authData.workspace));
  }
}

export function updateStoredUser(user) {
  const { storage } = getAuthStorageEntry();
  if (storage && user) writeStorageValue(storage, "user", JSON.stringify(user));
}

export function getStoredWorkspace() {
  const { storage } = getAuthStorageEntry();
  return parseStoredJson(readStorageValue(storage, "workspace"));
}

export function updateStoredWorkspace(workspace) {
  const { storage } = getAuthStorageEntry();

  if (!storage) return;

  if (workspace) {
    writeStorageValue(storage, "workspace", JSON.stringify(workspace));
  } else {
    removeStorageValue(storage, "workspace");
  }
}

// Keeps only the query params an endpoint documents, so a list wrapper can
// never send a filter the backend doesn't accept (e.g. an invented
// `workspace_id`).
export function pickQuery(query, allowedKeys) {
  const picked = {};

  allowedKeys.forEach((key) => {
    if (query?.[key] !== undefined) picked[key] = query[key];
  });

  return picked;
}

function createQueryString(query = {}) {
  const params = new URLSearchParams();

  Object.entries(query).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;

    if (Array.isArray(value)) {
      value.forEach((item) => params.append(key, String(item)));
      return;
    }

    params.set(key, String(value));
  });

  const queryString = params.toString();
  return queryString ? `?${queryString}` : "";
}

function getErrorCode(status) {
  if (status === 401) return "UNAUTHENTICATED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 409) return "CONFLICT";
  if (status === 422) return "VALIDATION_ERROR";
  if (status === 429) return "RATE_LIMITED";
  if (status >= 500) return "SERVER_ERROR";
  return "REQUEST_FAILED";
}

function notifySessionExpired() {
  if (typeof globalThis.dispatchEvent !== "function") return;

  globalThis.dispatchEvent(new Event(AUTH_SESSION_EXPIRED_EVENT));
}

function createRequestSignal(callerSignal, timeoutMs) {
  const controller = new AbortController();
  let timedOut = false;

  const abortFromCaller = () => controller.abort(callerSignal?.reason);

  if (callerSignal?.aborted) {
    abortFromCaller();
  } else {
    callerSignal?.addEventListener("abort", abortFromCaller, { once: true });
  }

  const timeoutId = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  return {
    signal: controller.signal,
    didTimeOut: () => timedOut,
    cleanup: () => {
      clearTimeout(timeoutId);
      callerSignal?.removeEventListener("abort", abortFromCaller);
    },
  };
}

export async function apiRequest(
  endpoint,
  {
    method = "GET",
    query,
    body,
    headers = {},
    signal,
    timeoutMs = REQUEST_TIMEOUT_MS,
    auth = true,
  } = {},
) {
  const token = auth ? getAuthToken() : null;
  const localStorage = getBrowserStorage("localStorage");
  const requestHeaders = {
    Accept: "application/json",
    "Accept-Language": readStorageValue(localStorage, "i18nextLng") ?? "ar",
    ...headers,
  };

  if (token) requestHeaders.Authorization = `Bearer ${token}`;
  if (body !== undefined) requestHeaders["Content-Type"] = "application/json";

  const requestSignal = createRequestSignal(signal, timeoutMs);
  let response;

  try {
    response = await fetch(`${API_BASE_URL}${endpoint}${createQueryString(query)}`, {
      method,
      headers: requestHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: requestSignal.signal,
    });
  } catch (error) {
    if (error.name === "AbortError" && signal?.aborted) throw error;

    if (error.name === "AbortError" && requestSignal.didTimeOut()) {
      throw new ApiError("", { code: "TIMEOUT", cause: error });
    }

    throw new ApiError("", { code: "NETWORK_ERROR", cause: error });
  } finally {
    requestSignal.cleanup();
  }

  const responseText = await response.text();
  let result = null;

  if (responseText) {
    try {
      result = JSON.parse(responseText);
    } catch (error) {
      if (response.ok) {
        throw new ApiError("", {
          status: response.status,
          code: "MALFORMED_RESPONSE",
          cause: error,
        });
      }
    }
  }

  if (!response.ok || result?.status === false) {
    if (response.status === 401 && auth) {
      clearAuthSession();
      notifySessionExpired();
    }

    throw new ApiError(result?.message ?? "", {
      status: response.status,
      errors: result?.errors ?? {},
      retryAfter: response.headers.get("Retry-After"),
      code: getErrorCode(response.status),
      payload: result,
    });
  }

  if (!result || typeof result !== "object" || result.status !== true) {
    throw new ApiError("", {
      status: response.status,
      code: "MALFORMED_RESPONSE",
      payload: result,
    });
  }

  return result;
}

export function getApiErrorMessage(error, t) {
  if (error?.code === "NETWORK_ERROR") return t("api.errors.network");
  if (error?.code === "TIMEOUT") return t("api.errors.timeout");
  if (error?.code === "MALFORMED_RESPONSE") return t("api.errors.unexpected");
  if (error?.code === "SERVER_ERROR" && !error.message) {
    return t("api.errors.server");
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
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "";
    return value.toFixed(4);
  }

  const match = String(value ?? "")
    .trim()
    .match(/^([+-]?)(\d+)(?:\.(\d{0,4}))?$/);

  if (!match) return "";

  const [, sign, integer, fraction = ""] = match;
  return `${sign}${integer}.${fraction.padEnd(4, "0")}`;
}

export function createIdempotencyKey(prefix = "transfer") {
  if (globalThis.crypto?.randomUUID) {
    return `${prefix}-${globalThis.crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}
