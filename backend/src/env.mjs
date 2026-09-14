import { config } from 'dotenv'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'
export const backendDir = fileURLToPath(new URL('..', import.meta.url))
export const projectDir = resolve(backendDir, '..')
export const frontendDir = resolve(projectDir, 'frontend')
config({ path: process.env.ASCENT_ENV_FILE || resolve(backendDir, '.env.local'), quiet: true })
config({ path: resolve(backendDir, '.env'), quiet: true })
export function required(name) {
  const value = process.env[name]
  if (!value || value.includes('[YOUR-') || value.includes('YOUR_PROJECT'))
    throw new Error(`Missing ${name}. Fill backend/.env.local before enabling Supabase mode.`)
  return value
}
