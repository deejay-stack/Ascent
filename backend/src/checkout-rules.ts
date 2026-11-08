import { z } from 'zod'
import { items, amount, fail } from './validation.ts'

export const checkoutInput = z
  .object({
    items,
    fulfillment: z.enum(['pickup', 'delivery']),
    orderId: z.string().min(8).max(100),
    cartVersion: z.number().int().nonnegative().optional(),
    paymentMethod: z.enum(['cash', 'cod', 'gcash', 'maya', 'paypal', 'qrph']),
    confirmed: z.literal(true),
    expectedTotal: amount.optional(),
    contactName: z.string().trim().min(2).max(100),
    contactPhone: z
      .string()
      .trim()
      .regex(/^[+0-9 ()-]{7,30}$/, 'Enter a valid contact number.'),
    deliveryAddress: z.string().trim().max(500).default(''),
  })
  .refine(
    (v) => v.fulfillment !== 'delivery' || v.deliveryAddress.length >= 10,
    {
      path: ['deliveryAddress'],
      message: 'Enter the complete delivery address.',
    },
  )
  .refine((v) => v.paymentMethod !== 'cod' || v.fulfillment === 'delivery', {
    path: ['paymentMethod'],
    message: 'Cash on delivery requires local delivery.',
  })

export function checkoutOptions() {
  const demo = process.env.ENABLE_PAYMENT_DEMOS === 'true'
  return [
    {
      id: 'cash',
      label: 'Over the counter',
      description: 'Pay cash at the store. Staff confirms receipt.',
      available: true,
      isDemo: false,
    },
    {
      id: 'cod',
      label: 'Cash on delivery',
      description:
        'Pay cash on delivery. Staff records collection when delivered.',
      available: true,
      isDemo: false,
    },
    ...[
      ['gcash', 'GCash'],
      ['maya', 'Maya / PayMaya'],
      ['paypal', 'PayPal'],
      ['qrph', 'QR Ph / digital banks'],
    ].map(([id, label]) => ({
      id,
      label,
      description: demo
        ? 'Demo digital checkout — no money moves.'
        : 'Currently unavailable.',
      available: demo,
      isDemo: true,
    })),
  ]
}

export function nextOrderStatus(
  status: string,
  fulfillment: string,
  paymentMethod?: string,
) {
  if (status === 'Awaiting payment' && paymentMethod === 'cod')
    return 'Preparing'
  return (
    (
      {
        Paid: 'Preparing',
        Preparing:
          fulfillment === 'Delivery' ? 'Out for delivery' : 'Ready for pickup',
        'Ready for pickup': 'Completed',
        'Out for delivery': 'Completed',
      } as Record<string, string>
    )[status] || null
  )
}
export function validateProgress(
  order: { status: string; fulfillment: string; paymentMethod?: string },
  status: string,
) {
  if (order.paymentMethod === 'cod' && status === 'Completed')
    fail(409, 'Record cash collected on delivery to complete this order.')
  if (
    nextOrderStatus(order.status, order.fulfillment, order.paymentMethod) !==
    status
  )
    fail(409, 'Refresh the order and complete its current step first.')
}
