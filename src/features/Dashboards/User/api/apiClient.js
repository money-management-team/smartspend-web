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

const isFormData = (value) =>
  typeof FormData !== "undefined" && value instanceof FormData;

function createRequestHeaders(headers, auth) {
  const token = auth ? getAuthToken() : null;
  const localStorage = getBrowserStorage("localStorage");
  const requestHeaders = {
    Accept: "application/json",
    "Accept-Language": readStorageValue(localStorage, "i18nextLng") ?? "ar",
    ...headers,
  };

  if (token) requestHeaders.Authorization = `Bearer ${token}`;

  return requestHeaders;
}

// fetch with the caller's signal and a timeout; network failures and
// timeouts become ApiErrors, a caller abort is rethrown as is.
async function sendRequest(url, init, { signal, timeoutMs }) {
  const requestSignal = createRequestSignal(signal, timeoutMs);

  try {
    return await fetch(url, { ...init, signal: requestSignal.signal });
  } catch (error) {
    if (error.name === "AbortError" && signal?.aborted) throw error;

    if (error.name === "AbortError" && requestSignal.didTimeOut()) {
      throw new ApiError("", { code: "TIMEOUT", cause: error });
    }

    throw new ApiError("", { code: "NETWORK_ERROR", cause: error });
  } finally {
    requestSignal.cleanup();
  }
}

// The ApiError for a failed response (non-OK status or `status: false`).
// A 401 on an authenticated request also ends the session.
function createResponseError(response, result, auth) {
  if (response.status === 401 && auth) {
    clearAuthSession();
    notifySessionExpired();
  }

  return new ApiError(result?.message ?? "", {
    status: response.status,
    errors: result?.errors ?? {},
    retryAfter: response.headers.get("Retry-After"),
    code: getErrorCode(response.status),
    payload: result,
  });
}

/*
 * JSON request. `body` is sent as JSON, except a FormData body (file
 * uploads), which is passed to fetch untouched so the browser sets the
 * multipart Content-Type with its boundary.
 */
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
  const requestHeaders = createRequestHeaders(headers, auth);
  const isMultipart = isFormData(body);

  if (body !== undefined && !isMultipart) requestHeaders["Content-Type"] = "application/json";

  const response = await sendRequest(
    `${API_BASE_URL}${endpoint}${createQueryString(query)}`,
    {
      method,
      headers: requestHeaders,
      body: body === undefined ? undefined : isMultipart ? body : JSON.stringify(body),
    },
    { signal, timeoutMs },
  );

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
    throw createResponseError(response, result, auth);
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

/*
 * An absolute or relative backend URL as an `apiRequest` / `apiDownload`
 * endpoint, with its query string kept byte for byte.
 *
 * This exists for **signed** URLs (`?expires=…&signature=…`), where the
 * signature is computed over the exact query as the backend wrote it:
 * re-encoding it, reordering it or round-tripping it through
 * `createQueryString` would invalidate it. So the query is never parsed —
 * everything after `?` is carried across untouched, the same way
 * `authApi.verifyEmail` passes an emailed signed link through.
 *
 * Returns null when the URL points somewhere other than this API, so a
 * foreign origin can never be sent the caller's bearer token.
 */
export function toApiRelativeUrl(url) {
  const text = String(url ?? "").trim();
  if (!text) return null;

  /*
   * "//host/path" and "/\host/path" are protocol-relative: standard URL
   * resolution reads them as another origin, not as a path on this one. They
   * are rejected rather than passed on as if they were API-relative.
   */
  if (/^[/\\]{2}/.test(text) || /^\/[\\]/.test(text)) return null;

  // Already relative to the API root.
  if (text.startsWith("/")) return text;

  if (/^https?:\/\//i.test(text)) {
    const base = `${API_BASE_URL}/`;
    // Same API, including its `/api` prefix: keep only what follows it.
    if (text.startsWith(base)) return text.slice(API_BASE_URL.length);
    return null;
  }

  return null;
}

const DOWNLOAD_TIMEOUT_MS = 60_000;

// File name from a Content-Disposition header (RFC 5987 `filename*` first).
export function getContentDispositionFilename(header) {
  if (!header) return null;

  const encoded = header.match(/filename\*\s*=\s*([^']*)'[^']*'([^;]+)/i);
  if (encoded) {
    try {
      return decodeURIComponent(encoded[2].trim().replace(/^"(.*)"$/, "$1"));
    } catch {
      // Malformed encoding: fall back to the plain parameter.
    }
  }

  const plain = header.match(/filename\s*=\s*("([^"]*)"|[^;]+)/i);
  const name = plain ? (plain[2] ?? plain[1]).trim() : "";
  return name || null;
}

/*
 * Authenticated binary download (e.g. an exported CSV). Same token,
 * Accept-Language, timeout and 401 handling as apiRequest, but a successful
 * body is returned as a Blob and never parsed as JSON. Error responses are
 * still read as the JSON envelope, so their message reaches the user.
 *
 * Returns { blob, filename, contentType }; `filename` is null when the
 * header is missing or not exposed by CORS.
 */
export async function apiDownload(
  endpoint,
  { query, signal, timeoutMs = DOWNLOAD_TIMEOUT_MS, auth = true } = {},
) {
  const headers = createRequestHeaders({ Accept: "*/*" }, auth);
  const response = await sendRequest(
    `${API_BASE_URL}${endpoint}${createQueryString(query)}`,
    { method: "GET", headers },
    { signal, timeoutMs },
  );
  const contentType = response.headers.get("Content-Type") ?? "";

  if (!response.ok) {
    let result = null;

    try {
      result = JSON.parse(await response.text());
    } catch {
      // Not the JSON envelope: the status code alone describes the error.
    }

    throw createResponseError(response, result, auth);
  }

  // A JSON envelope instead of a file means the backend refused it.
  if (contentType.includes("application/json")) {
    // No initialiser: the catch below throws, so it is always assigned here.
    let result;

    try {
      result = JSON.parse(await response.text());
    } catch (error) {
      throw new ApiError("", { status: response.status, code: "MALFORMED_RESPONSE", cause: error });
    }

    throw result?.status === false
      ? createResponseError(response, result, auth)
      : new ApiError("", { status: response.status, code: "MALFORMED_RESPONSE", payload: result });
  }

  return {
    blob: await response.blob(),
    filename: getContentDispositionFilename(response.headers.get("Content-Disposition")),
    contentType,
  };
}

/*
 * Hands a downloaded Blob to the browser as a file. The object URL exists
 * only for this click and is revoked right after, so none are leaked.
 */
export function saveBlobAsFile(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = filename;
  link.rel = "noopener";
  link.style.display = "none";
  document.body.appendChild(link);

  try {
    link.click();
  } finally {
    link.remove();
    // Revoked shortly after: some browsers (Safari) start the download
    // asynchronously after the click and fail if the URL is already gone.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
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
