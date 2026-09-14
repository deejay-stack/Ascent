import { z } from 'zod'
import { fail } from './validation.mjs'

const line = z.object({
  productId: z.string().min(1).max(100),
  quantity: z.number().int().min(1).max(1000000),
})
const common = { id: z.uuid(), userId: z.uuid() }
export const cartAction = z.discriminatedUnion('action', [
  z.object({ ...common, action: z.literal('add'), ...line.shape }),
  z.object({
    ...common,
    action: z.literal('set'),
    ...line.shape,
    quantity: z.number().int().min(0).max(1000000),
  }),
  z.object({ ...common, action: z.literal('remove'), productId: line.shape.productId }),
  z.object({ ...common, action: z.literal('clear') }),
  z.object({ ...common, action: z.literal('merge'), items: z.array(line).max(300) }),
])

export function availableCart(items) {
  return items.flatMap(({ product, productId, quantity }) =>
    product && !product.isArchived && product.isAvailable && product.stockQuantity > 0
      ? [{ productId, quantity: Math.min(quantity, product.stockQuantity) }]
      : [],
  )
}

export function cartQuantity(product, previous, requested, action) {
  if (!product || product.isArchived || !product.isAvailable || product.stockQuantity < 1)
    fail(409, 'This product is no longer available. Refresh the catalog.')
  const quantity = action === 'set' ? requested : previous + requested
  if (!Number.isSafeInteger(quantity) || quantity > product.stockQuantity)
    fail(409, `${product.name}: only ${product.stockQuantity} in stock.`)
  return quantity
}
