import '../src/env.mjs'
import pg from 'pg'
import { createClient } from '@supabase/supabase-js'
import { databaseConfig } from '../src/database-config.mjs'
const connectionString = process.env.DATABASE_URL
if (!connectionString) throw new Error('DATABASE_URL is missing in backend/.env.local.')
const client = new pg.Client({ ...databaseConfig(), statement_timeout: 10000 })
try {
  await client.connect()
  const { rows } = await client.query(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename",
  )
  console.log('Existing public tables:', rows.map((row) => row.tablename).join(', ') || '(none)')
  if (rows.some((row) => row.tablename === '_prisma_migrations')) {
    const applied = await client.query(
      'SELECT migration_name, finished_at IS NOT NULL AS finished, rolled_back_at IS NOT NULL AS rolled_back FROM public._prisma_migrations ORDER BY started_at',
    )
    console.log('Migration history:', JSON.stringify(applied.rows))
  }
  const { rows: auth } = await client.query('SELECT count(*)::int AS count FROM auth.users')
  console.log('Existing Auth accounts:', auth[0].count)
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
  const { error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1 })
  if (error) throw new Error('AUTH_ADMIN_CHECK_FAILED')
  console.log('Verified database connectivity and Supabase Auth administrator access.')
} catch (error) {
  console.error(
    'Connection inspection failed:',
    error.code || (error.message === 'AUTH_ADMIN_CHECK_FAILED' ? error.message : error.name),
  )
  process.exitCode = 1
} finally {
  await client.end()
}
