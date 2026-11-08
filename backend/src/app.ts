import express from 'express'
import type { ErrorRequestHandler } from 'express'
import type { AddressInfo } from 'node:net'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import multer from 'multer'
import { z } from 'zod'
import { randomUUID } from 'node:crypto'
import { resolve } from 'node:path'
import { db, transaction } from './db.ts'
import { frontendDir } from './env.ts'
import { supabaseAdmin } from './supabase.ts'
import { optionalAuth, roles } from './auth.ts'
import { amount, productInput, saleInput, fail } from './validation.ts'
import { cartAction } from './cart-rules.ts'
import { setAccountActive } from './account-access.ts'
import { createProduct } from './products.ts'
import { apiError } from './api-errors.ts'
import { cors, frontendOrigins } from './cors.ts'
import {
  createOrder,
  settleOrder,
  cancelOrder,
  progressOrder,
  simulateOrderPayment,
} from './orders.ts'
import { checkoutInput, checkoutOptions } from './checkout-rules.ts'
import { changeCart, readCart } from './cart.ts'
import {
  snapshot,
  completeSale,
  emit,
  numericProduct,
  numericOrder,
  serialize,
} from './commerce.ts'

export const app = express()
export default app
if (process.env.VERCEL) {
  if (process.env.ASCENT_DATA_MODE !== 'supabase')
    throw new Error(
      'Vercel requires ASCENT_DATA_MODE=supabase; local demo files are not persistent.',
    )
  app.set('trust proxy', 1)
}
app.disable('x-powered-by')
app.use(
  helmet({ contentSecurityPolicy: false, crossOriginEmbedderPolicy: false }),
)
app.use(
  '/api',
  cors(frontendOrigins(process.env.APP_URL, !!process.env.VERCEL), {
    allowSameOrigin: !process.env.VERCEL,
  }),
)
app.use(express.json({ limit: '1mb' }))
app.use(
  '/api',
  rateLimit({
    windowMs: 60000,
    limit: 300,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
  }),
)
app.get('/api/health', async (_req, res) => {
  await db.$queryRaw`SELECT 1`
  res.json({ status: 'ok', mode: 'supabase', database: 'connected' })
})
app.use('/api', optionalAuth)
app.get('/api/snapshot', async (req, res) =>
  res.json(await snapshot(req.actor)),
)
app.get('/api/checkout/options', (_req, res) =>
  res.json({ methods: checkoutOptions() }),
)
app.patch<{ id: string }>(
  '/api/notifications/:id/read',
  roles(),
  async (req, res) => {
    await db.notification.updateMany({
      where: { id: req.params.id, userId: req.actor!.id },
      data: { readAt: new Date() },
    })
    res.json({ ok: true })
  },
)
app.get('/api/cart', roles('customer'), async (req, res) =>
  res.json(await readCart(req.actor!.id)),
)
app.post('/api/cart/actions', roles('customer'), async (req, res) =>
  res.json(await changeCart(cartAction.parse(req.body), req.actor!)),
)
app.get('/api/me', roles(), (req, res) => res.json({ user: req.actor! }))
app.patch('/api/me', roles(), async (req, res) => {
  const fields = z
    .object({ name: z.string().trim().min(2).max(100), email: z.email() })
    .parse(req.body)
  const user = await db.profile.update({
    where: { id: req.actor!.id },
    data: { name: fields.name },
  })
  res.json({ user })
})
app.get('/api/people', roles('owner'), async (_req, res) =>
  res.json({
    users: await db.profile.findMany({
      where: { authDeletedAt: null },
      orderBy: { name: 'asc' },
    }),
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
      create: {
        id: data.user.id,
        name: input.name,
        email: input.email,
        role: 'staff',
      },
      update: { role: 'staff', name: input.name },
    })
    res.status(201).json({ user })
  } catch (error) {
    await supabaseAdmin.auth.admin.deleteUser(data.user.id)
    throw error
  }
})
app.patch<{ id: string }>(
  '/api/people/:id',
  roles('owner'),
  async (req, res) => {
    const { isActive } = z.object({ isActive: z.boolean() }).parse(req.body)
    const user = await transaction(async (tx) => {
      const result = await setAccountActive(
        tx,
        req.actor!.id,
        req.params.id,
        isActive,
      )
      await emit(tx, result.id)
      return result
    })
    res.json({ user })
  },
)
app.post<{ id: string }>(
  '/api/people/:id/access-request',
  roles('owner'),
  async (req, res) => {
    const { approve } = z
      .object({ approve: z.boolean() })
      .strict()
      .parse(req.body)
    const user = await transaction(async (tx) => {
      const person = await tx.profile.findUnique({
        where: { id: req.params.id },
      })
      if (!person?.requestedRole || person.role !== 'customer')
        fail(409, 'No pending access request.')
      if (!person.isActive)
        fail(409, 'Enable the account before approving its access.')
      if (person.id === req.actor!.id)
        fail(403, 'You cannot approve your own access.')
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
  },
)
app.post('/api/products', roles('owner'), async (req, res) => {
  const { requestId, ...input } = productInput
    .extend({ requestId: z.uuid().optional() })
    .parse(req.body)
  const product = await createProduct(input, req.actor!, requestId)
  res.status(201).json({ product: numericProduct(product) })
})
app.patch<{ id: string }>(
  '/api/products/:id',
  roles('owner'),
  async (req, res) => {
    const input = productInput
      .partial()
      .omit({ stockQuantity: true })
      .parse(req.body)
    const product = await transaction(async (tx) => {
      const p = await tx.product.update({
        where: { id: req.params.id },
        data: input,
      })
      await emit(tx)
      return p
    })
    res.json({ product: numericProduct(product) })
  },
)
app.post('/api/categories', roles('owner'), async (req, res) => {
  const input = z
    .object({ name: z.string().trim().min(2).max(100) })
    .parse(req.body)
  const category = await transaction(async (tx) => {
    const c = await tx.category.create({ data: input })
    await emit(tx)
    return c
  })
  res.status(201).json({ category })
})
app.patch<{ id: string }>(
  '/api/categories/:id',
  roles('owner'),
  async (req, res) => {
    const input = z
      .object({ name: z.string().trim().min(2).max(100) })
      .parse(req.body)
    await transaction(async (tx) => {
      await tx.category.update({ where: { id: req.params.id }, data: input })
      await emit(tx)
    })
    res.json({ ok: true })
  },
)
app.delete<{ id: string }>(
  '/api/categories/:id',
  roles('owner'),
  async (req, res) => {
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
  },
)
app.post(
  '/api/inventory/adjustments',
  roles('owner', 'staff'),
  async (req, res) => {
    const input = z
      .object({
        productId: z.string(),
        type: z.enum(['stock-in', 'stock-out', 'adjustment']),
        quantity: z.number().int().nonnegative().max(1000000),
        reason: z.string().trim().min(2).max(500),
        requestId: z.uuid().optional(),
      })
      .parse(req.body)
    if (input.type !== 'adjustment' && !input.quantity)
      fail(400, 'Quantity must be positive.')
    await transaction(async (tx) => {
      const reference = input.requestId ? 'ADJ-' + input.requestId : null
      if (reference) {
        const previous = await tx.inventoryMovement.findFirst({
          where: { reference },
        })
        if (previous) {
          const same =
            previous.actorId === req.actor!.id &&
            previous.productId === input.productId &&
            previous.type === input.type &&
            previous.reason === input.reason &&
            (input.type === 'adjustment'
              ? previous.after === input.quantity
              : Math.abs(previous.quantity) === input.quantity)
          if (!same)
            fail(
              409,
              'Adjustment reference already used with different details.',
            )
          return
        }
      }
      const p = await tx.product.findUnique({ where: { id: input.productId } })
      if (!p) fail(404, 'Product not found.')
      const after =
        input.type === 'adjustment'
          ? input.quantity
          : p.stockQuantity +
            input.quantity * (input.type === 'stock-in' ? 1 : -1)
      if (after < 0 || after === p.stockQuantity)
        fail(
          400,
          'Enter a quantity that changes stock without making it negative.',
        )
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
          responsibleUser: req.actor!.name,
          actorId: req.actor!.id,
          reference,
        },
      })
      await emit(tx)
    })
    res.json({ ok: true })
  },
)
app.post('/api/sales', roles('owner', 'staff'), async (req, res) =>
  res
    .status(201)
    .json({ sale: await completeSale(saleInput.parse(req.body), req.actor!) }),
)
app.post('/api/payments/demo', roles('owner', 'staff'), async (req, res) => {
  if (process.env.ENABLE_PAYMENT_DEMOS !== 'true')
    fail(403, 'Payment demonstrations are disabled.')
  const input = z
    .object({
      transactionId: z.string().min(8),
      method: z.enum(['gcash', 'maya', 'card']),
      total: amount,
    })
    .parse(req.body)
  const payment = await db.payment.create({
    data: { ...input, actorId: req.actor!.id, status: 'pending', isDemo: true },
  })
  res
    .status(201)
    .json({ payment: { ...payment, total: Number(payment!.total) } })
})
app.post<{ id: string }>(
  '/api/payments/:id/simulate',
  roles('owner', 'staff'),
  async (req, res) => {
    if (process.env.ENABLE_PAYMENT_DEMOS !== 'true')
      fail(403, 'Payment demonstrations are disabled.')
    const { outcome } = z
      .object({ outcome: z.enum(['succeeded', 'failed', 'cancelled']) })
      .parse(req.body)
    const changed = await db.payment.updateMany({
      where: {
        id: req.params.id,
        actorId: req.actor!.id,
        status: 'pending',
        isDemo: true,
      },
      data: { status: outcome },
    })
    if (!changed.count) fail(409, 'Payment is no longer pending.')
    const payment = await db.payment.findUnique({
      where: { id: req.params.id },
    })
    res.json({ payment: { ...payment, total: Number(payment!.total) } })
  },
)
app.get('/api/orders', roles(), async (req, res) =>
  res.json({
    orders: serialize(
      (
        await db.order.findMany({
          where:
            req.actor!.role === 'customer' ? { userId: req.actor!.id } : {},
          include: {
            items: true,
            payment: true,
            events: { orderBy: { createdAt: 'asc' } },
          },
          orderBy: { createdAt: 'desc' },
        })
      ).map(numericOrder),
    ),
  }),
)
app.get<{ id: string }>('/api/orders/:id', roles(), async (req, res) => {
  const order = await db.order.findUnique({
    where: { id: req.params.id },
    include: {
      items: true,
      payment: true,
      events: { orderBy: { createdAt: 'asc' } },
    },
  })
  if (
    !order ||
    (req.actor!.role === 'customer' && order.userId !== req.actor!.id)
  )
    fail(404, 'Order not found.')
  res.json({ order: serialize(numericOrder(order)) })
})
app.post('/api/orders', roles('customer'), async (req, res) => {
  const input = checkoutInput.parse(req.body)
  res.status(201).json({ order: await createOrder(input, req.actor!) })
})
app.post<{ id: string }>(
  '/api/orders/:id/settle',
  roles('owner', 'staff'),
  async (req, res) => {
    const input = z
      .object({ amountReceived: amount.optional() })
      .parse(req.body || {})
    res.json({
      sale: await settleOrder(req.params.id, req.actor!, input.amountReceived),
    })
  },
)
app.post<{ id: string }>(
  '/api/orders/:id/demo-payment',
  roles('customer'),
  async (req, res) => {
    const { outcome, eventId } = z
      .object({
        outcome: z.enum(['succeeded', 'failed', 'pending']),
        eventId: z.uuid(),
      })
      .parse(req.body)
    res.json({
      order: await simulateOrderPayment(
        req.params.id,
        req.actor!,
        outcome,
        eventId,
      ),
    })
  },
)
app.post<{ id: string }>(
  '/api/orders/:id/progress',
  roles('owner', 'staff'),
  async (req, res) => {
    const { status } = z
      .object({
        status: z.enum([
          'Preparing',
          'Ready for pickup',
          'Out for delivery',
          'Completed',
        ]),
      })
      .parse(req.body)
    res.json({ order: await progressOrder(req.params.id, req.actor!, status) })
  },
)
app.get<{ id: string }>(
  '/api/orders/:id/receipt',
  roles(),
  async (req, res) => {
    const sale = await db.sale.findUnique({
      where: { orderId: req.params.id },
      include: { items: true, order: true },
    })
    if (
      !sale ||
      (req.actor!.role === 'customer' && sale.order?.userId !== req.actor!.id)
    )
      fail(404, 'Receipt not found.')
    res.json({
      sale: serialize({
        ...sale,
        total: Number(sale.total),
        subtotal: Number(sale.subtotal),
        discount: Number(sale.discount),
        tax: Number(sale.tax),
        amountReceived: Number(sale.amountReceived),
        change: Number(sale.change),
        items: sale.items.map((l) => ({
          ...l,
          unitPrice: Number(l.unitPrice),
          total: Number(l.total),
        })),
      }),
    })
  },
)
app.post<{ id: string }>(
  '/api/orders/:id/cancel',
  roles('owner', 'staff', 'customer'),
  async (req, res) => {
    await cancelOrder(req.params.id, req.actor!)
    res.json({ ok: true })
  },
)
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
app.post(
  '/api/uploads/product',
  roles('owner'),
  upload.single('image'),
  async (req, res) => {
    const file = req.file
    if (
      !file ||
      !['image/png', 'image/jpeg', 'image/webp'].includes(file.mimetype)
    )
      fail(400, 'Choose a PNG, JPEG or WebP under 2 MB.')
    const b = file.buffer
    const valid =
      file.mimetype === 'image/png'
        ? b
            .subarray(0, 8)
            .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
        : file.mimetype === 'image/jpeg'
          ? b[0] === 255 && b[1] === 216 && b[2] === 255
          : b.toString('ascii', 0, 4) === 'RIFF' &&
            b.toString('ascii', 8, 12) === 'WEBP'
    if (!valid) fail(400, 'The file does not match its image format.')
    const key =
      randomUUID() +
      '.' +
      { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' }[
        file.mimetype
      ]
    const bucket = process.env.SUPABASE_PRODUCT_BUCKET || 'product-images'
    const { error } = await supabaseAdmin.storage
      .from(bucket)
      .upload(key, b, { contentType: file.mimetype, upsert: false })
    if (error) fail(502, 'Image storage upload failed.')
    res.json({
      imageUrl: supabaseAdmin.storage.from(bucket).getPublicUrl(key).data
        .publicUrl,
    })
  },
)
app.post(
  '/api/newsletter',
  rateLimit({ windowMs: 60000, limit: 5 }),
  async (req, res) => {
    const { email } = z
      .object({ email: z.email().transform((s) => s.toLowerCase()) })
      .parse(req.body)
    await db.newsletterSubscription.upsert({
      where: { email },
      create: { email },
      update: {},
    })
    res.json({ message: 'Your subscription has been saved.' })
  },
)
app.use('/api', (_req, res) =>
  res.status(404).json({ message: 'API route not found.' }),
)
if (!process.env.VERCEL) {
  app.use(express.static(resolve(frontendDir, 'dist')))
  app.get('/{*path}', (_req, res) =>
    res.sendFile(resolve(frontendDir, 'dist/index.html')),
  )
} else {
  app.use((_req, res) =>
    res.status(404).json({ message: 'API route not found.' }),
  )
}
const handleError: ErrorRequestHandler = (error: unknown, req, res, next) => {
  if (res.headersSent) return next(error)
  const { status, message } = apiError(error)
  if (status >= 500)
    console.error(
      'API operation failed:',
      req.method,
      req.path,
      status,
      (error as { code?: string; name?: string }).code ||
        (error as { name?: string }).name,
    )
  res.status(status).json({ message })
}
app.use(handleError)
export async function start() {
  const server = app.listen(Number(process.env.PORT || 4174), () =>
    console.log(
      'ASCENT Express API listening on port ' +
        (server.address() as AddressInfo).port +
        '.',
    ),
  )
  // A temporary database outage must not terminate the API and its Vite proxy.
  // Health requests report readiness; the pool reconnects on subsequent requests.
  void db.$queryRaw`SELECT 1`
    .then(() => console.log('PostgreSQL connection verified.'))
    .catch((error) =>
      console.error(
        'PostgreSQL is temporarily unavailable:',
        error.code || error.name,
      ),
    )
  const stop = () =>
    server.close(() => {
      void db.$disconnect()
    })
  process.on('SIGTERM', stop)
  process.on('SIGINT', stop)
  return server
}
