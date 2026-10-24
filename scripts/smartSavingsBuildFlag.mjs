/*
 * Whether this build may ship Smart Savings, decided fail-closed.
 *
 * `VITE_SMART_SAVINGS_ENABLED=true` is baked into the bundle at build time,
 * and Vite reads it from the shell *and* from every .env file, including a
 * developer's private `.env.local` during `vite build`. So a production
 * build could turn the feature on by accident: a tracked file, a variable
 * inherited from CI, a value copied around. These rules stop that:
 *
 *   VITE_SMART_SAVINGS_ENABLED   unset, "true" or "false"; anything else
 *                                ("1", "TRUE", "yes") is an error, not "off"
 *   committable env files        `.env` and `.env.[mode]` must never set it;
 *                                use `.env.local` (git-ignored) instead
 *   production build (on)        also needs SMARTSPEND_SMART_SAVINGS_RELEASE_APPROVED
 *                                exactly "true" in the shell environment;
 *                                an env file cannot approve a release
 *
 * The dev server and non-production modes need no approval, so local work
 * with the feature on is unchanged.
 *
 * resolveSmartSavingsBuild is pure; readCommittableEnvFiles is the only I/O.
 * tests/smartSavingsBuildFlag.test.mjs proves the rules.
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export const FLAG = "VITE_SMART_SAVINGS_ENABLED";
export const APPROVAL = "SMARTSPEND_SMART_SAVINGS_RELEASE_APPROVED";

export class SmartSavingsBuildError extends Error {
  constructor(message) {
    super(message);
    this.name = "SmartSavingsBuildError";
  }
}

const clean = (value) => (typeof value === "string" ? value.trim() : "");

// A line that assigns the flag, as dotenv reads it (optionally `export`ed).
const ASSIGNS_FLAG = new RegExp(`^\\s*(?:export\\s+)?${FLAG}\\s*=`, "m");

/** The env files Vite loads for `mode` that are meant to be committed. */
export const committableEnvFiles = (mode) => [...new Set([".env", `.env.${mode}`])];

/**
 * @param {string} root
 * @param {string} mode
 * @returns {Record<string, string>} file name → contents, for the files that exist
 */
export function readCommittableEnvFiles(root, mode) {
  const files = {};
  for (const name of committableEnvFiles(mode)) {
    const file = path.join(root, name);
    if (existsSync(file)) files[name] = readFileSync(file, "utf8");
  }
  return files;
}

/**
 * @param {{
 *   command: string,
 *   mode: string,
 *   env: Record<string, string | undefined>,          process.env merged over the .env files
 *   processEnv: Record<string, string | undefined>,   the shell / CI environment alone
 *   committableFiles?: Record<string, string>,        from readCommittableEnvFiles
 * }} input
 * @returns {{ enabled: boolean, approved: boolean }}
 */
export function resolveSmartSavingsBuild({ command, mode, env, processEnv, committableFiles = {} }) {
  for (const [name, contents] of Object.entries(committableFiles)) {
    if (ASSIGNS_FLAG.test(contents)) {
      throw new SmartSavingsBuildError(
        `${name} sets ${FLAG}. That file can be committed, so it must not decide whether Smart Savings ships. `
        + `Remove the line; to try the feature locally put ${FLAG}=true in .env.local.`,
      );
    }
  }

  const value = clean(env[FLAG]);
  if (!["", "true", "false"].includes(value)) {
    throw new SmartSavingsBuildError(`${FLAG} must be "true" or "false" (or unset), got "${value}".`);
  }

  const enabled = value === "true";
  const approved = clean(processEnv[APPROVAL]) === "true";

  if (enabled && command === "build" && mode === "production" && !approved) {
    throw new SmartSavingsBuildError(
      `This production build would ship Smart Savings (${FLAG}=true), but the release is not approved. `
      + `Smart Savings stays off in production until the product owner approves it: unset ${FLAG} `
      + `(check .env.local and the shell), or set ${APPROVAL}=true in the build environment `
      + `only for an approved release. See docs/savings-goals/smart-plans.md.`,
    );
  }

  return { enabled, approved };
}
