import type { z } from 'zod'
import type { productInput } from './validation.ts'
import type { Actor } from './types.ts'
import { createHash, randomUUID } from 'node:crypto'
import { db, transaction } from './db.ts'
import { emit } from './commerce.ts'

export async function createProduct(
  input: z.infer<typeof productInput>,
  actor: Actor,
  requestId?: string,
) {
  // The same owner's identical draft and request token address one product.
  // A lost HTTP response can be retried without repeating opening stock.
  const id = requestId
    ? 'PRD-' +
      createHash('sha256')
        .update(JSON.stringify([actor.id, requestId, input]))
        .digest('hex')
    : randomUUID()
  const previous = requestId && (await db.product.findUnique({ where: { id } }))
  if (previous) return previous
  try {
    return await transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          ...input,
          id,
          slug:
            input.name.toLowerCase().replace(/[^a-z0-9]+/g, '-') +
            '-' +
            randomUUID().slice(0, 8),
        },
      })
      if (product.stockQuantity)
        await tx.inventoryMovement.create({
          data: {
            productId: product.id,
            productName: product.name,
            type: 'stock-in',
            quantity: product.stockQuantity,
            before: 0,
            after: product.stockQuantity,
            reason: 'Opening stock for new product',
            responsibleUser: actor.name,
            actorId: actor.id,
          },
        })
      await emit(tx)
      return product
    })
  } catch (error) {
    // Concurrent retries may race on the primary key. Read only after the
    // failed transaction has rolled back; other SKU/barcode conflicts remain errors.
    if (
      requestId &&
      ['P2002', 'P2034'].includes((error as { code: string }).code)
    ) {
      const saved = await db.product.findUnique({ where: { id } })
      if (saved) return saved
    }
    throw error
  }
}
