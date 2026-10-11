# Local API target (fail-closed)

A plain `npm run dev` never contacts a real backend. This was changed in TASK 09B after TASK 09A showed that an ordinary local session could silently proxy `/api` to the staging Laravel Cloud server (the old `vite.config.js` fell back to the staging origin, and the tracked `.env` named it too).

## What happens by default

| Configuration | `/api` is forwarded to |
| --- | --- |
| nothing set | `http://127.0.0.1:8000` (local `php artisan serve`) |
| `SMARTSPEND_DEV_API_ORIGIN=http://localhost:9000` | that local origin |
| `SMARTSPEND_DEV_API_ORIGIN=<remote>` without confirmation | **the dev server refuses to start**, naming the variable to set |
| `SMARTSPEND_DEV_API_ORIGIN=<remote>` + `SMARTSPEND_ALLOW_REMOTE_API=true` | that remote origin, logged as `(REMOTE, explicitly allowed)` |

The dev server prints the effective target on start:

```
[smartspend] dev API proxy: /api -> http://127.0.0.1:8000 (local)
```

## Rules

- The confirmation must be exactly `true`; `1`, `yes`, `TRUE` do not count.
- An absolute `VITE_API_BASE_URL` makes the browser call that host directly (no proxy), so a non-loopback one needs the same confirmation. `VITE_API_BASE_URL=/api` (the default in `.env` and `.env.example`) is a path and always allowed.
- `SMARTSPEND_ALLOW_REMOTE_API=true` alone changes nothing; it only permits a target that was also named.
- Values are read from the process environment first, then `.env.local` / `.env` (`loadEnv`). Private overrides belong in `.env.local`, which is git-ignored and never modified by tooling.
- Malformed values (`not a url`, `ftp://…`, `//host`, a base URL without a leading `/`) are errors, not guesses.

## Production is unchanged

`vite build` is not affected. The Hostinger workflow `.github/workflows/deploy-hostinger.yml` still supplies `VITE_API_BASE_URL` from repository variables, refuses anything but `https://smartspend-api.anasalharazeen.com/api`, and checks the built bundle contains it. Process environment wins over `.env` in Vite, so the tracked `.env` has no effect on that build.

### Compatibility note about the tracked `.env`

`.env` used to contain the staging API URL. It now contains `VITE_API_BASE_URL=/api` and an empty `VITE_GOOGLE_CLIENT_ID`. Anything that built the frontend **without** setting `VITE_API_BASE_URL` and relied on that file would previously have produced a staging-pointed bundle; it now produces a bundle that calls `/api` on its own origin. The only known pipeline is the Hostinger workflow above (it sets the variable explicitly). The old Vercel notes in `docs/visual-refresh-2026-09-29.md` already say the variable is set in the Vercel dashboard.

## Using a remote API deliberately

```powershell
$env:SMARTSPEND_DEV_API_ORIGIN = "https://staging.example"
$env:SMARTSPEND_ALLOW_REMOTE_API = "true"
npm run dev
```

Or put the same two lines in `.env.local`. Use test accounts only; a remote session talks to real data.

## Under git-bash on Windows

Git-bash rewrites values that start with `/` into Windows paths, so `VITE_API_BASE_URL=/api` becomes `C:/Program Files/Git/api`. Prefix the command with `MSYS_NO_PATHCONV=1` when you export it. Nothing else changes.

## Tests

`tests/devApiTarget.test.mjs` proves the rules without a network:

- the pure resolver (`scripts/devApiTarget.mjs`): default, blank values, local ports, refusal without confirmation, exact-`true` confirmation, absolute base URL, malformed input, production builds untouched;
- tracked files (`.env`, `.env.example`, `vite.config.js`) contain no real host, and the deploy workflow still supplies and validates the production URL;
- the real `vite.config.js`, resolved from an empty working directory: default session → `127.0.0.1:8000`, staging without confirmation → error, confirmed → staging, `build` → no proxy.
