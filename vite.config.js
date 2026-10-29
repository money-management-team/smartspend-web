import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import process from 'node:process'
import { resolveDevApiTarget } from './scripts/devApiTarget.mjs'
import { readCommittableEnvFiles, resolveSmartSavingsBuild } from './scripts/smartSavingsBuildFlag.mjs'
import { resolveMobileBuild } from './scripts/mobileBuildFlag.mjs'
import { mobileEntryPlugin } from './scripts/mobileEntryPlugin.mjs'
import { resolveMobilePwa, resolvePwaRetire } from './scripts/mobilePwa.mjs'

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

  // Smart Savings is unreleased. A production build that would ship it
  // fails unless the release is approved in the build environment itself;
  // committable env files may not set the flag at all.
  // See scripts/smartSavingsBuildFlag.mjs.
  const smartSavings = resolveSmartSavingsBuild({
    command,
    mode,
    env,
    processEnv: process.env,
    committableFiles: readCommittableEnvFiles(process.cwd(), mode),
  })

  if (smartSavings.enabled) {
    console.info(
      `[smartspend] Smart Savings: ON (${command}, ${mode}`
      + `${smartSavings.approved ? ', release approved' : ''})`,
    )
  }

  // The Mobile experience is off unless VITE_MOBILE_ENABLED is exactly
  // "true"; a production build with it on also needs a release approval in
  // the build environment. See scripts/mobileBuildFlag.mjs.
  const mobile = resolveMobileBuild({
    command,
    mode,
    env,
    processEnv: process.env,
    committableFiles: readCommittableEnvFiles(process.cwd(), mode),
  })

  if (mobile.invalid) {
    console.warn('[smartspend] VITE_MOBILE_ENABLED is not exactly "true" or "false": Mobile stays OFF.')
  }

  if (mobile.enabled) {
    console.info(
      `[smartspend] Mobile: ON (${command}, ${mode}`
      + `${mobile.approved ? ', release approved' : ''})`,
    )
  }

  // The Mobile PWA: local and staging only, never in a production-mode build
  // (scripts/mobilePwa.mjs).
  const pwa = resolveMobilePwa({ mobileEnabled: mobile.enabled, command, mode, env })

  if (pwa.refusedInProduction) {
    console.warn('[smartspend] VITE_MOBILE_PWA is ignored in a production build: the Mobile PWA stays OFF.')
  }

  // Rolling a staging origin back from the PWA: a static retire worker only (scripts/mobilePwa.mjs).
  const retire = resolvePwaRetire({ pwaEnabled: pwa.enabled, command, mode, env: process.env })

  if (retire.refusedInProduction) {
    console.warn('[smartspend] SMARTSPEND_MOBILE_PWA_RETIRE is ignored in a production build: no worker file is emitted.')
  }

  return {
    // The Mobile code enters the build only through this plugin, and only
    // when the flag resolved to on (see scripts/mobileEntryPlugin.mjs).
    plugins: [react(), mobileEntryPlugin(mobile.enabled, { pwa: pwa.enabled, retire: retire.enabled })],
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
