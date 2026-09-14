import type { Payment } from '../../types/commerce'
import { id } from '../mockStore'
import { cents } from '../money'
import type { PaymentService } from './paymentService'
const payments = new Map<string, Payment>()
export const mockPaymentService: PaymentService = {
  async begin(transactionId, method, total) {
    cents(total)
    const payment: Payment = { id: id('PAY'), transactionId, method, total, status: 'pending' }
    payments.set(payment.id, payment)
    return { ...payment }
  },
  async simulate(paymentId, outcome) {
    const p = payments.get(paymentId)
    if (!p || p.status !== 'pending') throw new Error('This payment is no longer pending.')
    p.status = outcome
    return { ...p }
  },
  verify(paymentId, transactionId, method, total) {
    const p = payments.get(paymentId)
    return (
      !!p &&
      p.status === 'succeeded' &&
      p.transactionId === transactionId &&
      p.method === method &&
      cents(p.total) === cents(total)
    )
  },
}
