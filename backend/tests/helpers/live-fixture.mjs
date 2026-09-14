import '../../src/env.mjs'
import { randomUUID } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { db } from '../../src/db.mjs'
import { supabaseAdmin } from '../../src/supabase.mjs'

export async function liveFixture() {
  const run = 'test-' + randomUUID().slice(0, 8)
  const accounts = {}
  const accountIds = []
  const uploadedKeys = []
  const originalSettings = await db.storeSettings.findUnique({ where: { id: 'store' } })
  async function account(label, role) {
    const email = `${run}-${label}@example.com`
    const password = 'Test-' + randomUUID() + '-aA9!'
    const name = `${run} ${label}`
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
    })
    if (error || !data.user)
      throw new Error('Test account setup failed: ' + (error?.code || 'missing user'))
    accountIds.push(data.user.id)
    await db.profile.upsert({
      where: { id: data.user.id },
      create: { id: data.user.id, email, name, role },
      update: { role, name },
    })
    const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const signed = await client.auth.signInWithPassword({ email, password })
    if (signed.error || !signed.data.session)
      throw new Error('Test account sign-in failed: ' + (signed.error?.code || 'missing session'))
    accounts[label] = {
      id: data.user.id,
      role,
      email,
      password,
      name,
      token: signed.data.session.access_token,
      client,
    }
    return accounts[label]
  }
  async function cleanup() {
    // Cleanup is restricted to accounts and categories belonging to this run.
    const categories = await db.category.findMany({
      where: { name: { startsWith: run } },
      select: { id: true },
    })
    const extraAccounts = await db.profile.findMany({
      where: { email: { startsWith: run + '-' } },
      select: { id: true },
    })
    for (const account of extraAccounts)
      if (!accountIds.includes(account.id)) accountIds.push(account.id)
    const products = await db.product.findMany({
      where: {
        OR: [
          { categoryId: { in: categories.map((c) => c.id) } },
          { name: { startsWith: run + ' ' }, description: 'Live browser system test product' },
        ],
      },
      select: { id: true },
    })
    const productIds = products.map((p) => p.id)
    await db.$transaction(
      async (tx) => {
        await tx.saleItem.deleteMany({ where: { sale: { cashierId: { in: accountIds } } } })
        await tx.sale.deleteMany({ where: { cashierId: { in: accountIds } } })
        await tx.orderItem.deleteMany({ where: { order: { userId: { in: accountIds } } } })
        await tx.order.deleteMany({ where: { userId: { in: accountIds } } })
        await tx.payment.deleteMany({ where: { actorId: { in: accountIds } } })
        await tx.inventoryMovement.deleteMany({ where: { actorId: { in: accountIds } } })
        await tx.cart.deleteMany({ where: { userId: { in: accountIds } } })
        await tx.cartMutation.deleteMany({ where: { userId: { in: accountIds } } })
        await tx.product.deleteMany({ where: { id: { in: productIds } } })
        await tx.category.deleteMany({ where: { id: { in: categories.map((c) => c.id) } } })
        await tx.newsletterSubscription.deleteMany({ where: { email: { startsWith: run + '-' } } })
        await tx.storeEvent.deleteMany({ where: { audienceId: { in: accountIds } } })
        await tx.profile.deleteMany({ where: { id: { in: accountIds } } })
        if (originalSettings)
          await tx.storeSettings.update({
            where: { id: 'store' },
            data: {
              name: originalSettings.name,
              address: originalSettings.address,
              taxRate: originalSettings.taxRate,
            },
          })
      },
      { timeout: 30000 },
    )
    for (const id of accountIds) {
      for (let attempt = 0; attempt < 3; attempt++) {
        const { error } = await supabaseAdmin.auth.admin.deleteUser(id)
        if (!error || error.status === 404) break
        if (attempt === 2)
          throw new Error(
            'Could not clean up test Auth account: ' + (error.code || error.status || error.name),
          )
        await new Promise((resolve) => setTimeout(resolve, 500))
      }
    }
    if (uploadedKeys.length) {
      const { error } = await supabaseAdmin.storage
        .from(process.env.SUPABASE_PRODUCT_BUCKET || 'product-images')
        .remove(uploadedKeys)
      if (error) throw new Error('Could not clean up test image.')
    }
    for (const value of Object.values(accounts)) await value.client.removeAllChannels()
  }
  return { run, accounts, accountIds, uploadedKeys, account, cleanup, db, admin: supabaseAdmin }
}
