import './env.ts'
import type { Express } from 'express'
let app: Express | undefined
if (process.env.VERCEL && process.env.ASCENT_DATA_MODE !== 'supabase')
  throw new Error('Vercel requires ASCENT_DATA_MODE=supabase.')
if (process.env.ASCENT_DATA_MODE === 'supabase') {
  const module = await import('./app.ts')
  app = module.app
  if (!process.env.VERCEL) await module.start()
} else {
  await import('./legacy.ts')
}
export default app
