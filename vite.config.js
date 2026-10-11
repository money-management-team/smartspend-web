import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import process from 'node:process'
import { resolveDevApiTarget } from './scripts/devApiTarget.mjs'

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  // process.env wins over the .env files, so a value exported in the shell
  // always beats a file. `.env.local` stays the place for private settings.
  const env = { ...loadEnv(mode, process.cwd(), ''), ...process.env }

  // Fail-closed: with no configuration `/api` goes to http://127.0.0.1:8000.
  // A remote API needs SMARTSPEND_DEV_API_ORIGIN *and*
  // SMARTSPEND_ALLOW_REMOTE_API=true. Throws a readable error otherwise.
  // See docs/dev-environment/local-api-target.md.
  const target = resolveDevApiTarget({ command, env })

  if (target.origin) {
    console.info(
      `[smartspend] dev API proxy: /api -> ${target.origin}`
      + `${target.remote ? ' (REMOTE, explicitly allowed)' : ' (local)'}`,
    )
  }

  return {
    plugins: [react()],
    build: {
      // Pages are lazy-loaded (see routes/Routes.jsx), but the stylesheet stays
      // one file in source order. Many page and component stylesheets share
      // global class names and rely on that order, so splitting the CSS per
      // chunk would make the cascade depend on which page loaded first.
      cssCodeSplit: false,
    },
    // When VITE_API_BASE_URL is unset or "/api", apiClient calls `/api` on the
    // dev server's own origin; forward it to the resolved target above so
    // POST /api/register reaches Laravel instead of Vite returning 404.
    // Production does not use this: it builds with VITE_API_BASE_URL set by
    // .github/workflows/deploy-hostinger.yml.
    server: target.origin
      ? { proxy: { '/api': { target: target.origin, changeOrigin: true } } }
      : {},
  }
})
