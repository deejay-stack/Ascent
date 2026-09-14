import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'node:url'
// https://vite.dev/config/
export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  cacheDir: process.env.ASCENT_TEST_CACHE || '../node_modules/.vite/frontend',
  optimizeDeps: { entries: ['index.html'] },
  plugins: [react(), tailwindcss()],
  server: {
    watch: { ignored: ['**/artifacts/**'] },
    proxy: {
      '/api': process.env.ASCENT_API_TARGET || 'http://localhost:4174',
    },
  },
})
