import { frontendDir } from '../src/env.mjs'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parse } from 'dotenv'
const frontend = parse(readFileSync(resolve(frontendDir, '.env.local')))
const required = ['SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'DATABASE_URL']
const missing = required.filter((name) => !process.env[name])
if (!process.env.SUPABASE_SECRET_KEY && !process.env.SUPABASE_SERVICE_ROLE_KEY)
  missing.push('SUPABASE_SECRET_KEY')
for (const key of ['VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY'])
  if (!frontend[key]) missing.push('frontend/' + key)
if (missing.length) {
  console.error('Missing configuration: ' + missing.join(', '))
  process.exitCode = 1
} else {
  let db
  try {
    const module = await import('../src/db.mjs')
    db = module.db
    const { supabaseAdmin } = await import('../src/supabase.mjs')
    await db.$queryRaw`SELECT 1`
    const tables =
      await db.$queryRaw`SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public' AND tablename IN ('products','categories','sales','sale_items','payments','orders','order_items','inventory_movements','profiles','store_events','store_settings','newsletter_subscriptions','carts','cart_items','cart_mutations')`
    if (tables.length !== 15 || tables.some((t) => !t.rowsecurity))
      throw new Error(
        'Apply all database migrations; all 15 application tables must have RLS enabled.',
      )
    const { error } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1 })
    if (error) throw new Error('The Supabase server key could not authenticate.')
    const { data: buckets, error: bucketError } = await supabaseAdmin.storage.listBuckets()
    if (
      bucketError ||
      !buckets.some((b) => b.id === (process.env.SUPABASE_PRODUCT_BUCKET || 'product-images'))
    )
      throw new Error('Run the setup seed to create the product image bucket.')
    if (
      process.env.SUPABASE_URL !== frontend.VITE_SUPABASE_URL ||
      process.env.SUPABASE_PUBLISHABLE_KEY !== frontend.VITE_SUPABASE_PUBLISHABLE_KEY
    )
      throw new Error('Frontend and backend Supabase URLs must match.')
    console.log(
      'Verified: PostgreSQL connection, all 15 application tables/RLS, Supabase Auth admin access, matching frontend configuration, and product Storage bucket.',
    )
    const published =
      await db.$queryRaw`SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'store_events'`
    if (!published.length)
      throw new Error('Apply all database migrations to enable Realtime events.')
    const [products, categories, orders, sales, payments, profiles, testAccounts] =
      await Promise.all([
        db.product.count(),
        db.category.count(),
        db.order.count(),
        db.sale.count(),
        db.payment.count(),
        db.profile.count(),
        db.profile.count({ where: { email: { startsWith: 'test-' } } }),
      ])
    console.log(
      'Realtime publication verified. Current record counts:',
      JSON.stringify({ products, categories, orders, sales, payments, profiles, testAccounts }),
    )
    const [authCounts] = await db.$queryRaw`SELECT count(*)::int AS accounts, count(*) FILTER (WHERE email LIKE 'test-%')::int AS test_accounts FROM auth.users`
    console.log('Auth account counts:', JSON.stringify(authCounts))
    const currentRoles = await db.profile.groupBy({ by: ['role', 'requestedRole'], where: { authDeletedAt: null }, _count: true })
    console.log('Current account roles:', JSON.stringify(currentRoles))
  } catch (error) {
    console.error(
      error.message?.includes('Apply all') ||
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
