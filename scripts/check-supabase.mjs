import '../server/env.mjs'
const required = [
  'SUPABASE_URL',
  'SUPABASE_SERVICE_ROLE_KEY',
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_PUBLISHABLE_KEY',
  'DATABASE_URL',
]
const missing = required.filter((name) => !process.env[name])
if (missing.length) {
  console.error('Missing configuration: ' + missing.join(', '))
  process.exitCode = 1
} else {
  let db
  try {
    const module = await import('../server/db.mjs')
    db = module.db
    const { supabaseAdmin } = await import('../server/supabase.mjs')
    await db.$queryRaw`SELECT 1`
    const tables =
      await db.$queryRaw`SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('products','sales','inventory_movements','profiles','store_events')`
    if (tables.length !== 5 || tables.some((t) => !t.rowsecurity))
      throw new Error(
        'Apply both database migrations; all application tables must have RLS enabled.',
      )
    const { error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1 })
    if (error) throw new Error('The Supabase server key could not authenticate.')
    const { data: buckets, error: bucketError } = await supabaseAdmin.storage.listBuckets()
    if (
      bucketError ||
      !buckets.some((b) => b.id === (process.env.SUPABASE_PRODUCT_BUCKET || 'product-images'))
    )
      throw new Error('Run the setup seed to create the product image bucket.')
    if (process.env.SUPABASE_URL !== process.env.VITE_SUPABASE_URL)
      throw new Error('Frontend and backend Supabase URLs must match.')
    console.log(
      'Verified: PostgreSQL connection, application tables/RLS, Supabase Auth admin access, and product Storage bucket.',
    )
  } catch (error) {
    console.error(
      error.message?.includes('Apply both') ||
        error.message?.startsWith('The Supabase') ||
        error.message?.startsWith('Run the setup') ||
        error.message?.startsWith('Frontend')
        ? error.message
        : 'Connection check failed. Verify the project URL, keys and database URL in .env.local.',
    )
    process.exitCode = 1
  } finally {
    await db?.$disconnect()
  }
}
