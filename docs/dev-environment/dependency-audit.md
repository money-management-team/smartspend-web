# Dependency audit

## 2026-10-11 (TASK 09B)

`npm audit` before: 3 high-severity findings. After `npm audit fix` (no `--force`) and raising the axios floor: **0 vulnerabilities**.

| Package | Installed → patched | Advisories | Path | Exposure | Fix |
| --- | --- | --- | --- | --- | --- |
| `axios` | 1.19.0 → **1.20.0** | 12 (prototype-pollution gadgets, ReDoS, header injection, SSRF/redirect, proxy bypass, HTTP/2) all fixed in `>=1.20.0` | direct dependency | Not reachable at runtime: the only importer is the legacy `src/services/api.js`, which nothing imports (the app uses the fetch-based `apiRequest`). Still shipped as a declared dependency | semver-compatible minor; `package.json` floor raised to `^1.20.0` |
| `brace-expansion` | 5.0.9 → **5.0.12** | 3 (quadratic expansion, two stack-exhaustion DoS) | `eslint > minimatch` | development tool only; never in the production bundle | lock file only |
| `source-map-js` | 1.2.1 → **1.2.2** | 1 (event-loop DoS through indexed source-map offsets) | `vite > postcss`, `jsdom > css-tree` | build/test time only | lock file only |

No major version changed. `package-lock.json` changed in 3 packages plus the root axios range.

Verification after the update: `npm test` (all suites), `npm run lint`, `npm run build`, `npm audit` (0).

### Follow-up (not done here)

`src/services/api.js` and the `axios` dependency are dead code. Removing both would delete the whole advisory class permanently; it is a code deletion, so it is left for its own review.
