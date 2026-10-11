import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  ALLOW_REMOTE_FLAG,
  DEFAULT_DEV_API_ORIGIN,
  DevApiConfigError,
  ORIGIN_VARIABLE,
  isLoopbackHostname,
  resolveDevApiTarget,
} from "../scripts/devApiTarget.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STAGING = "https://smartspend-backend-staging-vjthdp.laravel.cloud";
const serve = (env = {}) => resolveDevApiTarget({ command: "serve", env });

describe("fail-closed local API target", () => {
  it("routes a session with no configuration to the local Laravel", () => {
    const target = serve({});
    assert.equal(target.origin, DEFAULT_DEV_API_ORIGIN);
    assert.equal(target.origin, "http://127.0.0.1:8000");
    assert.equal(target.remote, false);
    assert.equal(target.source, "default-localhost");
  });

  it("treats blank values as 'not configured', not as an error or a remote", () => {
    const target = serve({ [ORIGIN_VARIABLE]: "  ", VITE_API_BASE_URL: "" });
    assert.equal(target.origin, DEFAULT_DEV_API_ORIGIN);
  });

  it("accepts a local origin on another port without any extra flag", () => {
    assert.equal(serve({ [ORIGIN_VARIABLE]: "http://localhost:8123" }).origin, "http://localhost:8123");
    assert.equal(serve({ [ORIGIN_VARIABLE]: "http://127.0.0.2:9000" }).remote, false);
  });

  it("refuses the staging origin unless remote use is confirmed", () => {
    assert.throws(
      () => serve({ [ORIGIN_VARIABLE]: STAGING }),
      (error) => error instanceof DevApiConfigError
        && error.message.includes(ALLOW_REMOTE_FLAG)
        && error.message.includes("laravel.cloud"),
    );
  });

  it("requires the confirmation to be exactly 'true'", () => {
    for (const value of ["1", "yes", "TRUE", "on", ""]) {
      assert.throws(
        () => serve({ [ORIGIN_VARIABLE]: STAGING, [ALLOW_REMOTE_FLAG]: value }),
        DevApiConfigError,
        `"${value}" must not count as confirmation`,
      );
    }
  });

  it("uses a remote origin only when it is named AND confirmed", () => {
    const target = serve({ [ORIGIN_VARIABLE]: STAGING, [ALLOW_REMOTE_FLAG]: "true" });
    assert.equal(target.origin, STAGING);
    assert.equal(target.remote, true);
    assert.equal(target.source, ORIGIN_VARIABLE);
  });

  it("confirming remote use alone does not invent a remote target", () => {
    assert.equal(serve({ [ALLOW_REMOTE_FLAG]: "true" }).origin, DEFAULT_DEV_API_ORIGIN);
  });

  it("refuses an absolute remote VITE_API_BASE_URL, which would bypass the proxy", () => {
    assert.throws(
      () => serve({ VITE_API_BASE_URL: `${STAGING}/api` }),
      (error) => error instanceof DevApiConfigError && error.message.includes("VITE_API_BASE_URL"),
    );
    assert.equal(serve({ VITE_API_BASE_URL: `${STAGING}/api`, [ALLOW_REMOTE_FLAG]: "true" }).origin, DEFAULT_DEV_API_ORIGIN);
  });

  it("accepts the relative and loopback base URLs", () => {
    assert.doesNotThrow(() => serve({ VITE_API_BASE_URL: "/api" }));
    assert.doesNotThrow(() => serve({ VITE_API_BASE_URL: "http://localhost:8000/api" }));
    assert.doesNotThrow(() => serve({ VITE_API_BASE_URL: "http://127.0.0.1:8000/api" }));
  });

  it("rejects malformed targets with a readable error instead of guessing", () => {
    for (const bad of ["not a url", "ftp://127.0.0.1", "127.0.0.1:8000", "//evil.example"]) {
      assert.throws(() => serve({ [ORIGIN_VARIABLE]: bad }), DevApiConfigError, bad);
    }
    assert.throws(() => serve({ VITE_API_BASE_URL: "api" }), DevApiConfigError);
  });

  it("does not look like loopback when only the name resembles it", () => {
    assert.equal(isLoopbackHostname("localhost.evil.example"), false);
    assert.equal(isLoopbackHostname("127.0.0.1.evil.example"), false);
    assert.equal(isLoopbackHostname("evil-localhost"), false);
  });

  it("leaves production builds alone", () => {
    const env = { VITE_API_BASE_URL: "https://smartspend-api.anasalharazeen.com/api" };
    assert.deepEqual(resolveDevApiTarget({ command: "build", env }), {
      origin: null, remote: false, source: "not-a-dev-server",
    });
  });
});

describe("tracked configuration never names a real server", () => {
  const read = (file) => readFileSync(path.join(ROOT, file), "utf8");
  const values = (file) => read(file).split(/\r?\n/)
    .filter((line) => line.trim() && !line.trim().startsWith("#"));
  const REMOTE = /https?:\/\/(?!127\.0\.0\.1|localhost|\[::1\])/i;

  it(".env and .env.example have no remote URL in any value", () => {
    for (const file of [".env", ".env.example"]) {
      for (const line of values(file)) {
        assert.doesNotMatch(line, REMOTE, `${file}: ${line.split("=")[0]}`);
      }
    }
  });

  it(".env keeps the API base relative", () => {
    assert.match(read(".env"), /^VITE_API_BASE_URL=\/api\s*$/m);
  });

  it("vite.config.js hard-codes no real host", () => {
    const source = read("vite.config.js");
    assert.doesNotMatch(source, /laravel\.cloud|anasalharazeen|vercel\.app/i);
  });

  it("the deploy workflow still supplies and validates the production API URL", () => {
    const workflow = read(".github/workflows/deploy-hostinger.yml");
    assert.match(workflow, /VITE_API_BASE_URL: \$\{\{ vars\.VITE_API_BASE_URL \}\}/);
    assert.match(workflow, /https:\/\/smartspend-api\.anasalharazeen\.com\/api/);
  });
});

describe("the real Vite configuration", () => {
  // Resolve vite.config.js itself, from an empty working directory so a
  // developer's private .env.local cannot influence the result.
  async function resolveProxy(envOverrides, command = "serve") {
    const { resolveConfig } = await import("vite");
    const scratch = mkdtempSync(path.join(tmpdir(), "smartspend-vite-"));
    const keys = ["SMARTSPEND_DEV_API_ORIGIN", "SMARTSPEND_ALLOW_REMOTE_API", "VITE_API_BASE_URL"];
    const saved = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
    const cwd = process.cwd();
    const quiet = console.info;
    try {
      for (const key of keys) delete process.env[key];
      Object.assign(process.env, envOverrides);
      process.chdir(scratch);
      console.info = () => {};
      const config = await resolveConfig(
        { root: ROOT, configFile: path.join(ROOT, "vite.config.js"), logLevel: "silent" },
        command,
        command === "serve" ? "development" : "production",
      );
      return config.server.proxy ?? {};
    } finally {
      console.info = quiet;
      process.chdir(cwd);
      for (const key of keys) {
        if (saved[key] === undefined) delete process.env[key]; else process.env[key] = saved[key];
      }
      try {
        rmSync(scratch, { recursive: true, force: true, maxRetries: 5 });
      } catch {
        // Best effort: an empty temp directory is not worth failing the test over.
      }
    }
  }

  it("proxies a default dev session to localhost, never to staging", async () => {
    const proxy = await resolveProxy({});
    assert.equal(proxy["/api"].target, "http://127.0.0.1:8000");
    assert.doesNotMatch(JSON.stringify(proxy), /laravel\.cloud|anasalharazeen/);
  });

  it("refuses to start a dev session aimed at staging without confirmation", async () => {
    await assert.rejects(
      resolveProxy({ SMARTSPEND_DEV_API_ORIGIN: STAGING }),
      /SMARTSPEND_ALLOW_REMOTE_API/,
    );
  });

  it("honours an explicit, confirmed remote target", async () => {
    const proxy = await resolveProxy({ SMARTSPEND_DEV_API_ORIGIN: STAGING, SMARTSPEND_ALLOW_REMOTE_API: "true" });
    assert.equal(proxy["/api"].target, STAGING);
  });

  it("configures no proxy at all for a production build", async () => {
    const proxy = await resolveProxy({ VITE_API_BASE_URL: "https://smartspend-api.anasalharazeen.com/api" }, "build");
    assert.deepEqual(proxy, {});
  });
});
