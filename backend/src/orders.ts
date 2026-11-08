import type { Prisma } from '@prisma/client'
import type { z } from 'zod'
import type { checkoutInput } from './checkout-rules.ts'
import type { Actor, Transaction, PayableOrder } from './types.ts'
import { createHash, randomUUID } from 'node:crypto'
import { db, transaction } from './db.ts'
import { cents, totals, fail, mergeItems } from './validation.ts'
import {
  lockAndDeduct,
  settings,
  serialize,
  numericOrder,
  numericSale,
} from './commerce.ts'
import { checkoutOptions, validateProgress } from './checkout-rules.ts'
import { orderEvent } from './order-events.ts'

const details = {
  items: true,
  payment: true,
  events: { orderBy: { createdAt: 'asc' } },
} satisfies Prisma.OrderInclude
export async function createOrder(
  input: z.infer<typeof checkoutInput>,
  actor: Actor,
) {
  const hash = createHash('sha256')
    .update(JSON.stringify({ ...input, items: mergeItems(input.items) }))
    .digest('hex')
  const operation = async (tx: Transaction) => {
    const existing = await tx.order.findUnique({
      where: { id: input.orderId },
      include: details,
    })
    if (existing) {
      if (existing.userId !== actor.id || existing.requestHash !== hash)
        fail(409, 'Order reference already used with different details.')
      return existing
    }
    if (input.cartVersion !== undefined) {
      const cart = await tx.cart.findUnique({ where: { userId: actor.id } })
      if (!cart || cart.version !== input.cartVersion)
        fail(
          409,
          'Your cart changed or was already checked out. Refresh and review your orders before trying again.',
        )
    }
    if (!checkoutOptions().find((m) => m.id === input.paymentMethod)?.available)
      fail(409, 'This payment method is unavailable. Choose another method.')
    const lines = await lockAndDeduct(
      tx,
      input.items,
      actor,
      'order',
      'Reserved for customer order',
      input.orderId,
    )
    const bill = totals(
      lines.map((l) => ({
        price: l.product.sellingPrice,
        quantity: l.quantity,
      })),
      0,
      0,
    )
    if (
      input.expectedTotal !== undefined &&
      cents(input.expectedTotal) !== cents(bill.total)
    )
      fail(
        409,
        'Prices changed. Refresh your cart and review the new total before confirming.',
      )
    const isCash = ['cash', 'cod'].includes(input.paymentMethod)
    if (bill.total <= 0 && !isCash)
      fail(400, 'Digital checkout requires a positive total.')
    const isDemo = !isCash
    const payment = await tx.payment.create({
      data: {
        transactionId: 'ASC-' + randomUUID(),
        actorId: actor.id,
        method: isCash ? 'cash' : input.paymentMethod,
        status: 'pending',
        total: bill.total,
        isDemo,
        provider: isDemo
          ? 'demo'
          : input.paymentMethod === 'cod'
            ? 'cash_on_delivery'
            : 'counter',
        checkoutUrl: isDemo
          ? '/checkout/' + encodeURIComponent(input.orderId)
          : null,
      },
    })
    const order = await tx.order.create({
      data: {
        id: input.orderId,
        userId: actor.id,
        fulfillment:
          input.fulfillment === 'delivery' ? 'Delivery' : 'Store pickup',
        subtotal: bill.subtotal,
        total: bill.total,
        requestHash: hash,
        paymentId: payment.id,
        paymentMethod: input.paymentMethod,
        contactName: input.contactName,
        contactPhone: input.contactPhone,
        deliveryAddress: input.deliveryAddress,
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
      include: details,
    })
    await orderEvent(
      tx,
      order,
      `Order received. Awaiting ${input.paymentMethod === 'cod' ? 'cash collection on delivery' : input.paymentMethod === 'cash' ? 'counter payment' : input.paymentMethod + ' demo payment'}.`,
      actor.name,
    )
    await tx.cartItem.deleteMany({ where: { userId: actor.id } })
    await tx.cart.updateMany({
      where: { userId: actor.id },
      data: { version: { increment: 1 } },
    })
    return tx.order.findUnique({ where: { id: order.id }, include: details })
  }
  try {
    return serialize(numericOrder((await transaction(operation))!))
  } catch (error) {
    if ((error as { code?: string }).code === 'P2002') {
      const existing = await db.order.findUnique({
        where: { id: input.orderId },
        include: details,
      })
      if (existing?.userId === actor.id && existing.requestHash === hash)
        return serialize(numericOrder(existing))
    }
    throw error
  }
}

async function recordPayment(
  tx: Transaction,
  order: PayableOrder,
  actor: Actor | null,
  amountReceived: number,
) {
  const existing = await tx.sale.findUnique({
    where: { orderId: order.id },
    include: { items: true },
  })
  if (existing) return existing
  const cod = order.paymentMethod === 'cod'
  if (order.status !== (cod ? 'Out for delivery' : 'Awaiting payment'))
    fail(
      409,
      cod
        ? 'Collect COD cash only when the order is out for delivery.'
        : 'This order cannot receive payment.',
    )
  if (cents(amountReceived) < cents(order.total))
    fail(400, 'The amount received is less than the order total.')
  const payment =
    order.payment ||
    (await tx.payment.create({
      data: {
        transactionId: 'ASC-' + randomUUID(),
        actorId: order.userId,
        method: 'cash',
        total: order.total,
        status: 'pending',
        isDemo: false,
        provider: 'counter',
      },
    }))
  await tx.payment.update({
    where: { id: payment.id },
    data: {
      status: 'succeeded',
      providerPaymentId: payment.isDemo ? 'DEMO-' + payment.id : null,
    },
  })
  await tx.order.update({
    where: { id: order.id },
    data: { status: cod ? 'Completed' : 'Paid', paymentId: payment.id },
  })
  const store = await settings(tx)
  const sale = await tx.sale.create({
    data: {
      id: payment.transactionId,
      receiptNumber: 'RCP-' + randomUUID(),
      storeName: store.name,
      storeAddress: store.address,
      cashier: actor?.name || 'Demo digital checkout',
      cashierId: actor?.id || null,
      source: 'online',
      isDemo: payment.isDemo,
      subtotal: order.subtotal,
      discount: 0,
      tax: 0,
      total: order.total,
      paymentMethod: cod ? 'cash' : order.paymentMethod,
      amountReceived,
      change: (cents(amountReceived) - cents(order.total)) / 100,
      paymentId: payment.id,
      orderId: order.id,
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
  await orderEvent(
    tx,
    order,
    cod
      ? 'Cash collected on delivery. Order completed.'
      : `${payment.isDemo ? 'Demo payment' : 'Counter payment'} confirmed. Order is ready for preparation.`,
    actor?.name || 'Demo checkout',
  )
  return sale
}
const payableDetails = { payment: true, items: { include: { product: true } } }
export async function settleOrder(
  orderId: string,
  actor: Actor,
  amountReceived?: number,
) {
  return transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: payableDetails,
    })
    if (!order) fail(404, 'Order not found.')
    if (!['cash', 'cod'].includes(order.paymentMethod))
      fail(409, 'Digital payment must be confirmed through its checkout.')
    return serialize(
      numericSale(
        await recordPayment(
          tx,
          order,
          actor,
          amountReceived ?? Number(order.total),
        ),
      ),
    )
  })
}
export async function simulateOrderPayment(
  orderId: string,
  actor: Actor,
  outcome: 'succeeded' | 'failed' | 'pending',
  eventId: string,
) {
  if (process.env.ENABLE_PAYMENT_DEMOS !== 'true')
    fail(403, 'Demo payments are disabled.')
  return transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: payableDetails,
    })
    if (!order || order.userId !== actor.id) fail(404, 'Order not found.')
    if (
      !order.payment?.isDemo ||
      order.payment.provider !== 'demo' ||
      order.paymentMethod === 'cash'
    )
      fail(403, 'This is not a demo digital payment.')
    const key = 'demo:' + eventId
    const processed = await tx.paymentWebhook.findUnique({ where: { id: key } })
    if (processed && processed.eventType !== order.id + ':' + outcome)
      fail(409, 'Payment event reference already used.')
    if (!processed && order.payment.status !== 'succeeded') {
      if (order.status !== 'Awaiting payment')
        fail(409, 'This order is no longer awaiting payment.')
      if (outcome === 'succeeded')
        await recordPayment(tx, order, null, Number(order.total))
      else {
        await tx.payment.update({
          where: { id: order.paymentId! },
          data: { status: outcome },
        })
        await orderEvent(
          tx,
          order,
          outcome === 'failed'
            ? 'Demo payment failed. Customer can retry payment.'
            : 'Demo payment is pending confirmation.',
          'Demo checkout',
        )
      }
      await tx.paymentWebhook.create({
        data: {
          id: key,
          provider: 'demo',
          eventType: order.id + ':' + outcome,
        },
      })
    }
    return serialize(
      numericOrder(
        (await tx.order.findUnique({
          where: { id: orderId },
          include: details,
        }))!,
      ),
    )
  })
}
export async function progressOrder(
  orderId: string,
  actor: Actor,
  status: string,
) {
  return transaction(async (tx) => {
    const order = await tx.order.findUnique({ where: { id: orderId } })
    if (!order) fail(404, 'Order not found.')
    if (order.status === status) return order
    validateProgress(order, status)
    const updated = await tx.order.update({
      where: { id: orderId },
      data: { status },
    })
    await orderEvent(tx, order, 'Order status: ' + status + '.', actor.name)
    return updated
  })
}
export async function cancelOrder(orderId: string, actor: Actor) {
  return transaction(async (tx) => {
    const order = await tx.order.findUnique({
      where: { id: orderId },
      include: { items: true },
    })
    if (!order || (actor.role === 'customer' && order.userId !== actor.id))
      fail(404, 'Order not found.')
    if (order.status === 'Cancelled') return
    if (order.status !== 'Awaiting payment')
      fail(
        409,
        'Only unpaid orders can be cancelled. Paid orders require a refund review.',
      )
    await tx.order.update({
      where: { id: orderId },
      data: { status: 'Cancelled' },
    })
    if (order.paymentId)
      await tx.payment.update({
        where: { id: order.paymentId },
        data: { status: 'cancelled' },
      })
    for (const line of order.items.toSorted((a, b) =>
      a.productId.localeCompare(b.productId),
    )) {
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
    await orderEvent(
      tx,
      order,
      'Order cancelled. Reserved stock restored.',
      actor.name,
    )
  })
}
