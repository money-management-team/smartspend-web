/*
 * Where the local Vite dev server sends API traffic, decided fail-closed.
 *
 * A plain `npm run dev` must never talk to a real backend by accident: not to
 * staging, not to production, and not because a tracked env file said so.
 * Without any configuration the dev server proxies `/api` to the local Laravel
 * (`php artisan serve`, port 8000). Anything else has to be asked for by name,
 * and a remote target has to be confirmed a second time:
 *
 *   SMARTSPEND_DEV_API_ORIGIN   origin the `/api` proxy forwards to
 *   SMARTSPEND_ALLOW_REMOTE_API must be exactly "true" to use a non-loopback
 *                               origin, or an absolute non-loopback
 *                               VITE_API_BASE_URL, in the dev server
 *
 * Production builds are not touched by this module: `vite build` takes
 * VITE_API_BASE_URL from the environment exactly as before (the Hostinger
 * workflow sets and validates it).
 *
 * Pure functions, no I/O, so tests/devApiTarget.test.mjs can prove the rules.
 */

export const DEFAULT_DEV_API_ORIGIN = "http://127.0.0.1:8000";
export const ALLOW_REMOTE_FLAG = "SMARTSPEND_ALLOW_REMOTE_API";
export const ORIGIN_VARIABLE = "SMARTSPEND_DEV_API_ORIGIN";

const LOOPBACK_HOSTNAMES = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);

export class DevApiConfigError extends Error {
  constructor(message) {
    super(message);
    this.name = "DevApiConfigError";
  }
}

export const isLoopbackHostname = (hostname) =>
  LOOPBACK_HOSTNAMES.has(String(hostname).toLowerCase()) || /^127\.\d+\.\d+\.\d+$/.test(hostname);

const clean = (value) => (typeof value === "string" ? value.trim() : "");

function parseHttpOrigin(value, variable) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new DevApiConfigError(`${variable} must be an absolute http(s) URL, got "${value}".`);
  }
  if (!["http:", "https:"].includes(url.protocol) || !url.hostname) {
    throw new DevApiConfigError(`${variable} must use http or https, got "${value}".`);
  }
  return url;
}

const remoteHelp = (what, host) =>
  `${what} points at the remote host "${host}". Local development is fail-closed: `
  + `set ${ALLOW_REMOTE_FLAG}=true (in your shell or in .env.local) only if you really intend to use that server. `
  + `Otherwise unset it to use ${DEFAULT_DEV_API_ORIGIN}.`;

/**
 * @param {{ command: string, env: Record<string, string | undefined> }} input
 *   `env` is process.env merged over the .env files (process.env wins).
 * @returns {{ origin: string | null, remote: boolean, source: string }}
 *   `origin` is the proxy target for `vite serve`; null for any other command.
 */
export function resolveDevApiTarget({ command, env }) {
  if (command !== "serve") return { origin: null, remote: false, source: "not-a-dev-server" };

  const allowRemote = clean(env[ALLOW_REMOTE_FLAG]) === "true";
  const configured = clean(env[ORIGIN_VARIABLE]);
  const origin = configured || DEFAULT_DEV_API_ORIGIN;
  const url = parseHttpOrigin(origin, ORIGIN_VARIABLE);
  const remote = !isLoopbackHostname(url.hostname);

  if (remote && !allowRemote) throw new DevApiConfigError(remoteHelp(ORIGIN_VARIABLE, url.hostname));

  // An absolute VITE_API_BASE_URL bypasses the proxy entirely: the browser
  // would call that host directly, so it gets the same treatment.
  const base = clean(env.VITE_API_BASE_URL);
  if (/^https?:\/\//i.test(base)) {
    const baseUrl = parseHttpOrigin(base, "VITE_API_BASE_URL");
    if (!isLoopbackHostname(baseUrl.hostname) && !allowRemote) {
      throw new DevApiConfigError(remoteHelp("VITE_API_BASE_URL", baseUrl.hostname));
    }
  } else if (base && !base.startsWith("/")) {
    throw new DevApiConfigError(
      `VITE_API_BASE_URL must be a path such as "/api" or an absolute URL, got "${base}".`,
    );
  }

  return {
    origin: url.origin,
    remote,
    source: configured ? ORIGIN_VARIABLE : "default-localhost",
  };
}
