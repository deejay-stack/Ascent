import '../server/env.mjs'
import { randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { db } from '../server/db.mjs'
import { supabaseAdmin } from '../server/supabase.mjs'
import { categories, seedProducts } from '../src/data/grocerySeed.ts'

async function bootstrap(role: 'owner' | 'staff') {
  const prefix = role === 'owner' ? 'ASCENT_OWNER' : 'ASCENT_STAFF'
  const email = process.env[prefix + '_EMAIL'],
    password = process.env[prefix + '_PASSWORD'],
    name = process.env[prefix + '_NAME']
  if (role === 'staff' && !email) return null
  if (!email || !password || password.length < 12 || !name)
    throw new Error(prefix + ' email, name and a password of at least 12 characters are required.')
  let userId: string | undefined
  for (let page = 1; page <= 100; page++) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 100 })
    if (error) throw new Error('Auth account lookup failed.')
    const existing = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
    if (existing) {
      userId = existing.id
      break
    }
    if (data.users.length < 100) break
  }
  if (!userId) {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
    })
    if (error || !data.user)
      throw new Error('Auth account creation failed. Check the configured account fields.')
    userId = data.user.id
  }
  await db.profile.upsert({
    where: { id: userId },
    create: { id: userId, email, name, role },
    update: { name, role, isActive: true },
  })
  return { id: userId, name }
}
try {
  const owner = await bootstrap('owner')
  if (!owner) throw new Error('Owner account is required.')
  await bootstrap('staff')
  const bucket = process.env.SUPABASE_PRODUCT_BUCKET || 'product-images'
  const { data: buckets, error } = await supabaseAdmin.storage.listBuckets()
  if (error) throw new Error('Storage access failed.')
  if (!buckets.some((b) => b.id === bucket)) {
    const { error } = await supabaseAdmin.storage.createBucket(bucket, {
      public: true,
      fileSizeLimit: 2 * 1024 * 1024,
      allowedMimeTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml'],
    })
    if (error) throw new Error('Could not create product image bucket.')
  }
  for (const category of categories)
    await db.category.upsert({ where: { id: category.id }, create: category, update: {} })
  for (const seed of seedProducts) {
    if (await db.product.findUnique({ where: { id: seed.id } })) continue
    const imageName = seed.imageUrl.replace('/images/products/', '')
    const image = await readFile(resolve('public' + seed.imageUrl))
    const { error: uploadError } = await supabaseAdmin.storage
      .from(bucket)
      .upload(imageName, image, { contentType: 'image/svg+xml', upsert: false })
    if (uploadError && uploadError.message !== 'The resource already exists')
      throw new Error('Sample product image upload failed.')
    const imageUrl = supabaseAdmin.storage.from(bucket).getPublicUrl(imageName).data.publicUrl
    await db.$transaction(async (tx) => {
      await tx.product.create({
        data: {
          ...seed,
          imageUrl,
          createdAt: new Date(seed.createdAt),
          updatedAt: new Date(seed.updatedAt),
        },
      })
      if (seed.stockQuantity)
        await tx.inventoryMovement.create({
          data: {
            id: randomUUID(),
            productId: seed.id,
            productName: seed.name,
            type: 'stock-in',
            quantity: seed.stockQuantity,
            before: 0,
            after: seed.stockQuantity,
            reason: 'Initial grocery catalog stock',
            responsibleUser: owner.name,
            actorId: owner.id,
          },
        })
    })
  }
  await db.storeSettings.upsert({
    where: { id: 'store' },
    create: { id: 'store', name: 'ASCENT', address: 'Store address, Philippines' },
    update: {},
  })
  console.log(
    'Seed complete. Existing products and stock were preserved. No passwords or keys are printed.',
  )
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Seed failed.')
  process.exitCode = 1
} finally {
  await db.$disconnect()
}
