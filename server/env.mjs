import { config } from 'dotenv'
config({ path: '.env.local', quiet: true })
config({ quiet: true })
export function required(name) {
  const value = process.env[name]
  if (!value || value.includes('[YOUR-') || value.includes('YOUR_PROJECT'))
    throw new Error(`Missing ${name}. Fill .env.local before enabling Supabase mode.`)
  return value
}
