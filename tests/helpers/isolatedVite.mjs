import { mkdtempSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer } from "vite";

/*
 * A Vite SSR server for tests that cannot touch shared state.
 *
 * Two things were shared or racy with the defaults:
 *
 *  1. The dependency-optimizer cache, node_modules/.vite, is also used by
 *     `npm run dev` and by every other test file's server. They run with
 *     different configs (so different cache hashes) and rewrite each other's
 *     pre-bundled React.
 *  2. The optimizer itself. Each server starts a background scan and
 *     pre-bundle of React; whether a test's first ssrLoadModule resolves
 *     `react` to the pre-bundled copy or to node_modules' copy depends on
 *     whether that finishes first. Two copies of React make hooks fail with
 *     "useContext of null".
 *
 * S04A saw (2) end in five failures in experienceRendering once; S04B1 saw the
 * same five once in 17 full runs and could not reproduce it on purpose (cold
 * and warm cache, a running dev server, concurrent builds, CPU load). This
 * helper removes both ingredients: a private cacheDir, and no optimizer at
 * all (an SSR test has no use for pre-bundled browser dependencies), plus no
 * HMR socket (several servers fought over one port). It cannot prove that
 * was the cause; if the failure ever comes back with all of this removed, the
 * cause is something else.
 */
export async function createIsolatedServer(options = {}) {
  const cacheDir = mkdtempSync(join(tmpdir(), "smartspend-vite-"));
  const noOptimizer = {
    name: "smartspend-test-no-optimizer",
    enforce: "post",
    // @vitejs/plugin-react adds react, react-dom and the JSX runtimes to optimizeDeps.include; the merged config
    // arrays cannot be overridden from config(), so the resolved list is emptied here, before the optimizer starts.
    config: () => ({ optimizeDeps: { noDiscovery: true, entries: [] } }),
    configResolved(config) {
      config.optimizeDeps.include = [];
    },
  };
  const server = await createServer({
    ...options,
    plugins: [...(options.plugins ?? []), noOptimizer],
    cacheDir,
    server: { ...options.server, hmr: false, ws: false },
  });
  const close = server.close.bind(server);
  const remove = () => rmSync(cacheDir, { recursive: true, force: true });

  // Vite can recreate the directory just after close(), so the exit hook sweeps again.
  process.once("exit", remove);

  server.close = async () => {
    try {
      await close();
    } finally {
      remove();
    }
  };

  // For tests/mobileTestIsolation.test.mjs: what the optimizer wrote, if anything.
  server.optimizerOutput = () => {
    try {
      return readdirSync(cacheDir);
    } catch {
      return [];
    }
  };

  return server;
}
