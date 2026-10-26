/*
 * Whether this build may include the Mobile experience, decided fail-closed.
 *
 * `VITE_MOBILE_ENABLED=true` is baked into the bundle at build time, so the
 * rules below keep it from being switched on by accident:
 *
 *   VITE_MOBILE_ENABLED     unset or "false" = off. Only the exact string
 *                           "true" turns it on. "TRUE", "1", "yes" and
 *                           "true " (trailing space) never do. The value is
 *                           NOT trimmed, so this script and the bundle read
 *                           the same string: whatever it calls "on" is "on"
 *                           in the code, and vice versa.
 *   committable env files   `.env` and `.env.[mode]` must never set it; use
 *                           `.env.local` (git-ignored) for local testing.
 *   production build (on)   also needs SMARTSPEND_MOBILE_RELEASE_APPROVED
 *                           exactly "true" in the shell environment; an env
 *                           file cannot approve a release.
 *   an unrecognised value   resolves to OFF (never on). A production build
 *                           refuses it outright; other builds only warn, so a
 *                           stray variable cannot block Desktop development.
 *
 * Unlike the Smart Savings flag, a bad value does not stop `npm run dev`.
 * That keeps a polluted shell variable from blocking unrelated Desktop work,
 * while a release build still fails loudly.
 *
 * resolveMobileBuild is pure; readCommittableEnvFiles (re-used from the Smart
 * Savings script, it only reads files) is the only I/O.
 * tests/mobileBuildFlag.test.mjs proves the rules.
 */

import { committableEnvFiles, readCommittableEnvFiles } from "./smartSavingsBuildFlag.mjs";

export { committableEnvFiles, readCommittableEnvFiles };

export const FLAG = "VITE_MOBILE_ENABLED";
export const APPROVAL = "SMARTSPEND_MOBILE_RELEASE_APPROVED";

export class MobileBuildError extends Error {
  constructor(message) {
    super(message);
    this.name = "MobileBuildError";
  }
}

const str = (value) => (typeof value === "string" ? value : "");

// A line that assigns the flag, as dotenv reads it (optionally `export`ed).
const ASSIGNS_FLAG = new RegExp(`^\\s*(?:export\\s+)?${FLAG}\\s*=`, "m");

/**
 * @param {{
 *   command: string,
 *   mode: string,
 *   env: Record<string, string | undefined>,          process.env merged over the .env files
 *   processEnv: Record<string, string | undefined>,   the shell / CI environment alone
 *   committableFiles?: Record<string, string>,        from readCommittableEnvFiles
 * }} input
 * @returns {{ enabled: boolean, approved: boolean, invalid: boolean }}
 */
export function resolveMobileBuild({ command, mode, env, processEnv, committableFiles = {} }) {
  for (const [name, contents] of Object.entries(committableFiles)) {
    if (ASSIGNS_FLAG.test(contents)) {
      throw new MobileBuildError(
        `${name} sets ${FLAG}. That file can be committed, so it must not decide whether Mobile ships. `
        + `Remove the line; to try Mobile locally put ${FLAG}=true in .env.local.`,
      );
    }
  }

  const value = str(env[FLAG]);
  const invalid = !["", "true", "false"].includes(value);
  const enabled = value === "true";
  const approved = str(processEnv[APPROVAL]) === "true";
  const isRelease = command === "build" && mode === "production";

  if (invalid && isRelease) {
    throw new MobileBuildError(
      `${FLAG} must be exactly "true" or "false" (or unset), got "${value}". `
      + "Mobile stays off unless the value is exactly \"true\".",
    );
  }

  if (enabled && isRelease && !approved) {
    throw new MobileBuildError(
      `This production build would ship Mobile (${FLAG}=true), but the release is not approved. `
      + `Mobile stays off in production until the release is approved: unset ${FLAG} `
      + `(check .env.local and the shell), or set ${APPROVAL}=true in the build environment `
      + "only for an approved release. See docs/mobile/S04A-foundation.md.",
    );
  }

  return { enabled, approved, invalid };
}
