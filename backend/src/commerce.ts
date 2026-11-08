import type { z } from 'zod'
import type { saleInput } from './validation.ts'
import type {
  Actor,
  Transaction,
  SaleWithItems,
  OrderWithDetails,
} from './types.ts'
import { randomUUID } from 'node:crypto'
import { db, transaction } from './db.ts'
import {
  cents,
  fail,
  mergeItems,
  totals,
  validateSaleRetry,
} from './validation.ts'
import { readCart } from './cart.ts'
import { checkoutOptions } from './checkout-rules.ts'

type Serialized<T> = T extends { toJSON(): infer Result }
  ? Serialized<Result>
  : T extends object
    ? { [Key in keyof T]: Serialized<T[Key]> }
    : T
export const serialize = <T>(value: T): Serialized<T> =>
  JSON.parse(JSON.stringify(value))
export const numericProduct = <
  T extends { costPrice: unknown; sellingPrice: unknown },
>(
  p: T,
) => ({
  ...p,
  costPrice: Number(p.costPrice),
  sellingPrice: Number(p.sellingPrice),
})
export const numericSale = (s: SaleWithItems) => ({
  ...s,
  subtotal: Number(s.subtotal),
  discount: Number(s.discount),
  tax: Number(s.tax),
  total: Number(s.total),
  amountReceived: Number(s.amountReceived),
  change: Number(s.change),
  items: s.items.map((l) => ({
    ...l,
    unitPrice: Number(l.unitPrice),
    total: Number(l.total),
  })),
})
export const numericOrder = (o: OrderWithDetails) => ({
  ...o,
  subtotal: Number(o.subtotal),
  total: Number(o.total),
  payment: o.payment
    ? {
        id: o.payment.id,
        method: o.payment.method,
        status: o.payment.status,
        total: Number(o.payment.total),
        isDemo: o.payment.isDemo,
        provider: o.payment.provider,
        reference: o.payment.providerPaymentId,
      }
    : null,
  items: o.items.map((l) => ({
    ...l,
    price: Number(l.price),
    lineTotal: Number(l.lineTotal),
  })),
})
export async function emit(tx: Transaction, audienceId: string | null = null) {
  await tx.storeEvent.create({ data: { scope: 'catalog' } })
  if (audienceId)
    await tx.storeEvent.create({ data: { scope: 'customer', audienceId } })
}
export async function settings(tx: Transaction = db) {
  return tx.storeSettings.upsert({
    where: { id: 'store' },
    create: { id: 'store' },
    update: {},
  })
}
export async function snapshot(actor?: Actor) {
  const operator = actor && ['owner', 'staff'].includes(actor.role)
  const [
    products,
    categories,
    store,
    sales,
    movements,
    orders,
    cart,
    notifications,
  ] = await db.$transaction(
    async (tx) =>
      Promise.all([
        tx.product.findMany({
          where: operator ? {} : { isArchived: false },
          orderBy: { createdAt: 'asc' },
        }),
        tx.category.findMany({ orderBy: { name: 'asc' } }),
        tx.storeSettings.findUniqueOrThrow({ where: { id: 'store' } }),
        operator
          ? tx.sale.findMany({
              include: { items: true },
              orderBy: { createdAt: 'desc' },
            })
          : [],
        operator
          ? tx.inventoryMovement.findMany({ orderBy: { createdAt: 'desc' } })
          : [],
        actor
          ? tx.order.findMany({
              where: operator ? {} : { userId: actor.id },
              include: {
                items: true,
                payment: true,
                events: { orderBy: { createdAt: 'asc' } },
              },
              orderBy: { createdAt: 'desc' },
            })
          : [],
        actor?.role === 'customer'
          ? readCart(actor.id, tx)
          : { items: [], version: 0 },
        actor
          ? tx.notification.findMany({
              where: { userId: actor.id },
              orderBy: { createdAt: 'desc' },
              take: 50,
            })
          : [],
      ]),
    { isolationLevel: 'RepeatableRead', maxWait: 10000, timeout: 20000 },
  )
  return serialize({
    products: products.map((p) => {
      const row: Omit<
        ReturnType<typeof numericProduct<typeof p>>,
        'costPrice'
      > & { costPrice?: number } = numericProduct(p)
      if (actor?.role !== 'owner') delete row.costPrice
      return row
    }),
    categories,
    settings: {
      name: store.name,
      address: store.address,
      taxRate: Number(store.taxRate),
    },
    sales: sales.map(numericSale),
    movements,
    orders: orders.map(numericOrder),
    paymentDemosEnabled: process.env.ENABLE_PAYMENT_DEMOS === 'true',
    cart,
    notifications,
    checkoutMethods: checkoutOptions(),
  })
}
export async function lockAndDeduct(
  tx: Transaction,
  requested: { productId: string; quantity: number }[],
  actor: Actor,
  type: string,
  reason: string,
  reference: string,
) {
  const lines = []
  for (const item of mergeItems(requested)) {
    const p = await tx.product.findUnique({ where: { id: item.productId } })
    if (!p || p.isArchived || !p.isAvailable)
      fail(409, 'A product is no longer available.')
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
      fail(
        409,
        `${p.name}: insufficient stock or product changed. Refresh the bill.`,
      )
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
export async function completeSale(
  input: z.infer<typeof saleInput>,
  actor: Actor,
) {
  try {
    const sale = await transaction(async (tx) => {
      const existing = await tx.sale.findUnique({
        where: { id: input.transactionId },
        include: { items: true },
      })
      if (existing) {
        return validateSaleRetry(existing, input, actor)
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
        lines.map((l) => ({
          price: l.product.sellingPrice,
          quantity: l.quantity,
        })),
        input.discount,
        input.taxRate,
      )
      const received =
        input.paymentMethod === 'cash'
          ? cents(input.amountReceived)
          : cents(bill.total)
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
        payment = await tx.payment.findUnique({
          where: { id: input.paymentId || '' },
        })
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
          isDemo: payment.isDemo,
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
    if ((error as { code?: string }).code === 'P2002') {
      const existing = await db.sale.findUnique({
        where: { id: input.transactionId },
        include: { items: true },
      })
      if (existing)
        return serialize(numericSale(validateSaleRetry(existing, input, actor)))
    }
    throw error
  }
}
