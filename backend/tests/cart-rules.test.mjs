import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { cartAction, availableCart, cartQuantity } from '../src/cart-rules.mjs'
const product = { name: 'Rice', stockQuantity: 5, isAvailable: true, isArchived: false }
const base = {
  id: randomUUID(),
  userId: randomUUID(),
  action: 'add',
  productId: 'rice',
  quantity: 1,
}

test('cart commands require identity, retry reference and bounded whole quantities', () => {
  assert.equal(cartAction.safeParse(base).success, true)
  for (const patch of [
    { id: '' },
    { userId: '' },
    { action: 'approve' },
    { quantity: 0 },
    { quantity: -1 },
    { quantity: 0.5 },
    { quantity: Infinity },
    { quantity: 1000001 },
  ])
    assert.equal(cartAction.safeParse({ ...base, ...patch }).success, false)
  assert.equal(cartAction.safeParse({ ...base, action: 'set', quantity: 0 }).success, true)
  assert.equal(
    cartAction.safeParse({
      ...base,
      action: 'merge',
      items: Array.from({ length: 301 }, () => ({ productId: 'rice', quantity: 1 })),
    }).success,
    false,
  )
})
test('cart reads clamp reduced stock and exclude removed, archived or unavailable products', () => {
  assert.deepEqual(
    availableCart([
      { productId: 'rice', product, quantity: 9 },
      { productId: 'gone', product: null, quantity: 1 },
      { productId: 'archived', product: { ...product, isArchived: true }, quantity: 1 },
      { productId: 'off', product: { ...product, isAvailable: false }, quantity: 1 },
      { productId: 'empty', product: { ...product, stockQuantity: 0 }, quantity: 1 },
    ]),
    [{ productId: 'rice', quantity: 5 }],
  )
})
test('adding accumulates, setting replaces, and stock limits reject the whole operation', () => {
  assert.equal(cartQuantity(product, 2, 3, 'add'), 5)
  assert.equal(cartQuantity(product, 4, 2, 'set'), 2)
  assert.throws(() => cartQuantity(product, 4, 2, 'add'), { status: 409 })
  assert.throws(() => cartQuantity(null, 0, 1, 'add'), { status: 409 })
  assert.throws(() => cartQuantity({ ...product, isAvailable: false }, 0, 1, 'add'), {
    status: 409,
  })
})
