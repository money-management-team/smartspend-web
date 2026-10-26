import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { after, before, test } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import react from "@vitejs/plugin-react";

import { createIsolatedServer } from "./helpers/isolatedVite.mjs";

/*
 * The SSR tests (experienceRendering and friends) render components that Vite
 * transforms with the test's own react-dom. They only work with one copy of
 * React, and Vite's dependency optimizer can create a second one, depending on
 * timing (see tests/helpers/isolatedVite.mjs). These checks keep that out.
 */

let server;
before(async () => {
  server = await createIsolatedServer({ configFile: false, plugins: [react()], server: { middlewareMode: true, watch: null }, appType: "custom" });
});
after(async () => {
  await server?.close();
});

test("a server made by the helper runs no dependency optimizer and writes nothing to its cache", async () => {
  await server.ssrLoadModule("/tests/helpers/hookProbe.jsx");
  await new Promise((resolve) => setTimeout(resolve, 1500));

  assert.deepEqual(server.config.optimizeDeps.include, []);
  assert.equal(server.config.optimizeDeps.noDiscovery, true);
  assert.deepEqual(server.optimizerOutput(), []);
});

test("a component transformed by the server renders with the test's own React (hooks work)", async () => {
  const { default: HookProbe } = await server.ssrLoadModule("/tests/helpers/hookProbe.jsx");
  assert.equal(renderToStaticMarkup(createElement(HookProbe)), "<p>one React</p>");
});

test("its cache is private and is not the project's node_modules/.vite", () => {
  assert.ok(!server.config.cacheDir.replaceAll("\\", "/").includes("node_modules/.vite"));
  assert.ok(existsSync(server.config.cacheDir));
});
