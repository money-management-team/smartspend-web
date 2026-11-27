import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

import {
  APPROVAL,
  FLAG,
  MobileBuildError,
  resolveMobileBuild,
} from "../scripts/mobileBuildFlag.mjs";
import { MOBILE_ENTRY_ID, mobileEntryPlugin, mobileEntrySource } from "../scripts/mobileEntryPlugin.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (file) => readFileSync(path.join(ROOT, file), "utf8");
const resolve = ({ command = "build", mode = "production", env = {}, processEnv = {}, committableFiles = {} } = {}) =>
  resolveMobileBuild({ command, mode, env, processEnv, committableFiles });

describe("Mobile build flag", () => {
  it("is off when nothing sets it, in every command and mode", () => {
    assert.deepEqual(resolve(), { enabled: false, approved: false, invalid: false });
    assert.equal(resolve({ command: "serve", mode: "development" }).enabled, false);
    assert.equal(resolve({ env: { [FLAG]: "false" } }).enabled, false);
  });

  it("is on only for the exact string 'true' (outside production)", () => {
    assert.equal(resolve({ command: "serve", mode: "development", env: { [FLAG]: "true" } }).enabled, true);
    assert.equal(resolve({ command: "build", mode: "preview", env: { [FLAG]: "true" } }).enabled, true);
  });

  it("never reads another truthy-looking value as on", () => {
    for (const value of ["TRUE", "True", "1", "yes", "on", "enabled", " true", "true ", "true\n"]) {
      const result = resolve({ command: "serve", mode: "development", env: { [FLAG]: value } });
      assert.equal(result.enabled, false, JSON.stringify(value));
      assert.equal(result.invalid, true, JSON.stringify(value));
    }
  });

  it("refuses a production build with an unrecognised value instead of guessing", () => {
    for (const value of ["TRUE", "1", "yes"]) {
      assert.throws(() => resolve({ env: { [FLAG]: value } }), MobileBuildError, value);
    }
  });

  it("refuses a production build that would ship it without approval", () => {
    assert.throws(
      () => resolve({ env: { [FLAG]: "true" } }),
      (error) => error instanceof MobileBuildError && error.message.includes(APPROVAL),
    );
  });

  it("takes approval only from the build environment, never from a file, and only as 'true'", () => {
    assert.throws(() => resolve({ env: { [FLAG]: "true", [APPROVAL]: "true" } }), MobileBuildError);
    assert.deepEqual(
      resolve({ env: { [FLAG]: "true" }, processEnv: { [APPROVAL]: "true" } }),
      { enabled: true, approved: true, invalid: false },
    );

    for (const value of ["1", "yes", "TRUE", "on", ""]) {
      assert.throws(
        () => resolve({ env: { [FLAG]: "true" }, processEnv: { [APPROVAL]: value } }),
        MobileBuildError,
        `"${value}" must not count as approval`,
      );
    }
  });

  it("a production build with Mobile off never needs or reads the approval", () => {
    assert.equal(resolve({ processEnv: { [APPROVAL]: "true" } }).enabled, false);
  });

  it("refuses a committable env file that sets the flag, even to false", () => {
    for (const line of [`${FLAG}=true`, `  export ${FLAG} = false`]) {
      assert.throws(
        () => resolve({ command: "serve", mode: "development", committableFiles: { ".env": `VITE_API_BASE_URL=/api\n${line}\n` } }),
        (error) => error instanceof MobileBuildError && error.message.includes(".env.local"),
      );
    }

    assert.doesNotThrow(() => resolve({ committableFiles: { ".env": `# ${FLAG}=true\n` } }));
  });
});

describe("the Mobile entry plugin", () => {
  it("answers the virtual import with no import at all when Mobile is off", () => {
    const source = mobileEntrySource(false, ROOT);
    assert.equal(source, "export const MobileEntry = null;\n");
    assert.doesNotMatch(source, /import/);
  });

  it("answers it with a plain re-export of the Mobile entry when Mobile is on (the screens are loaded lazily from there)", () => {
    const source = mobileEntrySource(true, ROOT);
    assert.match(source, /^export \{ default as MobileEntry \} from ".*src\/mobile\/entry\/MobileEntry\.jsx";\n$/);
    assert.doesNotMatch(source, /import\(/, "the entry itself holds no dynamic import");
  });

  it("only claims its own virtual id", () => {
    const plugin = mobileEntryPlugin(false);
    assert.equal(plugin.resolveId("react"), null);
    assert.equal(plugin.load("react"), null);
    assert.ok(plugin.resolveId(MOBILE_ENTRY_ID));
  });
});

describe("tracked configuration keeps Mobile off", () => {
  it("the tracked .env does not set the flag", () => {
    assert.doesNotThrow(() => resolve({ committableFiles: { ".env": read(".env") } }));
  });

  it(".env.example documents the flag and the approval, commented out", () => {
    const example = read(".env.example");
    assert.match(example, /^# VITE_MOBILE_ENABLED=true$/m);
    assert.match(example, new RegExp(APPROVAL));
    assert.doesNotMatch(example, /^\s*VITE_MOBILE_ENABLED\s*=/m);
  });

  it("the deploy workflow pins Mobile off, asserts it before building, and never hard-codes an approval", () => {
    const workflow = read(".github/workflows/deploy-hostinger.yml");
    assert.match(workflow, /^ {6}VITE_MOBILE_ENABLED: "false"$/m, "the job default is off");
    assert.match(workflow, /"\$VITE_MOBILE_ENABLED" != "false"/);
    assert.doesNotMatch(workflow, new RegExp(`${APPROVAL}: "true"`), "no literal Mobile approval");
    assert.doesNotMatch(workflow, /SMARTSPEND_MOBILE_PWA_RELEASE_APPROVED: "true"/, "no literal PWA approval");
    assert.doesNotMatch(workflow, /VITE_MOBILE_ENABLED: "true"|VITE_MOBILE_PWA: "true"/);
    assert.ok(workflow.indexOf("Mobile must stay off") < workflow.indexOf("npm run build"), "asserted before the build");
    assert.match(workflow, /VITE_MOBILE_ENABLED\[\[:space:\]\]\*=/, "tracked env files are checked");
    // The approvals come only from repository variables, read by the resolve step alone.
    assert.match(workflow, /MOBILE_APPROVAL: \$\{\{ vars\.SMARTSPEND_MOBILE_RELEASE_APPROVED \}\}/);
    assert.match(workflow, /PWA_APPROVAL: \$\{\{ vars\.SMARTSPEND_MOBILE_PWA_RELEASE_APPROVED \}\}/);
    assert.equal((workflow.match(/vars\.SMARTSPEND_MOBILE_/g) ?? []).length, 2, "read once each");
    // The build step takes Mobile only from the resolve step's outputs.
    const build = workflow.slice(workflow.indexOf("- name: Build production frontend"), workflow.indexOf("- name: Validate build"));
    for (const [name, output] of [["VITE_MOBILE_ENABLED", "mobile"], [APPROVAL, "mobile"], ["VITE_MOBILE_PWA", "pwa"], ["SMARTSPEND_MOBILE_PWA_RELEASE_APPROVED", "pwa"], ["SMARTSPEND_MOBILE_PWA_RETIRE", "retire"]]) {
      assert.match(build, new RegExp(`^ {10}${name}: \\$\\{\\{ steps\\.mobile\\.outputs\\.${output} \\}\\}$`, "m"), name);
    }
    assert.ok(workflow.indexOf("- name: Resolve Mobile release") < workflow.indexOf("npm run build"));
  });

  it("the resolve step turns Mobile on only for a manual run with the input and the recorded approval", (t) => {
    const workflow = read(".github/workflows/deploy-hostinger.yml").replace(/\r\n/g, "\n");
    const lines = workflow.slice(workflow.indexOf("- name: Resolve Mobile release")).split("\n");
    const start = lines.findIndex((line) => line.trim() === "run: |") + 1;
    const body = [];
    for (const line of lines.slice(start)) {
      if (line.trim() && !line.startsWith(" ".repeat(10))) break;
      body.push(line.slice(10));
    }
    const script = body.join("\n");
    const probe = spawnSync("bash", ["-c", "exit 0"], { encoding: "utf8" });
    if (probe.error || probe.status !== 0) {
      t.skip("bash is not available here (CI runs it)");
      return;
    }
    const dir = mkdtempSync(path.join(tmpdir(), "smartspend-wf-"));
    const run = (env) => {
      const output = path.join(dir, "out");
      writeFileSync(output, "");
      const result = spawnSync("bash", ["-c", script], { encoding: "utf8", env: { PATH: process.env.PATH, GITHUB_OUTPUT: output, ...env } });
      const outputs = Object.fromEntries(readFileSync(output, "utf8").split("\n").filter(Boolean).map((line) => line.split("=")));
      return { status: result.status, outputs };
    };
    const OFF = { mobile: "false", pwa: "false", retire: "false" };
    const dispatch = (over) => ({ EVENT_NAME: "workflow_dispatch", ASK_MOBILE: "false", ASK_PWA: "false", ASK_RETIRE: "false", ...over });
    try {
      // A push never ships Mobile, whatever the inputs and variables say.
      assert.deepEqual(run({ EVENT_NAME: "push", ASK_MOBILE: "true", ASK_PWA: "true", MOBILE_APPROVAL: "true", PWA_APPROVAL: "true" }), { status: 0, outputs: OFF });
      assert.deepEqual(run({ EVENT_NAME: "push" }), { status: 0, outputs: OFF });
      // A manual run with the defaults is Desktop only, approvals or not.
      assert.deepEqual(run(dispatch({ MOBILE_APPROVAL: "true", PWA_APPROVAL: "true" })), { status: 0, outputs: OFF });
      // Asking without the approval fails the run; a near-miss value is no approval.
      for (const approval of [undefined, "", "TRUE", "1", "yes", "true "]) {
        assert.equal(run(dispatch({ ASK_MOBILE: "true", ...(approval === undefined ? {} : { MOBILE_APPROVAL: approval }) })).status, 1, `approval ${JSON.stringify(approval)}`);
      }
      assert.deepEqual(run(dispatch({ ASK_MOBILE: "true", MOBILE_APPROVAL: "true" })), { status: 0, outputs: { ...OFF, mobile: "true" } });
      // The PWA needs Mobile and its own approval.
      assert.equal(run(dispatch({ ASK_PWA: "true", MOBILE_APPROVAL: "true", PWA_APPROVAL: "true" })).status, 1, "PWA without Mobile");
      assert.equal(run(dispatch({ ASK_MOBILE: "true", ASK_PWA: "true", MOBILE_APPROVAL: "true" })).status, 1, "PWA without its approval");
      assert.deepEqual(run(dispatch({ ASK_MOBILE: "true", ASK_PWA: "true", MOBILE_APPROVAL: "true", PWA_APPROVAL: "true" })), { status: 0, outputs: { mobile: "true", pwa: "true", retire: "false" } });
      // The retire rollback needs no approval and never comes with the PWA.
      assert.deepEqual(run(dispatch({ ASK_RETIRE: "true" })), { status: 0, outputs: { ...OFF, retire: "true" } });
      assert.equal(run(dispatch({ ASK_MOBILE: "true", ASK_PWA: "true", ASK_RETIRE: "true", MOBILE_APPROVAL: "true", PWA_APPROVAL: "true" })).status, 1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("the deploy workflow only runs for the development branch", () => {
    assert.match(read(".github/workflows/deploy-hostinger.yml"), /^\s+if: github\.ref == 'refs\/heads\/development'$/m);
  });

  it("the router takes Mobile only from the virtual module, with no direct Mobile import", () => {
    const router = read("src/routes/Router.jsx");
    assert.match(router, /from "virtual:smartspend-mobile"/);
    assert.doesNotMatch(router, /from "\.\.\/mobile|import\("\.\.\/mobile/);
  });
});

describe("the real Vite configuration", () => {
  async function resolveWith(envOverrides, command, mode, files = {}) {
    const { resolveConfig } = await import("vite");
    const scratch = mkdtempSync(path.join(tmpdir(), "smartspend-mobile-flag-"));
    const keys = [FLAG, APPROVAL, "SMARTSPEND_DEV_API_ORIGIN", "SMARTSPEND_ALLOW_REMOTE_API", "VITE_API_BASE_URL", "VITE_SMART_SAVINGS_ENABLED"];
    const saved = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
    const cwd = process.cwd();
    const quiet = [console.info, console.warn];

    try {
      for (const key of keys) delete process.env[key];
      Object.assign(process.env, envOverrides);
      for (const [name, contents] of Object.entries(files)) writeFileSync(path.join(scratch, name), contents);
      process.chdir(scratch);
      console.info = () => {};
      console.warn = () => {};
      return await resolveConfig(
        { root: ROOT, configFile: path.join(ROOT, "vite.config.js"), logLevel: "silent" },
        command,
        mode,
      );
    } finally {
      [console.info, console.warn] = quiet;
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

  const hasPlugin = (config) => config.plugins.some((plugin) => plugin.name === "smartspend-mobile-entry");

  it("builds production with Mobile off by default, with the entry plugin answering null", async () => {
    const config = await resolveWith({}, "build", "production");
    assert.equal(hasPlugin(config), true);
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

  it("refuses a production build with TRUE or 1", async () => {
    await assert.rejects(resolveWith({ [FLAG]: "TRUE" }, "build", "production"), /exactly "true" or "false"/);
    await assert.rejects(resolveWith({ [FLAG]: "1" }, "build", "production"), /exactly "true" or "false"/);
  });

  it("serves locally with Mobile on from .env.local, without any approval", async () => {
    await assert.doesNotReject(resolveWith({}, "serve", "development", { ".env.local": `${FLAG}=true\n` }));
  });

  it("does not stop Desktop development because of a stray invalid value", async () => {
    await assert.doesNotReject(resolveWith({ [FLAG]: "yes" }, "serve", "development"));
  });

  it("builds production with Mobile on only when approved in the environment", async () => {
    await assert.doesNotReject(resolveWith({ [FLAG]: "true", [APPROVAL]: "true" }, "build", "production"));
  });
});
