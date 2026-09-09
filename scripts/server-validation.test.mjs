import test from 'node:test'
import assert from 'node:assert/strict'
import { saleInput, items, mergeItems, totals, productInput } from '../server/validation.mjs'

test('sale input rejects invalid quantities, negative amounts and unrecognized methods', () => {
  const sale = { transactionId: 'ASC-test-123', items: [{ productId: 'rice', quantity: 1 }], discount: 0, taxRate: 0, paymentMethod: 'cash', amountReceived: 50 }
  assert.equal(saleInput.safeParse(sale).success, true)
  for (const quantity of [0, -1, 0.5, Infinity, 1000001]) assert.equal(saleInput.safeParse({ ...sale, items: [{ productId: 'rice', quantity }] }).success, false)
  for (const patch of [{ amountReceived: -1 }, { discount: NaN }, { taxRate: 101 }, { paymentMethod: 'approved-by-client' }, { items: [] }]) assert.equal(saleInput.safeParse({ ...sale, ...patch }).success, false)
  assert.equal(items.safeParse(Array.from({ length: 301 }, () => sale.items[0])).success, false)
})

test('money calculation rounds item prices and tax in cents, including full discount', () => {
  assert.deepEqual(totals([{ price: 0.1, quantity: 3 }, { price: 0.2, quantity: 1 }], 0, 12), { subtotal: 0.5, discount: 0, tax: 0.06, total: 0.56 })
  assert.deepEqual(totals([{ price: 99.99, quantity: 2 }], 199.98, 12), { subtotal: 199.98, discount: 199.98, tax: 0, total: 0 })
  assert.throws(() => totals([{ price: 1, quantity: 1 }], 1.01, 0), { status: 400 })
})

test('duplicate cart rows merge in a stable lock order', () => {
  assert.deepEqual(mergeItems([{ productId: 'z', quantity: 2 }, { productId: 'a', quantity: 1 }, { productId: 'z', quantity: 3 }]), [{ productId: 'a', quantity: 1 }, { productId: 'z', quantity: 5 }])
})

test('product edits cannot bypass stock adjustments and reject executable image URLs', () => {
  const edit = productInput.partial().omit({ stockQuantity: true })
  assert.deepEqual(edit.parse({ sellingPrice: 12.5, stockQuantity: 900 }), { sellingPrice: 12.5 })
  assert.equal(edit.safeParse({ imageUrl: 'javascript:alert(1)' }).success, false)
  assert.equal(edit.safeParse({ sellingPrice: -1 }).success, false)
  assert.equal(edit.parse({ sku: 'test-001' }).sku, 'TEST-001')
})
