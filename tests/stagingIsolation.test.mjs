import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import { PRODUCTION, STAGING_SECRETS, STAGING_VARS, checkBuildOutput, checkStagingConfig, checkStagingWorkflow, checkTemplateHoldsNoSecret, sha256Lf } from "../scripts/stagingIsolation.mjs";

/*
 * Staging isolation (Phase 2G.1). The workflow, the preflight and these tests share one set of rules (scripts/stagingIsolation.mjs). They check
 * what this repository can check: the files, the configuration shapes, the build output and the server script's refusals. They cannot see
 * GitHub's settings or the host, and a passing run does not mean staging exists or is isolated: docs/mobile/STAGING-INFRASTRUCTURE.md lists
 * what must still be provisioned and verified by hand.
 */

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const read = (path) => readFileSync(join(ROOT, path), "utf8").replace(/\r\n/g, "\n"); // the same on an LF or a CRLF checkout
const workflow = read(".github/workflows/deploy-staging.yml");
const production = read(PRODUCTION.workflow);

const GOOD = Object.freeze({
  STAGING_REF: "integration/mobile",
  STAGING_API_BASE_URL: "https://smartspend-api-staging.example.org/api",
  STAGING_WEB_ORIGIN: "https://smartspend-staging.example.org",
  STAGING_REMOTE_BASE: "/home/deployer/deploy/smartspend-web-staging",
  STAGING_SSH_KEY: "-----BEGIN OPENSSH PRIVATE KEY-----\nAAAAfakefakefake\n-----END OPENSSH PRIVATE KEY-----",
  STAGING_KNOWN_HOSTS: "host.example.org ssh-ed25519 AAAAfake",
  STAGING_SSH_HOST: "host.example.org",
  STAGING_SSH_USER: "deployer",
  STAGING_SSH_PORT: "22",
  VITE_API_BASE_URL: "https://smartspend-api-staging.example.org/api",
  VITE_MOBILE_ENABLED: "true",
});
const withEnv = (over) => ({ ...GOOD, ...over });

describe("the production workflow", () => {
  it("is unchanged by this phase: its pinned hash, its shape, and no staging name in it", () => {
    assert.equal(sha256Lf(production), PRODUCTION.workflowSha256, "deploy-hostinger.yml changed. If that is deliberate, update the pinned hash in scripts/stagingIsolation.mjs in the same reviewed change.");
    assert.match(production, /^ {6}VITE_MOBILE_ENABLED: "false"$/m, "production still pins Mobile off");
    assert.doesNotMatch(production, /STAGING_|staging/i, "production knows nothing about staging");
    assert.match(production, /^on:\n {2}push:\n {4}branches:\n {6}- development\n {2}workflow_dispatch:/m);
  });

  it("is what the isolation constants say it is (so a rename there cannot silently weaken a check)", () => {
    assert.ok(production.includes(PRODUCTION.apiBase));
    for (const root of PRODUCTION.deployRoots) assert.ok(production.includes(root), root);
    for (const name of PRODUCTION.secretNames) assert.ok(production.includes(`secrets.${name}`), name);
    for (const name of PRODUCTION.varNames) assert.ok(production.includes(`vars.${name}`), name);
    for (const host of PRODUCTION.hosts) assert.ok(PRODUCTION.apiOrigin.includes(host) || PRODUCTION.webOrigin.includes(host), host);
  });
});

describe("the staging workflow", () => {
  it("passes every structural rule", () => {
    assert.deepEqual(checkStagingWorkflow(workflow), { ok: true, problems: [] });
  });

  it("reads only STAGING_* secrets and variables, and every one of them is used", () => {
    const secrets = new Set([...workflow.matchAll(/secrets\.([A-Za-z0-9_]+)/g)].map((match) => match[1]));
    const vars = new Set([...workflow.matchAll(/\bvars\.([A-Za-z0-9_]+)/g)].map((match) => match[1]));
    assert.deepEqual([...secrets].sort(), [...STAGING_SECRETS].sort());
    assert.deepEqual([...vars].sort(), [...STAGING_VARS].sort());
    assert.ok([...secrets, ...vars].every((name) => name.startsWith("STAGING_")));
  });

  it("is manual, in the staging environment, and builds Mobile in staging mode without a release approval", () => {
    assert.match(workflow, /^on:\n {2}workflow_dispatch:/m);
    assert.doesNotMatch(workflow, /^ {2}(push|pull_request|schedule|workflow_run|repository_dispatch):/m);
    assert.match(workflow, /^ {4}environment: staging$/m);
    assert.match(workflow, /npm run build -- --mode staging/);
    assert.match(workflow, /VITE_MOBILE_ENABLED: "true"/);
    assert.doesNotMatch(workflow, /SMARTSPEND_MOBILE_RELEASE_APPROVED\s*:/);
    // It mirrors production's build configuration where staging should: Smart Savings on. It never turns the PWA on by default.
    assert.match(workflow, /VITE_SMART_SAVINGS_ENABLED: "true"/);
    assert.match(workflow, /default: false\n {8}type: boolean/);
  });

  it("each way of weakening it is caught", () => {
    const mutations = {
      "a push trigger": workflow.replace("on:\n  workflow_dispatch:", "on:\n  push:\n    branches:\n      - development\n  workflow_dispatch:"),
      "no staging environment": workflow.replace("    environment: staging\n", ""),
      "a production secret": workflow.replace("secrets.STAGING_SSH_KEY", "secrets.HOSTINGER_SSH_KEY"),
      "a fallback to a production secret": workflow.replace("${{ secrets.STAGING_SSH_KEY }}", "${{ secrets.STAGING_SSH_KEY || secrets.HOSTINGER_SSH_KEY }}"),
      "a fallback to a variable": workflow.replace("${{ vars.STAGING_API_BASE_URL }}", "${{ vars.STAGING_API_BASE_URL || vars.VITE_API_BASE_URL }}"),
      "a production variable": workflow.replace("vars.STAGING_REMOTE_BASE", "vars.VITE_API_BASE_URL"),
      "a hard-coded host address": workflow.replace('"$STAGING_SSH_USER@$STAGING_SSH_HOST" \\\n            \'echo STAGING_SSH=OK\'', '"user@10.1.2.3" \\\n            \'echo STAGING_SSH=OK\''),
      "a hard-coded production path": workflow.replace("$STAGING_REMOTE_BASE/deploy.sh", "/home/someone/deploy/smartspend-web/deploy.sh"),
      "a production domain": workflow.replace("# Staging only.", "# Staging only: https://smartspend.anasalharazeen.com"),
      "no preflight": workflow.replace("node scripts/stagingIsolation.mjs preflight", "echo skipped"),
      "no build verification": workflow.replace("node scripts/stagingIsolation.mjs build dist", "echo skipped"),
      "a production-mode build": workflow.replace("npm run build -- --mode staging", "npm run build"),
      "a release approval": workflow.replace('VITE_MOBILE_ENABLED: "true"', 'VITE_MOBILE_ENABLED: "true"\n      SMARTSPEND_MOBILE_RELEASE_APPROVED: "true"'),
      "unverified host keys": workflow.replace(/StrictHostKeyChecking=yes/g, "StrictHostKeyChecking=no"),
      "a production branch": workflow.replace("          ref: ${{ inputs.ref }}", "          ref: refs/heads/development"),
      "the production workflow's name": workflow.replace("# Staging only.", "# Staging only. Copied from deploy-hostinger.yml."),
      "contents write": workflow.replace("contents: read", "contents: write"),
      "a shared concurrency group": workflow.replace("group: smartspend-frontend-staging", "group: smartspend-frontend-production"),
    };
    for (const [name, text] of Object.entries(mutations)) {
      assert.notEqual(text, workflow, `the mutation "${name}" did not change the file`);
      assert.equal(checkStagingWorkflow(text).ok, false, name);
    }
  });

  it("validates the requested revision before it checks anything out, and the preflight comes before any SSH or upload", () => {
    assert.ok(workflow.indexOf("Check the requested revision") < workflow.indexOf("actions/checkout"));
    assert.ok(workflow.indexOf("stagingIsolation.mjs preflight") < workflow.search(/\bssh \\|\brsync \\/));
    for (const branch of ["development", "develop", "main", "master", "production", "release"]) assert.match(workflow, new RegExp(branch));
  });
});

describe("the configuration preflight (fails closed, never prints a value)", () => {
  it("accepts a complete staging configuration", () => {
    const result = checkStagingConfig(GOOD);
    assert.deepEqual(result.problems, []);
    assert.equal(result.ok, true);
  });

  it("refuses every missing item, naming it and nothing else", () => {
    for (const name of [...STAGING_SECRETS, "STAGING_API_BASE_URL", "STAGING_WEB_ORIGIN", "STAGING_REMOTE_BASE", "STAGING_REF"]) {
      const env = { ...GOOD };
      delete env[name];
      const result = checkStagingConfig(env);
      assert.equal(result.ok, false, name);
      assert.ok(result.problems.some((problem) => problem.includes(name)), name);
    }
    assert.equal(checkStagingConfig({}).ok, false, "an empty environment is refused, not defaulted");
    assert.equal(checkStagingConfig(withEnv({ STAGING_SSH_HOST: "   " })).ok, false, "blank is missing");
  });

  it("refuses production URLs, plain http, non-staging hosts and malformed values", () => {
    const bad = {
      "the production API": withEnv({ STAGING_API_BASE_URL: PRODUCTION.apiBase, VITE_API_BASE_URL: PRODUCTION.apiBase }),
      "the production web origin": withEnv({ STAGING_WEB_ORIGIN: PRODUCTION.webOrigin }),
      "http": withEnv({ STAGING_API_BASE_URL: "http://smartspend-api-staging.example.org/api", VITE_API_BASE_URL: "http://smartspend-api-staging.example.org/api" }),
      "a host without staging": withEnv({ STAGING_API_BASE_URL: "https://api.example.org/api", VITE_API_BASE_URL: "https://api.example.org/api" }),
      "an API path that is not /api": withEnv({ STAGING_API_BASE_URL: "https://smartspend-api-staging.example.org/v2", VITE_API_BASE_URL: "https://smartspend-api-staging.example.org/v2" }),
      "credentials in the URL": withEnv({ STAGING_API_BASE_URL: "https://u:p@smartspend-api-staging.example.org/api", VITE_API_BASE_URL: "https://u:p@smartspend-api-staging.example.org/api" }),
      "a web origin with a path": withEnv({ STAGING_WEB_ORIGIN: "https://smartspend-staging.example.org/app" }),
      "the same host for API and web": withEnv({ STAGING_WEB_ORIGIN: "https://smartspend-api-staging.example.org" }),
      "a build pointing elsewhere": withEnv({ VITE_API_BASE_URL: "/api" }),
      "a bad SSH port": withEnv({ STAGING_SSH_PORT: "99999" }),
      "an SSH key that is not a key": withEnv({ STAGING_SSH_KEY: "not a key" }),
      "an SSH host with a space": withEnv({ STAGING_SSH_HOST: "a b" }),
    };
    for (const [name, env] of Object.entries(bad)) assert.equal(checkStagingConfig(env).ok, false, name);
  });

  it("refuses a remote base that could reach production's directories", () => {
    for (const base of [...PRODUCTION.deployRoots, `${PRODUCTION.deployRoots[0]}/incoming`, "/home/u316277277/deploy", "/home/u316277277", "/", "relative/staging", "/home/x/../u316277277/deploy/smartspend-staging", "/home/deployer//staging", "/home/dep loyer/staging", "/home/deployer/deploy/smartspend-web", "/home/deployer/./staging"]) {
      assert.equal(checkStagingConfig(withEnv({ STAGING_REMOTE_BASE: base })).ok, false, base);
    }
    // Segment-aware: "smartspend-web-staging" is not inside "smartspend-web", but "smartspend-web/staging" is.
    assert.equal(checkStagingConfig(withEnv({ STAGING_REMOTE_BASE: `${PRODUCTION.deployRoots[0]}-staging` })).ok, true);
    assert.equal(checkStagingConfig(withEnv({ STAGING_REMOTE_BASE: `${PRODUCTION.deployRoots[0]}/staging` })).ok, false);
  });

  it("refuses a production branch or an unnamed revision", () => {
    for (const ref of ["development", "develop", "main", "master", "production", "release", "feature/x", "refs/heads/development", "abc123", "integration/../development"]) assert.equal(checkStagingConfig(withEnv({ STAGING_REF: ref })).ok, false, ref);
    for (const ref of ["integration/mobile", "staging/mobile-pilot-notifications", "a".repeat(40)]) assert.equal(checkStagingConfig(withEnv({ STAGING_REF: ref })).ok, true, ref);
  });

  it("refuses any production-named variable in the job: no silent fallback is possible", () => {
    for (const name of ["HOSTINGER_SSH_KEY", "HOSTINGER_KNOWN_HOSTS", "HOSTINGER_ANYTHING"]) assert.equal(checkStagingConfig(withEnv({ [name]: "x" })).ok, false, name);
  });

  it("requires Mobile on, and refuses a release approval or an invalid PWA switch", () => {
    assert.equal(checkStagingConfig(withEnv({ VITE_MOBILE_ENABLED: "TRUE" })).ok, false);
    assert.equal(checkStagingConfig(withEnv({ VITE_MOBILE_ENABLED: undefined })).ok, false);
    assert.equal(checkStagingConfig(withEnv({ SMARTSPEND_MOBILE_RELEASE_APPROVED: "true" })).ok, false);
    assert.equal(checkStagingConfig(withEnv({ VITE_MOBILE_PWA: "yes" })).ok, false);
    assert.equal(checkStagingConfig(withEnv({ VITE_MOBILE_PWA: "true" })).ok, true);
  });

  it("never echoes a secret value in its answer", () => {
    const result = checkStagingConfig(withEnv({ STAGING_SSH_KEY: "-----BEGIN OPENSSH PRIVATE KEY-----\nSECRETBODYSECRETBODY", STAGING_SSH_PORT: "SECRETPORT", STAGING_SSH_USER: "SECRET USER", STAGING_REF: "SECRETREF" }));
    assert.equal(result.ok, false);
    assert.doesNotMatch(JSON.stringify(result), /SECRETBODY|SECRETPORT|SECRET USER|SECRETREF/);
  });

  it("warns, without failing, when the SSH host looks like a production domain (shared plan)", () => {
    const result = checkStagingConfig(withEnv({ STAGING_SSH_HOST: "ssh.anasalharazeen.com" }));
    assert.equal(result.ok, true);
    assert.ok(result.warnings.length > 0);
  });
});

describe("the build output", () => {
  const build = (extra = {}) => ({ files: { "index.html": "<html></html>", "assets/MobileApp-abc.js": "x", "assets/index-abc.js": `fetch("${GOOD.STAGING_API_BASE_URL}")`, ...extra } });

  it("accepts a staging build and refuses one that carries a production host, lacks the staging URL, or has no Mobile", () => {
    assert.equal(checkBuildOutput(build(), { apiBase: GOOD.STAGING_API_BASE_URL }).ok, true);
    assert.equal(checkBuildOutput(build({ "assets/other.js": `x("${PRODUCTION.apiBase}")` }), { apiBase: GOOD.STAGING_API_BASE_URL }).ok, false);
    assert.equal(checkBuildOutput(build({ "assets/other.js": "https://smartspend.anasalharazeen.com/x" }), { apiBase: GOOD.STAGING_API_BASE_URL }).ok, false);
    assert.equal(checkBuildOutput({ files: { "index.html": "x", "assets/MobileApp-abc.js": "x" } }, { apiBase: GOOD.STAGING_API_BASE_URL }).ok, false);
    assert.equal(checkBuildOutput({ files: { "index.html": "x", "assets/index.js": `"${GOOD.STAGING_API_BASE_URL}"` } }, { apiBase: GOOD.STAGING_API_BASE_URL }).ok, false);
    assert.equal(checkBuildOutput({ files: { "assets/MobileApp-abc.js": GOOD.STAGING_API_BASE_URL } }, { apiBase: GOOD.STAGING_API_BASE_URL }).ok, false);
  });

  it("tolerates the production site only as the canonical link of a public page, never the API host and never in code", () => {
    const canonical = `<link rel="canonical" href="${PRODUCTION.webOrigin}/privacy.html" />`;
    assert.equal(checkBuildOutput(build({ "privacy.html": `<html>${canonical}</html>` }), { apiBase: GOOD.STAGING_API_BASE_URL }).ok, true);
    assert.equal(checkBuildOutput(build({ "privacy.html": `<html>${canonical}<a href="${PRODUCTION.webOrigin}">x</a></html>` }), { apiBase: GOOD.STAGING_API_BASE_URL }).ok, false);
    assert.equal(checkBuildOutput(build({ "privacy.html": `<link rel="canonical" href="${PRODUCTION.apiOrigin}/x" />` }), { apiBase: GOOD.STAGING_API_BASE_URL }).ok, false);
    assert.equal(checkBuildOutput(build({ "assets/x.js": canonical }), { apiBase: GOOD.STAGING_API_BASE_URL }).ok, false);
  });

  it("a real `vite build --mode staging` with Mobile on carries the staging API and no production host", { timeout: 180_000 }, () => {
    const out = mkdtempSync(join(tmpdir(), "smartspend-staging-build-"));
    try {
      const env = { ...process.env, VITE_API_BASE_URL: GOOD.STAGING_API_BASE_URL, VITE_MOBILE_ENABLED: "true", VITE_SMART_SAVINGS_ENABLED: "true", VITE_GOOGLE_CLIENT_ID: "" };
      delete env.SMARTSPEND_MOBILE_RELEASE_APPROVED;
      delete env.VITE_MOBILE_PWA;
      const run = spawnSync(process.execPath, [join(ROOT, "node_modules/vite/bin/vite.js"), "build", "--mode", "staging", "--outDir", out, "--emptyOutDir"], { cwd: ROOT, env, encoding: "utf8" });
      assert.equal(run.status, 0, run.stderr || run.stdout);
      const files = {};
      const walk = (dir, base = dir) => {
        for (const entry of readdirSync(dir, { withFileTypes: true })) {
          const full = join(dir, entry.name);
          if (entry.isDirectory()) walk(full, base);
          else if (/\.(html|js|css|json|webmanifest)$/.test(entry.name)) files[full.slice(base.length + 1).replace(/\\/g, "/")] = readFileSync(full, "utf8");
        }
      };
      walk(out);
      assert.deepEqual(checkBuildOutput({ files }, { apiBase: GOOD.STAGING_API_BASE_URL }).problems, []);
      assert.ok(!existsSync(join(out, "smartspend-mobile-sw.js")), "no Mobile worker unless the PWA is asked for");
      assert.ok(!existsSync(join(out, "manifest.webmanifest")), "no manifest unless the PWA is asked for");
    } finally {
      rmSync(out, { recursive: true, force: true });
    }
  });
});

describe("the templates and the repository's own files", () => {
  it("hold no secret", () => {
    for (const file of ["deploy/staging/frontend/deploy.sh", "deploy/staging/frontend/github-environment.example", ".github/workflows/deploy-staging.yml"]) assert.deepEqual(checkTemplateHoldsNoSecret(read(file)).problems, [], file);
    assert.equal(checkTemplateHoldsNoSecret("OPENAI_API_KEY=sk-abcdefghijklmnopqrstuvwx").ok, false, "the detector detects");
    assert.equal(checkTemplateHoldsNoSecret("password = hunter2hunter2").ok, false);
  });

  it("no committable env file points anywhere but the local proxy, sets the Mobile flag, or names staging", () => {
    for (const file of [".env", ".env.production", ".env.staging", ".env.example"].filter((name) => existsSync(join(ROOT, name)))) {
      // Active lines only: a commented example documents a switch, it does not set it.
      const text = read(file).split(/\r?\n/).filter((line) => !/^\s*#/.test(line)).join("\n");
      assert.doesNotMatch(text, /VITE_MOBILE_ENABLED\s*=/, file);
      assert.doesNotMatch(text, /^\s*[A-Z_]*STAGING[A-Z_]*\s*=|https?:\/\/\S*staging/im, `${file} must not carry staging values`);
      assert.doesNotMatch(text, /VITE_API_BASE_URL\s*=\s*https?:/i, `${file} must not hard-code a remote API`);
    }
    assert.ok(!existsSync(join(ROOT, ".env.staging")), "a committable .env.staging would be read by every staging build; keep staging values in the GitHub environment");
  });

  it("the verify command passes", () => {
    const run = spawnSync(process.execPath, [join(ROOT, "scripts/stagingIsolation.mjs"), "verify"], { cwd: ROOT, encoding: "utf8" });
    assert.equal(run.status, 0, run.stdout + run.stderr);
    assert.match(run.stdout, /PRODUCTION_WORKFLOW_UNCHANGED: OK/);
  });

  it("the preflight command fails closed on an empty environment", () => {
    const run = spawnSync(process.execPath, [join(ROOT, "scripts/stagingIsolation.mjs"), "preflight"], { cwd: ROOT, env: { PATH: process.env.PATH }, encoding: "utf8" });
    assert.equal(run.status, 1);
    assert.match(run.stdout, /STAGING_PREFLIGHT: FAILED/);
  });
});

describe("the server-side deploy script's refusals", () => {
  const bash = spawnSync("bash", ["-c", "echo ok"], { encoding: "utf8" });
  const hasBash = bash.status === 0;
  const REV = "b".repeat(40);

  function setup({ never = true, builds = true, host = false, within = false } = {}) {
    const root = mkdtempSync(join(tmpdir(), "smartspend-stg-"));
    const base = join(root, "deploy", "smartspend-web-staging");
    mkdirSync(join(base, "incoming", REV), { recursive: true });
    writeFileSync(join(base, "deploy.sh"), read("deploy/staging/frontend/deploy.sh"), { mode: 0o700 });
    if (never) {
      // The script resolves paths the POSIX way (pwd -P), so the denylist is written the same way.
      const posix = (path) => spawnSync("bash", ["-c", `cd '${path.replace(/\\/g, "/")}' && pwd -P`], { encoding: "utf8" }).stdout.trim();
      mkdirSync(join(root, "deploy", "smartspend-web"), { recursive: true });
      writeFileSync(join(base, "never-deploy-to.list"), `${within ? posix(base) : posix(join(root, "deploy", "smartspend-web"))}\n`);
      writeFileSync(join(base, "never-in-build.list"), "production.example.org\n");
    }
    if (builds) {
      writeFileSync(join(base, "incoming", REV, "index.html"), host ? "https://production.example.org" : "<html></html>");
      writeFileSync(join(base, "incoming", REV, `deploy-revision-${REV}.txt`), `${REV}\n`);
    }
    return { root, base };
  }
  const run = (base, revision = REV) => spawnSync("bash", [join(base, "deploy.sh").replace(/\\/g, "/"), revision], { encoding: "utf8" });

  it("has valid bash syntax and holds nothing outside its own base directory in its commands", () => {
    const syntax = spawnSync("bash", ["-n", join(ROOT, "deploy/staging/frontend/deploy.sh").replace(/\\/g, "/")], { encoding: "utf8" });
    assert.equal(syntax.status, 0, syntax.stderr);
    assert.doesNotMatch(read("deploy/staging/frontend/deploy.sh"), /\/home\/|anasalharazeen/);
  });

  for (const [name, options, revision, expected] of [
    ["a revision that is not a full hash", {}, "main", /full 40-character/],
    ["a missing production denylist", { never: false }, REV, /never-deploy-to\.list is missing/],
    ["a base that is inside a listed production path", { within: true }, REV, /production path/],
    ["a missing build", { builds: false }, REV, /no index\.html|no incoming build/],
    ["a build that names a production host", { host: true }, REV, /production host/],
  ]) {
    it(`refuses ${name}, before the live link moves`, { skip: !hasBash && "bash is not available" }, () => {
      const { root, base } = setup(options);
      try {
        const result = run(base, revision);
        assert.notEqual(result.status, 0, result.stdout);
        assert.match(result.stderr, /STAGING_DEPLOY_REFUSED/);
        assert.match(result.stderr, expected);
        assert.ok(!existsSync(join(base, "current")), "nothing went live");
      } finally {
        rmSync(root, { recursive: true, force: true });
      }
    });
  }

  it("deploys a clean staging build by moving a link inside its own base (skipped where links cannot be made)", { skip: !hasBash && "bash is not available" }, () => {
    const { root, base } = setup();
    try {
      const probe = spawnSync("bash", ["-c", `cd '${root.replace(/\\/g, "/")}' && ln -s a b && test -L b`], { encoding: "utf8" });
      if (probe.status !== 0) return;
      const result = run(base);
      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, new RegExp(`STAGING_FRONTEND_DEPLOYED=${REV}`));
      assert.ok(existsSync(join(base, "releases", REV, "index.html")));
      assert.ok(existsSync(join(base, "current")));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
