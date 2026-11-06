import type { AuthUser } from '../../types/auth'
import type { CartItem, Sale } from '../../types/commerce'
import { cents } from '../money'
import { getState, id, mutate, requireOperator, validateCart } from '../mockStore'
import type { CheckoutDetails } from '../checkout'
export const orderService = {
  list(actor: AuthUser) {
    return getState()
      .orders.filter((o) => actor.role !== 'customer' || o.userId === actor.id)
      .toReversed()
  },
  async create(
    items: CartItem[],
    fulfillment: 'pickup' | 'delivery',
    actor: AuthUser,
    checkout?: CheckoutDetails,
  ) {
    if (actor.role !== 'customer') throw new Error('Checkout requires a customer account.')
    return mutate((draft) => {
      const lines = validateCart(draft, items)
      const now = new Date().toISOString()
      const order = {
        id: id('ORD'),
        userId: actor.id,
        paymentMethod: checkout?.paymentMethod ?? 'cash',
        contactName: checkout?.contactName,
        contactPhone: checkout?.contactPhone,
        deliveryAddress: checkout?.deliveryAddress,
        status: 'Awaiting payment',
        fulfillment: fulfillment === 'delivery' ? ('Delivery' as const) : ('Store pickup' as const),
        createdAt: now,
        items: lines.map(({ product: p, quantity }) => ({
          productId: p.id,
          name: p.name,
          price: p.sellingPrice,
          unit: p.unit,
          quantity,
          lineTotal: (cents(p.sellingPrice) * quantity) / 100,
        })),
        subtotal: 0,
        total: 0,
      }
      order.total = order.subtotal =
        order.items.reduce((sum, l) => sum + cents(l.lineTotal), 0) / 100
      for (const { product: p, quantity } of lines) {
        const before = p.stockQuantity
        p.stockQuantity -= quantity
        p.updatedAt = now
        draft.movements.push({
          id: id('MOV'),
          productId: p.id,
          productName: p.name,
          type: 'order',
          quantity: -quantity,
          before,
          after: p.stockQuantity,
          reason: 'Reserved for customer order',
          responsibleUser: actor.name,
          createdAt: now,
          reference: order.id,
        })
      }
      draft.orders.push(order)
      return { order }
    })
  },
  async settle(orderId: string, actor: AuthUser, amountReceived?: number): Promise<Sale> {
    requireOperator(actor)
    return mutate((draft) => {
      const order = draft.orders.find((o) => o.id === orderId)
      if (!order || order.status !== 'Awaiting payment')
        throw new Error('Order is no longer awaiting payment.')
      const received = amountReceived ?? order.total
      if (!Number.isFinite(received) || cents(received) < cents(order.total))
        throw new Error('The amount received is less than the order total.')
      const sale: Sale = {
        storeName: draft.settings.name,
        storeAddress: draft.settings.address,
        id: id('ASC'),
        receiptNumber: id('RCP'),
        createdAt: new Date().toISOString(),
        cashier: actor.name,
        cashierId: actor.id,
        source: 'online',
        items: order.items.map((l) => ({
          productId: l.productId,
          name: l.name,
          categoryId: draft.products.find((p) => p.id === l.productId)!.categoryId,
          unit: l.unit,
          imageUrl: draft.products.find((p) => p.id === l.productId)!.imageUrl,
          quantity: l.quantity,
          unitPrice: l.price,
          total: l.lineTotal,
        })),
        subtotal: order.subtotal,
        discount: 0,
        tax: 0,
        total: order.total,
        paymentMethod: 'cash',
        amountReceived: received,
        change: (cents(received) - cents(order.total)) / 100,
        paymentId: id('CASH'),
      }
      order.status = 'Completed'
      draft.sales.push(sale)
      return sale
    })
  },
  async cancel(orderId: string, actor: AuthUser) {
    if (actor.role !== 'customer') requireOperator(actor)
    mutate((draft) => {
      const order = draft.orders.find((o) => o.id === orderId)
      if (!order || (actor.role === 'customer' && order.userId !== actor.id))
        throw new Error('Order not found.')
      if (order.status === 'Cancelled') return
      if (order.status !== 'Awaiting payment') throw new Error('Order cannot be cancelled.')
      for (const l of order.items) {
        const p = draft.products.find((p) => p.id === l.productId)!
        const before = p.stockQuantity
        p.stockQuantity += l.quantity
        p.updatedAt = new Date().toISOString()
        draft.movements.push({
          id: id('MOV'),
          productId: p.id,
          productName: p.name,
          type: 'stock-in',
          quantity: l.quantity,
          before,
          after: p.stockQuantity,
          reason: 'Cancelled order reservation',
          responsibleUser: actor.name,
          createdAt: p.updatedAt,
          reference: order.id,
        })
      }
      order.status = 'Cancelled'
    })
  },
}
