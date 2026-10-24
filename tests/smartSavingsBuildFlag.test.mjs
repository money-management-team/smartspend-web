import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  APPROVAL,
  FLAG,
  SmartSavingsBuildError,
  committableEnvFiles,
  readCommittableEnvFiles,
  resolveSmartSavingsBuild,
} from "../scripts/smartSavingsBuildFlag.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const resolve = ({ command = "build", mode = "production", env = {}, processEnv = {}, committableFiles = {} } = {}) =>
  resolveSmartSavingsBuild({ command, mode, env, processEnv, committableFiles });

describe("Smart Savings build flag", () => {
  it("is off when nothing sets it, in every command and mode", () => {
    assert.deepEqual(resolve(), { enabled: false, approved: false });
    assert.deepEqual(resolve({ command: "serve", mode: "development" }), { enabled: false, approved: false });
    assert.equal(resolve({ env: { [FLAG]: "false" } }).enabled, false);
  });

  it("refuses a production build that would ship it without approval", () => {
    assert.throws(
      () => resolve({ env: { [FLAG]: "true" } }),
      (error) => error instanceof SmartSavingsBuildError && error.message.includes(APPROVAL),
    );
  });

  it("does not accept approval from an env file, only from the build environment", () => {
    // `env` is process.env merged over the .env files; approval found only there came from a file.
    assert.throws(() => resolve({ env: { [FLAG]: "true", [APPROVAL]: "true" } }), SmartSavingsBuildError);
    assert.deepEqual(
      resolve({ env: { [FLAG]: "true" }, processEnv: { [APPROVAL]: "true" } }),
      { enabled: true, approved: true },
    );
  });

  it("requires the approval to be exactly 'true'", () => {
    for (const value of ["1", "yes", "TRUE", "on", ""]) {
      assert.throws(
        () => resolve({ env: { [FLAG]: "true" }, processEnv: { [APPROVAL]: value } }),
        SmartSavingsBuildError,
        `"${value}" must not count as approval`,
      );
    }
  });

  it("keeps local development with the feature on working without approval", () => {
    assert.deepEqual(resolve({ command: "serve", mode: "development", env: { [FLAG]: "true" } }), { enabled: true, approved: false });
    assert.equal(resolve({ command: "build", mode: "development", env: { [FLAG]: "true" } }).enabled, true);
  });

  it("rejects ambiguous values instead of reading them as off", () => {
    for (const value of ["1", "TRUE", "yes", "on", "0", "enabled"]) {
      assert.throws(() => resolve({ command: "serve", mode: "development", env: { [FLAG]: value } }), SmartSavingsBuildError, value);
    }
  });

  it("refuses a committable env file that sets the flag, even to false", () => {
    for (const line of ["VITE_SMART_SAVINGS_ENABLED=true", "  export VITE_SMART_SAVINGS_ENABLED = false"]) {
      assert.throws(
        () => resolve({ command: "serve", mode: "development", committableFiles: { ".env": `VITE_API_BASE_URL=/api\n${line}\n` } }),
        (error) => error instanceof SmartSavingsBuildError && error.message.includes(".env.local"),
      );
    }
    assert.doesNotThrow(() => resolve({ committableFiles: { ".env": "# VITE_SMART_SAVINGS_ENABLED=true\n" } }));
  });

  it("checks .env and .env.[mode], not the git-ignored .local files", () => {
    assert.deepEqual(committableEnvFiles("production"), [".env", ".env.production"]);

    const dir = mkdtempSync(path.join(tmpdir(), "smartspend-flag-"));
    try {
      writeFileSync(path.join(dir, ".env"), "VITE_API_BASE_URL=/api\n");
      writeFileSync(path.join(dir, ".env.local"), `${FLAG}=true\n`);
      assert.deepEqual(Object.keys(readCommittableEnvFiles(dir, "production")), [".env"]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("tracked configuration keeps Smart Savings off", () => {
  const read = (file) => readFileSync(path.join(ROOT, file), "utf8");

  it("the tracked .env does not set the flag", () => {
    assert.doesNotThrow(() => resolve({ committableFiles: { ".env": read(".env") } }));
  });

  it(".env.example documents the flag and the approval, commented out", () => {
    const example = read(".env.example");
    assert.match(example, /^# VITE_SMART_SAVINGS_ENABLED=true$/m);
    assert.match(example, new RegExp(APPROVAL));
    assert.doesNotMatch(example, /^\s*VITE_SMART_SAVINGS_ENABLED\s*=/m);
  });

  it("the deploy workflow pins the flag off and asserts it before building", () => {
    const workflow = read(".github/workflows/deploy-hostinger.yml");
    assert.match(workflow, /^\s+VITE_SMART_SAVINGS_ENABLED: "false"$/m);
    assert.match(workflow, /"\$VITE_SMART_SAVINGS_ENABLED" != "false"/);
    assert.match(workflow, new RegExp(`-n "\\$\\{${APPROVAL}:-\\}"`));
    assert.doesNotMatch(workflow, new RegExp(`${APPROVAL}:\\s`), "the workflow must never approve a release");
    assert.ok(workflow.indexOf("SMART_SAVINGS=OFF") < workflow.indexOf("npm run build"), "asserted before the build");
  });
});

describe("the real Vite configuration", () => {
  // Resolved from an empty working directory, so a developer's own
  // .env.local cannot influence the result.
  async function resolveWith(envOverrides, command, mode, files = {}) {
    const { resolveConfig } = await import("vite");
    const scratch = mkdtempSync(path.join(tmpdir(), "smartspend-vite-flag-"));
    const keys = [FLAG, APPROVAL, "SMARTSPEND_DEV_API_ORIGIN", "SMARTSPEND_ALLOW_REMOTE_API", "VITE_API_BASE_URL"];
    const saved = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
    const cwd = process.cwd();
    const quiet = console.info;
    try {
      for (const key of keys) delete process.env[key];
      Object.assign(process.env, envOverrides);
      for (const [name, contents] of Object.entries(files)) writeFileSync(path.join(scratch, name), contents);
      process.chdir(scratch);
      console.info = () => {};
      return await resolveConfig(
        { root: ROOT, configFile: path.join(ROOT, "vite.config.js"), logLevel: "silent" },
        command,
        mode,
      );
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

  it("builds production with the feature off by default", async () => {
    await assert.doesNotReject(resolveWith({}, "build", "production"));
  });

  it("refuses a production build turned on by an inherited variable", async () => {
    await assert.rejects(resolveWith({ [FLAG]: "true" }, "build", "production"), new RegExp(APPROVAL));
  });

  it("refuses a production build turned on by a private .env.local", async () => {
    await assert.rejects(resolveWith({}, "build", "production", { ".env.local": `${FLAG}=true\n` }), new RegExp(APPROVAL));
  });

  it("refuses a committable .env.production that sets the flag", async () => {
    await assert.rejects(resolveWith({}, "build", "production", { ".env.production": `${FLAG}=true\n` }), /\.env\.production sets/);
  });

  it("serves locally with the feature on from .env.local", async () => {
    await assert.doesNotReject(resolveWith({}, "serve", "development", { ".env.local": `${FLAG}=true\n` }));
  });

  it("builds production with the feature on only when approved in the environment", async () => {
    await assert.doesNotReject(resolveWith({ [FLAG]: "true", [APPROVAL]: "true" }, "build", "production"));
  });
});
