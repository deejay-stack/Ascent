import { calculateTotals, cents } from '../money'
import { getState, id, mutate, requireOperator, validateCart } from '../mockStore'
import { mockPaymentService } from '../payments/mockPaymentService'
import type { Sale } from '../../types/commerce'
import type { SalesService } from './salesService'
export const mockSalesService: SalesService = {
  nextTransaction: () => id('ASC'),
  list(actor) {
    requireOperator(actor)
    return getState().sales.toReversed()
  },
  async complete(input) {
    requireOperator(input.actor)
    const existing = getState().sales.find((s) => s.id === input.transactionId)
    if (existing) return existing
    return mutate((draft) => {
      const lines = validateCart(draft, input.items)
      const totals = calculateTotals(
        lines.map((l) => ({ price: l.product.sellingPrice, quantity: l.quantity })),
        input.discount,
        input.taxRate,
      )
      if (!['cash', 'gcash', 'maya', 'card'].includes(input.paymentMethod))
        throw new Error('Select a valid payment method.')
      const received =
        input.paymentMethod === 'cash' ? cents(input.amountReceived) : cents(totals.total)
      if (received < cents(totals.total)) throw new Error('Insufficient cash received.')
      if (
        input.paymentMethod !== 'cash' &&
        (!input.paymentId ||
          !mockPaymentService.verify(
            input.paymentId,
            input.transactionId,
            input.paymentMethod,
            totals.total,
          ))
      )
        throw new Error('Successful payment confirmation is required.')
      const now = new Date().toISOString()
      const sale: Sale = {
        ...totals,
        storeName: draft.settings.name,
        storeAddress: draft.settings.address,
        id: input.transactionId,
        receiptNumber: id('RCP'),
        createdAt: now,
        cashier: input.actor.name,
        cashierId: input.actor.id,
        source: 'pos',
        paymentMethod: input.paymentMethod,
        amountReceived: received / 100,
        change: (received - cents(totals.total)) / 100,
        paymentId: input.paymentId ?? id('CASH'),
        items: lines.map(({ product: p, quantity }) => ({
          productId: p.id,
          name: p.name,
          categoryId: p.categoryId,
          unit: p.unit,
          imageUrl: p.imageUrl,
          quantity,
          unitPrice: p.sellingPrice,
          total: (cents(p.sellingPrice) * quantity) / 100,
        })),
      }
      for (const { product: p, quantity } of lines) {
        const before = p.stockQuantity
        p.stockQuantity -= quantity
        p.updatedAt = now
        draft.movements.push({
          id: id('MOV'),
          productId: p.id,
          productName: p.name,
          type: 'sale',
          quantity: -quantity,
          before,
          after: p.stockQuantity,
          reason: 'POS sale',
          responsibleUser: input.actor.name,
          createdAt: now,
          reference: sale.id,
        })
      }
      draft.sales.push(sale)
      return sale
    })
  },
}
