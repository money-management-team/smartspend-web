import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import process from 'node:process'

const devApiOrigin = process.env.SMARTSPEND_DEV_API_ORIGIN
  || 'https://smartspend-backend-staging-vjthdp.laravel.cloud'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // When VITE_API_BASE_URL is unset, apiClient uses /api. Forward that path
  // during local development so POST /api/register reaches Laravel instead
  // of Vite returning 404. Production still uses VITE_API_BASE_URL on Vercel.
  server: {
    proxy: {
      '/api': {
        target: devApiOrigin,
        changeOrigin: true,
      },
    },
  },
})
