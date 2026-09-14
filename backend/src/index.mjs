import './env.mjs'
if (process.env.ASCENT_DATA_MODE === 'supabase') {
  const { start } = await import('./app.mjs')
  await start()
} else {
  await import('./legacy.mjs')
}
