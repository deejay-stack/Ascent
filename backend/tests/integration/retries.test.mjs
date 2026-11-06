import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { liveFixture } from '../helpers/live-fixture.mjs'
import { db } from '../../src/db.mjs'
import { app } from '../../src/app.mjs'

test('stock and POS retries preserve one operation and reject altered requests', { timeout: 180000 }, async () => {
  const fixture = await liveFixture()
  const server = await new Promise((resolve) => { const value = app.listen(0, '127.0.0.1', () => resolve(value)) })
  try {
    const staff = await fixture.account('retry-staff', 'staff')
    const customer = await fixture.account('retry-customer', 'customer')
    const category = await db.category.create({ data: { name: fixture.run + ' retry' } })
    const product = await db.product.create({ data: {
      name: fixture.run + ' Retry rice', slug: fixture.run, description: 'Retry test fixture',
      categoryId: category.id, sku: fixture.run.toUpperCase(), barcode: String(Date.now()),
      imageUrl: '/images/placeholders/product.svg', costPrice: 10, sellingPrice: 25, stockQuantity: 10, unit: 'bag',
    } })
    const api = async (path, body, actor = staff) => {
      const response = await fetch('http://127.0.0.1:' + server.address().port + path, { method: 'POST', headers: {
        'Content-Type': 'application/json', Authorization: 'Bearer ' + actor.token,
      }, body: JSON.stringify(body) })
      return { status: response.status, body: await response.json() }
    }
    const input = { productId: product.id, type: 'stock-in', quantity: 2, reason: 'Retry test delivery', requestId: randomUUID() }
    const stock = await Promise.all([api('/api/inventory/adjustments', input), api('/api/inventory/adjustments', input)])
    assert.ok(stock.every((r) => r.status === 200), JSON.stringify(stock))
    assert.equal((await db.product.findUnique({ where: { id: product.id } })).stockQuantity, 12)
    assert.equal(await db.inventoryMovement.count({ where: { reference: 'ADJ-' + input.requestId } }), 1)
    assert.equal((await api('/api/inventory/adjustments', { ...input, quantity: 3 })).status, 409)
    const counted = { ...input, type: 'adjustment', quantity: 9, requestId: randomUUID() }
    for (let i = 0; i < 2; i++) assert.equal((await api('/api/inventory/adjustments', counted)).status, 200)
    const sale = { transactionId: 'ASC-' + randomUUID(), items: [{ productId: product.id, quantity: 1 }], discount: 0, taxRate: 0, amountReceived: 30, paymentMethod: 'cash' }
    const sales = await Promise.all([api('/api/sales', sale), api('/api/sales', sale)])
    assert.ok(sales.every((r) => r.status === 201), JSON.stringify(sales))
    assert.equal(await db.sale.count({ where: { id: sale.transactionId } }), 1)
    assert.equal((await api('/api/sales', { ...sale, amountReceived: 40 })).status, 409)
    assert.equal((await api('/api/sales', { ...sale, items: [{ productId: product.id, quantity: 2 }] })).status, 409)
    assert.equal((await db.product.findUnique({ where: { id: product.id } })).stockQuantity, 8)
    const cart = await api('/api/cart/actions', { action: 'add', id: randomUUID(), userId: customer.id, productId: product.id, quantity: 1 }, customer)
    assert.equal(cart.status, 200)
    const checkout = { items: [{ productId: product.id, quantity: 1 }], fulfillment: 'pickup', paymentMethod: 'cash', confirmed: true,
      contactName: customer.name, contactPhone: '09123456789', expectedTotal: 25, cartVersion: cart.body.version }
    const checkouts = await Promise.all([
      api('/api/orders', { ...checkout, orderId: 'ORD-' + randomUUID() }, customer),
      api('/api/orders', { ...checkout, orderId: 'ORD-' + randomUUID() }, customer),
    ])
    assert.deepEqual(checkouts.map((r) => r.status).sort(), [201, 409], JSON.stringify(checkouts))
    assert.equal(await db.order.count({ where: { userId: customer.id } }), 1)
    assert.equal(await db.cartItem.count({ where: { userId: customer.id } }), 0)
    assert.equal((await db.product.findUnique({ where: { id: product.id } })).stockQuantity, 7)
  } finally {
    await new Promise((resolve) => server.close(resolve))
    try { await fixture.cleanup() } finally { await db.$disconnect() }
  }
})
