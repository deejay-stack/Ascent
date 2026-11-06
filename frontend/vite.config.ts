import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'
import { apiProxy } from './api-proxy.ts'
import { apiUrl } from './src/services/apiUrl.ts'
// https://vite.dev/config/
export default defineConfig(({ mode, command }) => {
  if (process.env.VERCEL && command === 'build') {
    const env = loadEnv(mode, fileURLToPath(new URL('.', import.meta.url)), 'VITE_')
    if (env.VITE_DATA_MODE !== 'supabase' || !env.VITE_SUPABASE_URL ||
        !env.VITE_SUPABASE_PUBLISHABLE_KEY || !env.VITE_API_URL)
      throw new Error('Vercel needs VITE_DATA_MODE=supabase, VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY and VITE_API_URL.')
    if (!apiUrl('/api/health', env.VITE_API_URL).startsWith('https://'))
      throw new Error('Vercel needs an HTTPS VITE_API_URL.')
  }
  return {
  root: fileURLToPath(new URL('.', import.meta.url)),
  cacheDir: process.env.ASCENT_TEST_CACHE || '../node_modules/.vite/frontend',
  optimizeDeps: { entries: ['index.html'] },
  plugins: [react(), tailwindcss()],
  server: {
    watch: { ignored: ['**/artifacts/**'] },
    proxy: {
      '/api': apiProxy(process.env.ASCENT_API_TARGET),
    },
  },
  }
})
