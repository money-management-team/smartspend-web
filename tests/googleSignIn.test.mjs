import assert from "node:assert/strict";
import { test } from "node:test";
import { createServer } from "vite";
import { createGoogleIdentityLoader } from "../src/features/Auth/components/AuthSocial/googleIdentity.js";

function environment() {
  const scripts = [],
    timers = new Map();
  let nextTimer = 0;
  return {
    scripts,
    timers,
    document: {
      createElement: () => {
        const script = {
          remove() {
            const i = scripts.indexOf(script);
            if (i >= 0) scripts.splice(i, 1);
          },
        };
        return script;
      },
      head: { append: (script) => scripts.push(script) },
    },
    setTimeout: (fn) => {
      timers.set(++nextTimer, fn);
      return nextTimer;
    },
    clearTimeout: (id) => timers.delete(id),
  };
}
function google(env) {
  const calls = [];
  env.google = {
    accounts: { id: { initialize: (options) => calls.push(options) } },
  };
  return calls;
}

test("missing Google configuration never downloads a script", async () => {
  const env = environment(),
    loader = createGoogleIdentityLoader({ clientId: "", environment: env });
  await assert.rejects(loader.load());
  assert.equal(env.scripts.length, 0);
});
test("parallel Google loaders share a script and initialize the popup callback only once", async () => {
  const env = environment(),
    loader = createGoogleIdentityLoader({
      clientId: "client",
      environment: env,
    });
  const a = loader.load(),
    b = loader.load();
  assert.equal(a, b);
  assert.equal(env.scripts.length, 1);
  const calls = google(env);
  env.scripts[0].onload();
  await a;
  await loader.load();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].ux_mode, "popup");
  assert.equal(calls[0].auto_select, false);
  assert.equal(env.timers.size, 0);
});
test("a blocked script times out removes its owned resources and allows an explicit retry", async () => {
  const env = environment(),
    loader = createGoogleIdentityLoader({
      clientId: "client",
      environment: env,
    });
  const pending = loader.load(),
    rejected = assert.rejects(pending);
  [...env.timers.values()][0]();
  await rejected;
  assert.equal(env.scripts.length, 0);
  assert.equal(env.timers.size, 0);
  const retry = loader.load();
  const calls = google(env);
  env.scripts[0].onload();
  await retry;
  assert.equal(calls.length, 1);
});
test("network and malformed script failures remove the script and never retain a rejected promise", async () => {
  for (const method of ["onerror", "onload"]) {
    const env = environment(),
      loader = createGoogleIdentityLoader({
        clientId: "client",
        environment: env,
      });
    const failed = loader.load(),
      rejected = assert.rejects(failed);
    env.scripts[0][method]();
    await rejected;
    assert.equal(env.scripts.length, 0);
    const retry = loader.load();
    google(env);
    env.scripts[0].onload();
    await retry;
  }
});
test("late callbacks cannot authenticate another screen and old cleanup cannot unsubscribe the new screen", async () => {
  const env = environment(),
    calls = google(env),
    loader = createGoogleIdentityLoader({
      clientId: "client",
      environment: env,
    });
  const receivedA = [],
    receivedB = [];
  const a = loader.subscribe((token) => receivedA.push(token));
  await loader.load();
  calls[0].callback({ state: a.state, credential: "a" });
  assert.deepEqual(receivedA, ["a"]);
  const b = loader.subscribe((token) => receivedB.push(token));
  a.unsubscribe();
  calls[0].callback({ state: a.state, credential: "late-a" });
  calls[0].callback({ state: b.state, credential: "b" });
  calls[0].callback({ state: b.state, credential: [] });
  calls[0].callback({ credential: "no-owner" });
  assert.deepEqual(receivedA, ["a"]);
  assert.deepEqual(receivedB, ["b"]);
  b.unsubscribe();
  calls[0].callback({ state: b.state, credential: "late-b" });
  assert.deepEqual(receivedB, ["b"]);
});

test("Google API sends only identity and explicitly accepted policies with no saved bearer credential", async () => {
  const server = await createServer({
    configFile: false,
    server: { middlewareMode: true, watch: null },
    appType: "custom",
  });
  const savedFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url, options });
    return new Response(JSON.stringify({ status: true, data: {} }), {
      headers: { "Content-Type": "application/json" },
    });
  };
  try {
    const { authApi } = await server.ssrLoadModule(
      "/src/features/Dashboards/User/api/authApi.js",
    );
    await authApi.loginWithGoogle("google-jwt");
    await authApi.loginWithGoogle("google-jwt", { acceptedPolicies: true });
    await authApi.loginWithGoogle("google-jwt", { acceptedPolicies: "true" });
    assert.deepEqual(
      calls.map(({ options }) => JSON.parse(options.body)),
      [
        { id_token: "google-jwt" },
        {
          id_token: "google-jwt",
          terms_accepted: true,
          privacy_accepted: true,
        },
        { id_token: "google-jwt" },
      ],
    );
    for (const { url, options } of calls) {
      assert.ok(url.endsWith("/api/auth/google"));
      assert.equal(options.method, "POST");
      assert.equal(options.headers.Authorization, undefined);
    }
    const controller = new AbortController();
    controller.abort();
    await authApi.loginWithGoogle("google-jwt", { signal: controller.signal });
    assert.equal(calls.at(-1).options.signal.aborted, true);
  } finally {
    globalThis.fetch = savedFetch;
    await server.close();
  }
});
