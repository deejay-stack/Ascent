import { z } from 'zod'
export const amount = z.number().finite().nonnegative().max(100000000)
export const items = z
  .array(
    z.object({ productId: z.string().min(1), quantity: z.number().int().positive().max(1000000) }),
  )
  .min(1)
  .max(300)
export const productInput = z.object({
  name: z.string().trim().min(2).max(150),
  description: z.string().trim().min(2).max(2000),
  categoryId: z.string().min(1),
  sku: z
    .string()
    .regex(/^[A-Z0-9-]{3,40}$/i)
    .transform((s) => s.toUpperCase()),
  barcode: z.string().regex(/^\d{8,14}$/),
  imageUrl: z.string().refine((s) => s.startsWith('/images/') || s.startsWith('https://')),
  costPrice: amount,
  sellingPrice: amount,
  stockQuantity: z.number().int().nonnegative().max(1000000),
  lowStockThreshold: z.number().int().nonnegative().max(1000000),
  unit: z.string().trim().min(1).max(40),
  brand: z.string().max(100).optional(),
  isAvailable: z.boolean(),
  isFeatured: z.boolean(),
  isArchived: z.boolean(),
})
export const saleInput = z.object({
  transactionId: z.string().min(8).max(100),
  items,
  discount: amount,
  taxRate: z.number().min(0).max(100),
  paymentMethod: z.enum(['cash', 'gcash', 'maya', 'card']),
  amountReceived: amount,
  paymentId: z.string().optional(),
})
export function fail(status, message) {
  const error = new Error(message)
  error.status = status
  throw error
}
export const cents = (n) => Math.round((Number(n) + Number.EPSILON) * 100)
export function totals(lines, discount, taxRate) {
  const subtotal = lines.reduce((sum, l) => sum + cents(l.price) * l.quantity, 0),
    deduction = cents(discount)
  if (deduction > subtotal) fail(400, 'Discount cannot exceed subtotal.')
  const tax = Math.round(((subtotal - deduction) * taxRate) / 100)
  return {
    subtotal: subtotal / 100,
    discount: deduction / 100,
    tax: tax / 100,
    total: (subtotal - deduction + tax) / 100,
  }
}
export function mergeItems(lines) {
  const merged = new Map()
  for (const line of lines)
    merged.set(line.productId, (merged.get(line.productId) || 0) + line.quantity)
  return [...merged]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([productId, quantity]) => ({ productId, quantity }))
}
