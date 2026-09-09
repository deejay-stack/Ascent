import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
// https://vite.dev/config/
export default defineConfig({
  cacheDir: process.env.ASCENT_TEST_CACHE || 'node_modules/.vite',
  optimizeDeps: { entries: ['index.html'] },
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': process.env.ASCENT_API_TARGET || 'http://localhost:4174',
    },
  },
})
