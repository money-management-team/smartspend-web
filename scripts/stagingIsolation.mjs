#!/usr/bin/env node
/*
 * Staging isolation checks for the frontend. One module, three uses:
 *
 *   node scripts/stagingIsolation.mjs preflight    the staging workflow's first step: validates the configuration it was given
 *                                                  (names and shapes only; it never prints a secret) and FAILS CLOSED
 *   node scripts/stagingIsolation.mjs build <dir>  after the build: the output carries the staging API URL and no production host
 *   node scripts/stagingIsolation.mjs verify       the repository's own files: the staging workflow, the templates, and the production
 *                                                  workflow, which must not have changed (npm run staging:verify)
 *
 * tests/stagingIsolation.test.mjs runs the same functions, so the rules the workflow enforces and the rules the tests pin are one piece
 * of code. Every function is pure (text and plain objects in, a list of problems out) except the three small CLI readers at the bottom.
 *
 * What this cannot do: it cannot see GitHub's settings. In particular GitHub resolves a secret by NAME, and an environment that lacks a
 * secret falls back to a repository secret of the same name. That is why every staging secret has a name no production workflow uses, and
 * why the checks below refuse any production-named variable in the job. See docs/mobile/STAGING-INFRASTRUCTURE.md.
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, posix, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/* ---------- What production is (public identifiers only; the test checks these against the production workflow itself) ---------- */

export const PRODUCTION = Object.freeze({
  apiOrigin: "https://smartspend-api.anasalharazeen.com",
  apiBase: "https://smartspend-api.anasalharazeen.com/api",
  webOrigin: "https://smartspend.anasalharazeen.com",
  hosts: Object.freeze(["smartspend-api.anasalharazeen.com", "smartspend.anasalharazeen.com"]),
  // Where the production deploy puts things on the host (from deploy-hostinger.yml). A staging base must be none of these, and not inside or around one.
  deployRoots: Object.freeze(["/home/u316277277/deploy/smartspend-web", "/home/u316277277/deploy/smartspend"]),
  workflow: ".github/workflows/deploy-hostinger.yml",
  // SHA-256 of that workflow, LF line endings. A deliberate production change updates this, in plain view (last: the approved Mobile release inputs, docs/mobile/RELEASE-AND-ROLLBACK.md).
  workflowSha256: "56063d3ba8a1d929c426c56614e2a47947ffad170930dd2978218eb50e1fe365",
  // Names the production workflow reads. A staging workflow must never read any of them.
  secretNames: Object.freeze(["HOSTINGER_SSH_KEY", "HOSTINGER_KNOWN_HOSTS"]),
  varNames: Object.freeze(["VITE_API_BASE_URL", "VITE_GOOGLE_CLIENT_ID"]),
});

/** The only secrets and variables the staging workflow may read: unique names, so no repository-level value can answer to them by accident. */
export const STAGING_SECRETS = Object.freeze(["STAGING_SSH_KEY", "STAGING_KNOWN_HOSTS", "STAGING_SSH_HOST", "STAGING_SSH_USER", "STAGING_SSH_PORT"]);
export const STAGING_VARS = Object.freeze(["STAGING_API_BASE_URL", "STAGING_WEB_ORIGIN", "STAGING_REMOTE_BASE", "STAGING_GOOGLE_CLIENT_ID"]);

// A staging build comes from a named staging or integration branch, or an exact commit. Never from a production branch.
const REF_OK = /^(?:(?:staging|integration)\/[A-Za-z0-9._/-]+|[0-9a-f]{40})$/;
const PRODUCTION_BRANCHES = new Set(["development", "develop", "main", "master", "production", "release"]);

const hostOf = (url) => {
  try {
    return new URL(url);
  } catch {
    return null;
  }
};

/* ---------- Configuration ---------- */

/**
 * @param {Record<string, string | undefined>} env the job environment (process.env)
 * @returns {{ ok: boolean, problems: string[], warnings: string[] }}
 */
export function checkStagingConfig(env) {
  const problems = [];
  const warnings = [];
  const value = (name) => (typeof env[name] === "string" ? env[name].trim() : "");

  // 1. Everything required is present. Only names are ever reported.
  const required = [...STAGING_SECRETS, ...STAGING_VARS.filter((name) => name !== "STAGING_GOOGLE_CLIENT_ID"), "STAGING_REF"];
  const missing = required.filter((name) => !value(name));
  if (missing.length > 0) problems.push(`missing staging configuration: ${missing.join(", ")}`);

  // 2. Production-named values must not be present at all: a staging job has no business seeing them.
  const present = Object.keys(env).filter((name) => env[name] && (PRODUCTION.secretNames.includes(name) || /^HOSTINGER_/.test(name)));
  if (present.length > 0) problems.push(`production-named variables are present in the staging job: ${present.join(", ")}`);

  // 3. The API URL.
  const api = hostOf(value("STAGING_API_BASE_URL"));
  if (value("STAGING_API_BASE_URL")) {
    if (!api) problems.push("STAGING_API_BASE_URL is not a URL");
    else {
      if (api.protocol !== "https:") problems.push("STAGING_API_BASE_URL must be https");
      if (PRODUCTION.hosts.includes(api.hostname)) problems.push("STAGING_API_BASE_URL is a production host");
      if (!/staging/i.test(api.hostname)) problems.push("STAGING_API_BASE_URL host must contain \"staging\"");
      if (api.pathname.replace(/\/+$/, "") !== "/api") problems.push("STAGING_API_BASE_URL must end in /api");
      if (api.username || api.password || api.search || api.hash) problems.push("STAGING_API_BASE_URL must carry no credentials, query or fragment");
    }
  }

  // 4. The web origin (CORS on the staging backend allows exactly this).
  const web = hostOf(value("STAGING_WEB_ORIGIN"));
  if (value("STAGING_WEB_ORIGIN")) {
    if (!web) problems.push("STAGING_WEB_ORIGIN is not a URL");
    else {
      if (web.protocol !== "https:") problems.push("STAGING_WEB_ORIGIN must be https");
      if (PRODUCTION.hosts.includes(web.hostname)) problems.push("STAGING_WEB_ORIGIN is a production host");
      if (!/staging/i.test(web.hostname)) problems.push("STAGING_WEB_ORIGIN host must contain \"staging\"");
      if (web.pathname !== "/" || web.search || web.hash || web.username) problems.push("STAGING_WEB_ORIGIN must be an origin only (scheme and host)");
    }
  }
  if (api && web && api.hostname === web.hostname) problems.push("the staging API and web origin must be different hosts");

  // 5. The remote base: an absolute path with "staging" in it, that is none of production's deploy roots and not inside or around one.
  const base = value("STAGING_REMOTE_BASE");
  if (base) {
    if (!/^\/[A-Za-z0-9._/-]+$/.test(base) || base.includes("//") || base.split("/").includes("..") || base.split("/").includes(".")) problems.push("STAGING_REMOTE_BASE must be a clean absolute path (letters, digits, . _ - and /; no .., ., // or spaces)");
    else {
      const normal = posix.normalize(base).replace(/\/+$/, "");
      if (!normal.split("/").some((part) => /staging/i.test(part))) problems.push("STAGING_REMOTE_BASE must have a path segment containing \"staging\"");
      for (const root of PRODUCTION.deployRoots) {
        if (normal === root || normal.startsWith(`${root}/`) || root.startsWith(`${normal}/`)) problems.push(`STAGING_REMOTE_BASE is, is inside, or contains the production path ${root}`);
      }
    }
  }

  // 6. Shapes of the SSH values (never printed).
  const port = value("STAGING_SSH_PORT");
  if (port && !(/^\d{1,5}$/.test(port) && Number(port) >= 1 && Number(port) <= 65535)) problems.push("STAGING_SSH_PORT must be a port number");
  if (value("STAGING_SSH_KEY") && !/^-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(value("STAGING_SSH_KEY"))) problems.push("STAGING_SSH_KEY does not look like a private key");
  if (value("STAGING_SSH_HOST") && /\s/.test(value("STAGING_SSH_HOST"))) problems.push("STAGING_SSH_HOST must be a single host");
  if (value("STAGING_SSH_USER") && !/^[a-z_][a-z0-9_-]{0,31}$/i.test(value("STAGING_SSH_USER"))) problems.push("STAGING_SSH_USER must be a plain user name");
  if (value("STAGING_SSH_HOST") && /anasalharazeen/i.test(value("STAGING_SSH_HOST"))) warnings.push("the SSH host looks like a production domain name: on a shared plan isolation then rests entirely on paths and credentials");

  // 7. The revision: a staging or integration branch, or an exact commit; never a production branch.
  const ref = value("STAGING_REF");
  if (ref && (PRODUCTION_BRANCHES.has(ref) || !REF_OK.test(ref) || ref.includes("..") || ref.includes("//"))) problems.push("STAGING_REF must be a staging/* or integration/* branch, or a full commit hash; never a production branch");

  // 8. The build switches: the staging API, Mobile on, no release approval, no production flag leaking in.
  if (value("VITE_API_BASE_URL") && value("VITE_API_BASE_URL") !== value("STAGING_API_BASE_URL")) problems.push("VITE_API_BASE_URL must equal STAGING_API_BASE_URL");
  if (value("VITE_MOBILE_ENABLED") !== "true") problems.push("VITE_MOBILE_ENABLED must be exactly \"true\" in a staging build");
  if (value("SMARTSPEND_MOBILE_RELEASE_APPROVED")) problems.push("SMARTSPEND_MOBILE_RELEASE_APPROVED must not be set: a release approval belongs to production, never to staging");
  if (value("VITE_MOBILE_PWA") && !["true", "false"].includes(value("VITE_MOBILE_PWA"))) problems.push("VITE_MOBILE_PWA must be true or false");

  return { ok: problems.length === 0, problems, warnings };
}

/* ---------- The build output ---------- */

/** @param {{ files: Record<string, string> }} build file path -> text (only text files are read) */
export function checkBuildOutput(build, { apiBase }) {
  const problems = [];
  const files = Object.entries(build.files);
  if (!files.some(([name]) => name === "index.html")) problems.push("dist/index.html is missing");
  if (!files.some(([, text]) => text.includes(apiBase))) problems.push("the staging API URL is not in the build");
  // The only tolerated production reference is the canonical link of the shared public pages (privacy.html, terms.html): it names the
  // public site, not a place data goes. Everything else, and the production API host above all, is refused.
  const withoutCanonical = (name, text) => (name.endsWith(".html") ? text.replace(/<link\s+rel="canonical"[^>]*>/gi, "") : text);
  for (const host of PRODUCTION.hosts) {
    const tolerated = host === new URL(PRODUCTION.webOrigin).hostname;
    const hit = files.find(([name, text]) => (tolerated ? withoutCanonical(name, text) : text).includes(host));
    if (hit) problems.push(`the production host ${host} appears in the build (${hit[0]})`);
  }
  if (!files.some(([name]) => /(^|\/)assets\/MobileApp[^/]*\.js$/.test(name) || /(^|\/)assets\/[^/]*Mobile[^/]*\.js$/.test(name))) problems.push("no Mobile chunk in the build: Mobile is not enabled");
  return { ok: problems.length === 0, problems };
}

/* ---------- The workflow file ---------- */

/** What the staging workflow must and must not contain. Plain text checks on purpose: a reviewer can read every rule. */
export function checkStagingWorkflow(text) {
  const problems = [];
  const on = text.match(/^on:\n((?:[ ]{2}.*\n|\n)+)/m)?.[1] ?? "";
  const triggers = [...on.matchAll(/^ {2}([a-z_]+):/gm)].map((match) => match[1]);
  if (triggers.length !== 1 || triggers[0] !== "workflow_dispatch") problems.push(`the only trigger must be workflow_dispatch (found: ${triggers.join(", ") || "none"})`);
  if (!/^ {4}environment: staging$/m.test(text)) problems.push("the deploy job must run in the GitHub environment \"staging\"");
  if (!/^permissions:\n {2}contents: read$/m.test(text)) problems.push("permissions must be contents: read");
  if (!/^ {2}group: smartspend-frontend-staging$/m.test(text)) problems.push("concurrency must use its own group, smartspend-frontend-staging");

  const secrets = [...text.matchAll(/secrets\.([A-Za-z0-9_]+)/g)].map((match) => match[1]);
  const vars = [...text.matchAll(/\bvars\.([A-Za-z0-9_]+)/g)].map((match) => match[1]);
  for (const name of new Set(secrets)) if (!STAGING_SECRETS.includes(name)) problems.push(`reads a secret that is not a staging secret: ${name}`);
  for (const name of new Set(vars)) if (!STAGING_VARS.includes(name)) problems.push(`reads a variable that is not a staging variable: ${name}`);
  // The build switches are named like the production repository variables (VITE_API_BASE_URL), but they may only be fed from staging values (checked above).
  if (/HOSTINGER/i.test(text)) problems.push("mentions a production (HOSTINGER_*) secret name")

  // No fallback to anything: an expression that reads a secret or variable and has an "||" is a silent fallback.
  for (const expression of text.matchAll(/\$\{\{([^}]*)\}\}/g)) if (/(?:secrets|vars)\./.test(expression[1]) && /\|\|/.test(expression[1])) problems.push(`a fallback expression: ${expression[0].trim()}`);

  // Nothing about production may be written into the file: no addresses, users, paths or domains.
  if (/\b\d{1,3}(?:\.\d{1,3}){3}\b/.test(text)) problems.push("contains an IP address");
  if (/\bu\d{6,}\b/.test(text)) problems.push("contains a hosting user name");
  if (/\/home\//.test(text)) problems.push("contains a /home/ path");
  if (/anasalharazeen/i.test(text)) problems.push("contains a production domain");
  if (/deploy\/smartspend/.test(text)) problems.push("names a production deploy path");
  if (/deploy-hostinger/.test(text)) problems.push("refers to the production workflow");
  if (/refs\/heads\/(?:development|develop|main)\b/.test(text)) problems.push("refers to a production branch");

  // How it builds and deploys.
  if (!/npm run build -- --mode staging/.test(text)) problems.push("must build with --mode staging");
  if (!/^ {6}VITE_MOBILE_ENABLED: "true"$/m.test(text)) problems.push("must build with VITE_MOBILE_ENABLED: \"true\"");
  if (/SMARTSPEND_MOBILE_RELEASE_APPROVED\s*:/.test(text)) problems.push("must not set SMARTSPEND_MOBILE_RELEASE_APPROVED");
  if (!/node scripts\/stagingIsolation\.mjs preflight/.test(text)) problems.push("must run the isolation preflight");
  if (!/node scripts\/stagingIsolation\.mjs build dist/.test(text)) problems.push("must verify the build output");
  if (!/StrictHostKeyChecking=yes/.test(text) || /StrictHostKeyChecking=no/.test(text)) problems.push("SSH must use StrictHostKeyChecking=yes");
  if (!/\$STAGING_REMOTE_BASE\/deploy\.sh/.test(text)) problems.push("must run the staging server's own deploy script");
  const preflightAt = text.indexOf("stagingIsolation.mjs preflight");
  const sshAt = text.search(/ssh |rsync /);
  if (preflightAt === -1 || (sshAt !== -1 && sshAt < preflightAt)) problems.push("the preflight must run before any SSH or upload");
  return { ok: problems.length === 0, problems };
}

/* ---------- Templates must hold no secret ---------- */

const SECRETISH = [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, /\bsk-[A-Za-z0-9_-]{16,}/, /\bghp_[A-Za-z0-9]{20,}/, /\bAKIA[0-9A-Z]{16}\b/, /\bbase64:[A-Za-z0-9+/=]{20,}/, /\b(?:password|secret|token|key)\s*=\s*[^\s<\[$"'][^\s]{7,}/i];
export function checkTemplateHoldsNoSecret(text) {
  return { ok: !SECRETISH.some((pattern) => pattern.test(text)), problems: SECRETISH.filter((pattern) => pattern.test(text)).map((pattern) => `looks like a secret: ${pattern}`) };
}

export const sha256Lf = (text) => createHash("sha256").update(text.replace(/\r\n/g, "\n")).digest("hex");

/* ---------- The three CLI commands ---------- */

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));

function readTextTree(dir, base = dir, out = {}) {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) readTextTree(full, base, out);
    else if (/\.(?:html|js|css|json|txt|webmanifest|svg|map)$/i.test(name)) out[full.slice(base.length + 1).replace(/\\/g, "/")] = readFileSync(full, "utf8");
  }
  return out;
}

function report(title, result) {
  for (const problem of result.problems) console.error(`  FAIL  ${problem}`);
  for (const warning of result.warnings ?? []) console.warn(`  WARN  ${warning}`);
  console.log(`${title}: ${result.ok ? "OK" : "FAILED"}`);
  return result.ok;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const [command, arg] = process.argv.slice(2);
  let ok = false;
  if (command === "preflight") {
    ok = report("STAGING_PREFLIGHT", checkStagingConfig(process.env));
  } else if (command === "build") {
    const dist = resolve(arg ?? "dist");
    ok = existsSync(dist) ? report("STAGING_BUILD", checkBuildOutput({ files: readTextTree(dist) }, { apiBase: process.env.STAGING_API_BASE_URL ?? "" })) : (console.error("  FAIL  the build directory does not exist"), false);
  } else if (command === "verify") {
    const workflow = report("STAGING_WORKFLOW", checkStagingWorkflow(readFileSync(join(root, ".github/workflows/deploy-staging.yml"), "utf8").replace(/\r\n/g, "\n")));
    const production = readFileSync(join(root, PRODUCTION.workflow), "utf8");
    const unchanged = sha256Lf(production) === PRODUCTION.workflowSha256;
    if (!unchanged) console.error("  FAIL  the production workflow has changed");
    console.log(`PRODUCTION_WORKFLOW_UNCHANGED: ${unchanged ? "OK" : "FAILED"}`);
    ok = workflow && unchanged;
  } else {
    console.error("usage: stagingIsolation.mjs preflight | build <dir> | verify");
  }
  process.exit(ok ? 0 : 1);
}
