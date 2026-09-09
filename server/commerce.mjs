import { randomUUID } from 'node:crypto'
import { db, transaction } from './db.mjs'
import { cents, fail, mergeItems, totals } from './validation.mjs'

export const serialize = (value) => JSON.parse(JSON.stringify(value))
export const numericProduct = (p) => ({
  ...p,
  costPrice: Number(p.costPrice),
  sellingPrice: Number(p.sellingPrice),
})
export const numericSale = (s) => ({
  ...s,
  subtotal: Number(s.subtotal),
  discount: Number(s.discount),
  tax: Number(s.tax),
  total: Number(s.total),
  amountReceived: Number(s.amountReceived),
  change: Number(s.change),
  items: s.items.map((l) => ({ ...l, unitPrice: Number(l.unitPrice), total: Number(l.total) })),
})
export const numericOrder = (o) => ({
  ...o,
  subtotal: Number(o.subtotal),
  total: Number(o.total),
  items: o.items.map((l) => ({ ...l, price: Number(l.price), lineTotal: Number(l.lineTotal) })),
})
export async function emit(tx, audienceId = null) {
  await tx.storeEvent.create({ data: { scope: 'catalog' } })
  if (audienceId) await tx.storeEvent.create({ data: { scope: 'customer', audienceId } })
}
export async function settings(tx = db) {
  return tx.storeSettings.upsert({ where: { id: 'store' }, create: { id: 'store' }, update: {} })
}
export async function snapshot(actor) {
  const operator = actor && ['owner', 'staff'].includes(actor.role)
  const [products, categories, store, sales, movements, orders] = await db.$transaction(
    async (tx) =>
      Promise.all([
        tx.product.findMany({
          where: operator ? {} : { isArchived: false },
          orderBy: { createdAt: 'asc' },
        }),
        tx.category.findMany({ orderBy: { name: 'asc' } }),
        tx.storeSettings.findUniqueOrThrow({ where: { id: 'store' } }),
        operator
          ? tx.sale.findMany({ include: { items: true }, orderBy: { createdAt: 'desc' } })
          : [],
        operator ? tx.inventoryMovement.findMany({ orderBy: { createdAt: 'desc' } }) : [],
        actor
          ? tx.order.findMany({
              where: operator ? {} : { userId: actor.id },
              include: { items: true },
              orderBy: { createdAt: 'desc' },
            })
          : [],
      ]),
    { isolationLevel: 'RepeatableRead' },
  )
  return serialize({
    products: products.map((p) => {
      const row = numericProduct(p)
      if (actor?.role !== 'owner') delete row.costPrice
      return row
    }),
    categories,
    settings: { name: store.name, address: store.address, taxRate: Number(store.taxRate) },
    sales: sales.map(numericSale),
    movements,
    orders: orders.map(numericOrder),
  })
}
export async function lockAndDeduct(tx, requested, actor, type, reason, reference) {
  const lines = []
  for (const item of mergeItems(requested)) {
    const p = await tx.product.findUnique({ where: { id: item.productId } })
    if (!p || p.isArchived || !p.isAvailable) fail(409, 'A product is no longer available.')
    const result = await tx.product.updateMany({
      where: {
        id: p.id,
        isArchived: false,
        isAvailable: true,
        stockQuantity: { gte: item.quantity },
        updatedAt: p.updatedAt,
      },
      data: { stockQuantity: { decrement: item.quantity } },
    })
    if (!result.count)
      fail(409, `${p.name}: insufficient stock or product changed. Refresh the bill.`)
    await tx.inventoryMovement.create({
      data: {
        productId: p.id,
        productName: p.name,
        type,
        quantity: -item.quantity,
        before: p.stockQuantity,
        after: p.stockQuantity - item.quantity,
        reason,
        responsibleUser: actor.name,
        actorId: actor.id,
        reference,
      },
    })
    lines.push({ product: p, quantity: item.quantity })
  }
  return lines
}
export async function completeSale(input, actor) {
  try {
    const sale = await transaction(async (tx) => {
      const existing = await tx.sale.findUnique({
        where: { id: input.transactionId },
        include: { items: true },
      })
      if (existing) {
        if (existing.cashierId !== actor.id) fail(409, 'Transaction number already used.')
        return existing
      }
      const lines = await lockAndDeduct(
        tx,
        input.items,
        actor,
        'sale',
        'POS sale',
        input.transactionId,
      )
      const store = await settings(tx)
      const bill = totals(
        lines.map((l) => ({ price: l.product.sellingPrice, quantity: l.quantity })),
        input.discount,
        input.taxRate,
      )
      const received =
        input.paymentMethod === 'cash' ? cents(input.amountReceived) : cents(bill.total)
      if (received < cents(bill.total)) fail(400, 'Insufficient cash received.')
      let payment
      if (input.paymentMethod === 'cash')
        payment = await tx.payment.create({
          data: {
            transactionId: input.transactionId,
            actorId: actor.id,
            method: 'cash',
            total: bill.total,
            status: 'succeeded',
            isDemo: false,
          },
        })
      else {
        payment = await tx.payment.findUnique({ where: { id: input.paymentId || '' } })
        if (
          !payment ||
          payment.actorId !== actor.id ||
          payment.transactionId !== input.transactionId ||
          payment.method !== input.paymentMethod ||
          payment.status !== 'succeeded' ||
          cents(payment.total) !== cents(bill.total)
        )
          fail(409, 'Successful matching payment confirmation is required.')
      }
      const sale = await tx.sale.create({
        data: {
          ...bill,
          id: input.transactionId,
          receiptNumber: 'RCP-' + randomUUID(),
          storeName: store.name,
          storeAddress: store.address,
          cashier: actor.name,
          cashierId: actor.id,
          source: 'pos',
          paymentMethod: input.paymentMethod,
          amountReceived: received / 100,
          change: (received - cents(bill.total)) / 100,
          paymentId: payment.id,
          items: {
            create: lines.map(({ product: p, quantity }) => ({
              productId: p.id,
              name: p.name,
              categoryId: p.categoryId,
              unit: p.unit,
              imageUrl: p.imageUrl,
              quantity,
              unitPrice: p.sellingPrice,
              total: (cents(p.sellingPrice) * quantity) / 100,
            })),
          },
        },
        include: { items: true },
      })
      await emit(tx)
      return sale
    })
    return serialize(numericSale(sale))
  } catch (error) {
    if (error.code === 'P2002') {
      const existing = await db.sale.findUnique({
        where: { id: input.transactionId },
        include: { items: true },
      })
      if (existing?.cashierId === actor.id) return serialize(numericSale(existing))
    }
    throw error
  }
}
export async function createOrder(requested, fulfillment, actor, orderId) {
  const order = await transaction(async (tx) => {
    const existing = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } })
    if (existing) {
      if (existing.userId !== actor.id) fail(409, 'Order reference already used.')
      return existing
    }
    const lines = await lockAndDeduct(
      tx,
      requested,
      actor,
      'order',
      'Reserved for customer order',
      orderId,
    )
    const bill = totals(
      lines.map((l) => ({ price: l.product.sellingPrice, quantity: l.quantity })),
      0,
      0,
    )
    const order = await tx.order.create({
      data: {
        id: orderId,
        userId: actor.id,
        fulfillment: fulfillment === 'delivery' ? 'Delivery' : 'Store pickup',
        subtotal: bill.subtotal,
        total: bill.total,
        items: {
          create: lines.map(({ product: p, quantity }) => ({
            productId: p.id,
            name: p.name,
            price: p.sellingPrice,
            unit: p.unit,
            quantity,
            lineTotal: (cents(p.sellingPrice) * quantity) / 100,
          })),
        },
      },
      include: { items: true },
    })
    await emit(tx, actor.id)
    return order
  })
  return serialize(numericOrder(order))
}
export async function settleOrder(orderId, actor) {
  return transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: { include: { product: true } } },
    })
    if (!order || order.status !== 'Awaiting payment')
      fail(409, 'Order is no longer awaiting payment.')
    const updated = await tx.order.updateMany({
      where: { id: orderId, status: 'Awaiting payment' },
      data: { status: 'Completed' },
    })
    if (!updated.count) fail(409, 'Order was already processed.')
    const store = await settings(tx),
      saleId = 'ASC-' + randomUUID()
    const payment = await tx.payment.create({
      data: {
        transactionId: saleId,
        actorId: actor.id,
        method: 'cash',
        status: 'succeeded',
        total: order.total,
        isDemo: false,
      },
    })
    const sale = await tx.sale.create({
      data: {
        id: saleId,
        receiptNumber: 'RCP-' + randomUUID(),
        storeName: store.name,
        storeAddress: store.address,
        cashier: actor.name,
        cashierId: actor.id,
        source: 'online',
        subtotal: order.subtotal,
        discount: 0,
        tax: 0,
        total: order.total,
        paymentMethod: 'cash',
        amountReceived: order.total,
        change: 0,
        paymentId: payment.id,
        orderId,
        items: {
          create: order.items.map((l) => ({
            productId: l.productId,
            name: l.name,
            categoryId: l.product.categoryId,
            unit: l.unit,
            imageUrl: l.product.imageUrl,
            quantity: l.quantity,
            unitPrice: l.price,
            total: l.lineTotal,
          })),
        },
      },
      include: { items: true },
    })
    await emit(tx, order.userId)
    return serialize(numericSale(sale))
  })
}
export async function cancelOrder(orderId, actor) {
  return transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId }, include: { items: true } })
    if (!order || order.status !== 'Awaiting payment') fail(409, 'Order cannot be cancelled.')
    const updated = await tx.order.updateMany({
      where: { id: orderId, status: 'Awaiting payment' },
      data: { status: 'Cancelled' },
    })
    if (!updated.count) fail(409, 'Order was already processed.')
    for (const line of order.items.toSorted((a, b) => a.productId.localeCompare(b.productId))) {
      const p = await tx.product.update({
        where: { id: line.productId },
        data: { stockQuantity: { increment: line.quantity } },
      })
      await tx.inventoryMovement.create({
        data: {
          productId: p.id,
          productName: p.name,
          type: 'stock-in',
          quantity: line.quantity,
          before: p.stockQuantity - line.quantity,
          after: p.stockQuantity,
          reason: 'Cancelled order reservation',
          responsibleUser: actor.name,
          actorId: actor.id,
          reference: order.id,
        },
      })
    }
    await emit(tx, order.userId)
  })
}
