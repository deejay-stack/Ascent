import type { Order } from '../types/product'
import type { Sale } from '../types/commerce'
import { request } from './api'
import { remoteWrite } from './remote/cache'
export type CheckoutMethod = 'cash' | 'cod' | 'gcash' | 'maya' | 'paypal' | 'qrph'
export type CheckoutDetails = {
  paymentMethod: CheckoutMethod
  confirmed: true
  contactName: string
  contactPhone: string
  deliveryAddress: string
  expectedTotal: number
}
export type CheckoutOption = {
  id: CheckoutMethod
  label: string
  description: string
  available: boolean
  isDemo: boolean
}
export type OrderNotification = {
  id: string
  orderId: string
  message: string
  createdAt: string
  readAt: string | null
}
export const methodLabels: Record<CheckoutMethod, string> = {
  cash: 'Over the counter',
  cod: 'Cash on delivery',
  gcash: 'GCash',
  maya: 'Maya / PayMaya',
  paypal: 'PayPal',
  qrph: 'QR Ph / digital banks',
}
export const checkoutService = {
  simulate: (id: string, outcome: 'succeeded' | 'pending' | 'failed', eventId: string) =>
    remoteWrite<{ order: Order }>('/api/orders/' + encodeURIComponent(id) + '/demo-payment', {
      outcome,
      eventId,
    }),
  progress: (id: string, status: string) =>
    remoteWrite('/api/orders/' + encodeURIComponent(id) + '/progress', { status }),
  receipt: async (id: string) =>
    (await request<{ sale: Sale }>('/api/orders/' + encodeURIComponent(id) + '/receipt')).sale,
  readNotification: (id: string) =>
    remoteWrite('/api/notifications/' + encodeURIComponent(id) + '/read', {}, 'PATCH'),
}
export function nextStatus(order: Order) {
  if (order.paymentMethod === 'cod' && order.status === 'Awaiting payment') return 'Preparing'
  if (order.paymentMethod === 'cod' && order.status === 'Out for delivery') return undefined
  return (
    {
      Paid: 'Preparing',
      Preparing: order.fulfillment === 'Delivery' ? 'Out for delivery' : 'Ready for pickup',
      'Ready for pickup': 'Completed',
      'Out for delivery': 'Completed',
    } as Record<string, string>
  )[order.status]
}
export function isActiveOrder(order: Pick<Order, 'status'>) {
  return ['Awaiting payment', 'Paid', 'Preparing', 'Ready for pickup', 'Out for delivery'].includes(order.status)
}
