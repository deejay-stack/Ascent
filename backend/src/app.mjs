import express from 'express'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import multer from 'multer'
import { z } from 'zod'
import { randomUUID } from 'node:crypto'
import { resolve } from 'node:path'
import { db, transaction } from './db.mjs'
import { frontendDir } from './env.mjs'
import { supabaseAdmin } from './supabase.mjs'
import { optionalAuth, roles } from './auth.mjs'
import { amount, items, productInput, saleInput, fail } from './validation.mjs'
import { cartAction } from './cart-rules.mjs'
import { setAccountActive } from './account-access.mjs'
import { changeCart, readCart } from './cart.mjs'
import {
  snapshot,
  completeSale,
  createOrder,
  settleOrder,
  cancelOrder,
  emit,
  numericProduct,
  numericOrder,
  serialize,
} from './commerce.mjs'

export const app = express()
app.disable('x-powered-by')
app.use(helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }))
app.use(express.json({ limit: '1mb' }))
app.use(
  '/api',
  rateLimit({ windowMs: 60000, limit: 300, standardHeaders: 'draft-8', legacyHeaders: false }),
)
app.get('/api/health', async (_req, res) => {
  await db.$queryRaw`SELECT 1`
  res.json({ status: 'ok', mode: 'supabase', database: 'connected' })
})
app.use('/api', optionalAuth)
app.get('/api/snapshot', async (req, res) => res.json(await snapshot(req.actor)))
app.get('/api/cart', roles('customer'), async (req, res) => res.json(await readCart(req.actor.id)))
app.post('/api/cart/actions', roles('customer'), async (req, res) =>
  res.json(await changeCart(cartAction.parse(req.body), req.actor)),
)
app.get('/api/me', roles(), (req, res) => res.json({ user: req.actor }))
app.patch('/api/me', roles(), async (req, res) => {
  const fields = z
    .object({ name: z.string().trim().min(2).max(100), email: z.email() })
    .parse(req.body)
  const user = await db.profile.update({ where: { id: req.actor.id }, data: { name: fields.name } })
  res.json({ user })
})
app.get('/api/people', roles('owner'), async (_req, res) =>
  res.json({
    users: await db.profile.findMany({ where: { authDeletedAt: null }, orderBy: { name: 'asc' } }),
  }),
)
app.post('/api/people', roles('owner'), async (req, res) => {
  const input = z
    .object({
      name: z.string().trim().min(2).max(100),
      email: z.email(),
      password: z.string().min(12).max(128),
    })
    .parse(req.body)
  const { data, error } = await supabaseAdmin.auth.admin.createUser({
    email: input.email,
    password: input.password,
    email_confirm: true,
    user_metadata: { name: input.name },
  })
  if (error) fail(400, error.message)
  try {
    const user = await db.profile.upsert({
      where: { id: data.user.id },
      create: { id: data.user.id, name: input.name, email: input.email, role: 'staff' },
      update: { role: 'staff', name: input.name },
    })
    res.status(201).json({ user })
  } catch (error) {
    await supabaseAdmin.auth.admin.deleteUser(data.user.id)
    throw error
  }
})
app.patch('/api/people/:id', roles('owner'), async (req, res) => {
  const { isActive } = z.object({ isActive: z.boolean() }).parse(req.body)
  const user = await transaction(async (tx) => {
    const result = await setAccountActive(tx, req.actor.id, req.params.id, isActive)
    await emit(tx, result.id)
    return result
  })
  res.json({ user })
})
app.post('/api/people/:id/access-request', roles('owner'), async (req, res) => {
  const { approve } = z.object({ approve: z.boolean() }).strict().parse(req.body)
  const user = await transaction(async (tx) => {
    const person = await tx.profile.findUnique({ where: { id: req.params.id } })
    if (!person?.requestedRole || person.role !== 'customer')
      fail(409, 'No pending access request.')
    if (!person.isActive) fail(409, 'Enable the account before approving its access.')
    if (person.id === req.actor.id) fail(403, 'You cannot approve your own access.')
    const result = await tx.profile.update({
      where: { id: person.id },
      data: {
        role: approve ? person.requestedRole : person.role,
        requestedRole: null,
      },
    })
    await emit(tx, person.id)
    return result
  })
  res.json({ user })
})
app.post('/api/products', roles('owner'), async (req, res) => {
  const input = productInput.parse(req.body)
  const product = await transaction(async (tx) => {
    const p = await tx.product.create({
      data: {
        ...input,
        slug: input.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + randomUUID().slice(0, 8),
      },
    })
    if (p.stockQuantity)
      await tx.inventoryMovement.create({
        data: {
          productId: p.id,
          productName: p.name,
          type: 'stock-in',
          quantity: p.stockQuantity,
          before: 0,
          after: p.stockQuantity,
          reason: 'Opening stock for new product',
          responsibleUser: req.actor.name,
          actorId: req.actor.id,
        },
      })
    await emit(tx)
    return p
  })
  res.status(201).json({ product: numericProduct(product) })
})
app.patch('/api/products/:id', roles('owner'), async (req, res) => {
  const input = productInput.partial().omit({ stockQuantity: true }).parse(req.body)
  const product = await transaction(async (tx) => {
    const p = await tx.product.update({ where: { id: req.params.id }, data: input })
    await emit(tx)
    return p
  })
  res.json({ product: numericProduct(product) })
})
app.post('/api/categories', roles('owner'), async (req, res) => {
  const input = z.object({ name: z.string().trim().min(2).max(100) }).parse(req.body)
  const category = await transaction(async (tx) => {
    const c = await tx.category.create({ data: input })
    await emit(tx)
    return c
  })
  res.status(201).json({ category })
})
app.patch('/api/categories/:id', roles('owner'), async (req, res) => {
  const input = z.object({ name: z.string().trim().min(2).max(100) }).parse(req.body)
  await transaction(async (tx) => {
    await tx.category.update({ where: { id: req.params.id }, data: input })
    await emit(tx)
  })
  res.json({ ok: true })
})
app.delete('/api/categories/:id', roles('owner'), async (req, res) => {
  await transaction(async (tx) => {
    if (
      (await tx.product.count({ where: { categoryId: req.params.id } })) ||
      (await tx.saleItem.count({ where: { categoryId: req.params.id } }))
    )
      fail(409, 'This category is used by products or sales history.')
    await tx.category.delete({ where: { id: req.params.id } })
    await emit(tx)
  })
  res.json({ ok: true })
})
app.post('/api/inventory/adjustments', roles('owner', 'staff'), async (req, res) => {
  const input = z
    .object({
      productId: z.string(),
      type: z.enum(['stock-in', 'stock-out', 'adjustment']),
      quantity: z.number().int().nonnegative().max(1000000),
      reason: z.string().trim().min(2).max(500),
    })
    .parse(req.body)
  if (input.type !== 'adjustment' && !input.quantity) fail(400, 'Quantity must be positive.')
  await transaction(async (tx) => {
    const p = await tx.product.findUnique({ where: { id: input.productId } })
    if (!p) fail(404, 'Product not found.')
    const after =
      input.type === 'adjustment'
        ? input.quantity
        : p.stockQuantity + input.quantity * (input.type === 'stock-in' ? 1 : -1)
    if (after < 0 || after === p.stockQuantity)
      fail(400, 'Enter a quantity that changes stock without making it negative.')
    const changed = await tx.product.updateMany({
      where: { id: p.id, updatedAt: p.updatedAt },
      data: { stockQuantity: after },
    })
    if (!changed.count) fail(409, 'Stock changed. Please refresh and retry.')
    await tx.inventoryMovement.create({
      data: {
        productId: p.id,
        productName: p.name,
        type: input.type,
        quantity: after - p.stockQuantity,
        before: p.stockQuantity,
        after,
        reason: input.reason,
        responsibleUser: req.actor.name,
        actorId: req.actor.id,
      },
    })
    await emit(tx)
  })
  res.json({ ok: true })
})
app.post('/api/sales', roles('owner', 'staff'), async (req, res) =>
  res.status(201).json({ sale: await completeSale(saleInput.parse(req.body), req.actor) }),
)
app.post('/api/payments/demo', roles('owner', 'staff'), async (req, res) => {
  if (process.env.ENABLE_PAYMENT_DEMOS !== 'true') fail(403, 'Payment demonstrations are disabled.')
  const input = z
    .object({
      transactionId: z.string().min(8),
      method: z.enum(['gcash', 'maya', 'card']),
      total: amount,
    })
    .parse(req.body)
  const payment = await db.payment.create({
    data: { ...input, actorId: req.actor.id, status: 'pending', isDemo: true },
  })
  res.status(201).json({ payment: { ...payment, total: Number(payment.total) } })
})
app.post('/api/payments/:id/simulate', roles('owner', 'staff'), async (req, res) => {
  if (process.env.ENABLE_PAYMENT_DEMOS !== 'true') fail(403, 'Payment demonstrations are disabled.')
  const { outcome } = z
    .object({ outcome: z.enum(['succeeded', 'failed', 'cancelled']) })
    .parse(req.body)
  const changed = await db.payment.updateMany({
    where: { id: req.params.id, actorId: req.actor.id, status: 'pending', isDemo: true },
    data: { status: outcome },
  })
  if (!changed.count) fail(409, 'Payment is no longer pending.')
  const payment = await db.payment.findUnique({ where: { id: req.params.id } })
  res.json({ payment: { ...payment, total: Number(payment.total) } })
})
app.get('/api/orders', roles(), async (req, res) =>
  res.json({
    orders: serialize(
      (
        await db.order.findMany({
          where: req.actor.role === 'customer' ? { userId: req.actor.id } : {},
          include: { items: true },
          orderBy: { createdAt: 'desc' },
        })
      ).map(numericOrder),
    ),
  }),
)
app.post('/api/orders', roles('customer'), async (req, res) => {
  const input = z
    .object({
      items,
      fulfillment: z.enum(['pickup', 'delivery']),
      orderId: z.string().min(8).max(100),
    })
    .parse(req.body)
  res
    .status(201)
    .json({ order: await createOrder(input.items, input.fulfillment, req.actor, input.orderId) })
})
app.post('/api/orders/:id/settle', roles('owner', 'staff'), async (req, res) =>
  res.json({ sale: await settleOrder(req.params.id, req.actor) }),
)
app.post('/api/orders/:id/cancel', roles('owner', 'staff'), async (req, res) => {
  await cancelOrder(req.params.id, req.actor)
  res.json({ ok: true })
})
app.patch('/api/settings', roles('owner'), async (req, res) => {
  const input = z
    .object({
      name: z.string().trim().min(2).max(100),
      address: z.string().trim().min(2).max(500),
      taxRate: z.number().min(0).max(100),
    })
    .parse(req.body)
  await transaction(async (tx) => {
    await tx.storeSettings.upsert({
      where: { id: 'store' },
      create: { id: 'store', ...input },
      update: input,
    })
    await emit(tx)
  })
  res.json({ ok: true })
})
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 1 },
})
app.post('/api/uploads/product', roles('owner'), upload.single('image'), async (req, res) => {
  const file = req.file
  if (!file || !['image/png', 'image/jpeg', 'image/webp'].includes(file.mimetype))
    fail(400, 'Choose a PNG, JPEG or WebP under 2 MB.')
  const b = file.buffer
  const valid =
    file.mimetype === 'image/png'
      ? b.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
      : file.mimetype === 'image/jpeg'
        ? b[0] === 255 && b[1] === 216 && b[2] === 255
        : b.toString('ascii', 0, 4) === 'RIFF' && b.toString('ascii', 8, 12) === 'WEBP'
  if (!valid) fail(400, 'The file does not match its image format.')
  const key =
    randomUUID() +
    '.' +
    { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }[file.mimetype]
  const bucket = process.env.SUPABASE_PRODUCT_BUCKET || 'product-images'
  const { error } = await supabaseAdmin.storage
    .from(bucket)
    .upload(key, b, { contentType: file.mimetype, upsert: false })
  if (error) fail(502, 'Image storage upload failed.')
  res.json({ imageUrl: supabaseAdmin.storage.from(bucket).getPublicUrl(key).data.publicUrl })
})
app.post('/api/newsletter', rateLimit({ windowMs: 60000, limit: 5 }), async (req, res) => {
  const { email } = z.object({ email: z.email().transform((s) => s.toLowerCase()) }).parse(req.body)
  await db.newsletterSubscription.upsert({ where: { email }, create: { email }, update: {} })
  res.json({ message: 'Your subscription has been saved.' })
})
app.use('/api', (_req, res) => res.status(404).json({ message: 'API route not found.' }))
app.use(express.static(resolve(frontendDir, 'dist')))
app.get('/{*path}', (_req, res) => res.sendFile(resolve(frontendDir, 'dist/index.html')))
app.use((error, _req, res, _next) => {
  const status =
    error instanceof z.ZodError
      ? 400
      : error.status ||
        (['P2002', 'P2003', 'P2034'].includes(error.code)
          ? 409
          : error.code === 'P2025'
            ? 404
            : 500)
  const message =
    error instanceof z.ZodError
      ? error.issues.map((i) => i.path.join('.') + ': ' + i.message).join('; ')
      : error.status
        ? error.message
        : error.code === 'P2002'
          ? 'This SKU, barcode, category or account already exists.'
          : error.code === 'P2003'
            ? 'This record is still used elsewhere.'
            : error.code === 'P2025'
              ? 'Record not found.'
              : 'The operation could not be completed. Please try again.'
  if (status === 500) console.error('API operation failed:', error.code || error.name)
  res.status(status).json({ message })
})
export async function start() {
  await db.$queryRaw`SELECT 1`
  const server = app.listen(Number(process.env.PORT || 4174), () =>
    console.log('ASCENT Express API connected to PostgreSQL.'),
  )
  const stop = () =>
    server.close(() => {
      void db.$disconnect()
    })
  process.on('SIGTERM', stop)
  process.on('SIGINT', stop)
  return server
}
