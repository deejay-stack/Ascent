import type { Order } from '../types/product'
import { ApiError, request } from './api'
import { authStorage } from './storage/authStorage'
import { remoteCache } from './remote/cache'

export type CheckoutAttempt = { signature: string; orderId: string; pending: boolean }
const key = (userId: string) => 'ascent-checkout-request-' + userId
export async function readCheckoutAttempt(userId: string): Promise<CheckoutAttempt | null> {
  const saved = await authStorage.getItem(key(userId))
  if (!saved) return null
  try {
    const value = JSON.parse(saved)
    return typeof value.signature === 'string' && typeof value.orderId === 'string'
      ? { ...value, pending: value.pending === true } : null
  } catch { return null }
}
export async function saveCheckoutAttempt(userId: string, attempt: CheckoutAttempt) {
  await authStorage.setItem(key(userId), JSON.stringify(attempt))
}
export async function recoverPendingCheckout(userId: string): Promise<Order | null> {
  const attempt = await readCheckoutAttempt(userId)
  if (!attempt?.pending) return null
  let order: Order
  try {
    order = (await request<{ order: Order }>('/api/orders/' + encodeURIComponent(attempt.orderId))).order
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null
    throw error
  }
  await saveCheckoutAttempt(userId, { ...attempt, pending: false }).catch(() => undefined)
  await remoteCache.refresh(true).catch(() => undefined)
  return order
}
export function orderDestination(order: Order) {
  return (['cash', 'cod'].includes(order.paymentMethod || 'cash') ? '/account/orders/' : '/checkout/') + encodeURIComponent(order.id)
}
