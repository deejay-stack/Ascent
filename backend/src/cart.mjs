import { createHash } from 'node:crypto'
import { db, transaction } from './db.mjs'
import { fail } from './validation.mjs'
import { availableCart, cartQuantity } from './cart-rules.mjs'

export async function readCart(userId, tx = db) {
  const cart = await tx.cart.findUnique({
    where: { userId },
    include: { items: { include: { product: true }, orderBy: { productId: 'asc' } } },
  })
  return { items: availableCart(cart?.items ?? []), version: cart?.version ?? 0 }
}

export async function changeCart(input, actor) {
  if (input.userId !== actor.id) fail(403, 'This cart belongs to another account.')
  const requestHash = createHash('sha256').update(JSON.stringify(input)).digest('hex')
  try {
    return await transaction(async (tx) => {
      const previous = await tx.cartMutation.findUnique({ where: { id: input.id } })
      if (previous) {
        if (previous.userId !== actor.id || previous.requestHash !== requestHash)
          fail(409, 'Cart request reference already used.')
        return readCart(actor.id, tx)
      }
      await tx.cart.upsert({
        where: { userId: actor.id },
        create: { userId: actor.id },
        update: { version: { increment: 1 } },
      })
      if (input.action === 'clear') await tx.cartItem.deleteMany({ where: { userId: actor.id } })
      else if (input.action === 'remove' || (input.action === 'set' && input.quantity === 0))
        await tx.cartItem.deleteMany({ where: { userId: actor.id, productId: input.productId } })
      else {
        const lines = input.action === 'merge' ? input.items : [input]
        for (const line of lines.toSorted((a, b) => a.productId.localeCompare(b.productId))) {
          const product = await tx.product.findUnique({ where: { id: line.productId } })
          const existing = await tx.cartItem.findUnique({
            where: { userId_productId: { userId: actor.id, productId: line.productId } },
          })
          if (
            input.action === 'merge' &&
            (!product || product.isArchived || !product.isAvailable || !product.stockQuantity)
          )
            continue
          const quantity =
            input.action === 'merge'
              ? Math.min(product.stockQuantity, (existing?.quantity ?? 0) + line.quantity)
              : cartQuantity(product, existing?.quantity ?? 0, line.quantity, input.action)
          await tx.cartItem.upsert({
            where: { userId_productId: { userId: actor.id, productId: line.productId } },
            create: { userId: actor.id, productId: line.productId, quantity },
            update: { quantity },
          })
        }
        if ((await tx.cartItem.count({ where: { userId: actor.id } })) > 300)
          fail(400, 'A cart can contain at most 300 different products.')
      }
      await tx.cartMutation.create({ data: { id: input.id, userId: actor.id, requestHash } })
      await tx.storeEvent.create({ data: { scope: 'customer', audienceId: actor.id } })
      return readCart(actor.id, tx)
    })
  } catch (error) {
    if (error.code === 'P2002') {
      const previous = await db.cartMutation.findUnique({ where: { id: input.id } })
      if (previous?.userId === actor.id && previous.requestHash === requestHash)
        return readCart(actor.id)
    }
    throw error
  }
}
