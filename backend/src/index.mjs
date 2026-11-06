import './env.mjs'
if (process.env.VERCEL && process.env.ASCENT_DATA_MODE !== 'supabase')
  throw new Error('Vercel requires ASCENT_DATA_MODE=supabase.')
if (process.env.ASCENT_DATA_MODE === 'supabase') {
  const { start } = await import('./app.mjs')
  await start()
} else {
  await import('./legacy.mjs')
}
