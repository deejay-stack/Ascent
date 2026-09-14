import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { readFile, mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { liveFixture } from '../helpers/live-fixture.mjs'
import { frontendDir, projectDir } from '../../src/env.mjs'
import { app } from '../../src/app.mjs'
import { db } from '../../src/db.mjs'

test('live Supabase API integration', { timeout: 600000 }, async (t) => {
  const fixture = await liveFixture()
  const passed = [],
    failed = []
  const originalDemo = process.env.ENABLE_PAYMENT_DEMOS
  process.env.ENABLE_PAYMENT_DEMOS = 'true'
  const server = await new Promise((resolve) => {
    const value = app.listen(0, '127.0.0.1', () => resolve(value))
  })
  const origin = `http://127.0.0.1:${server.address().port}`
  const api = async (path, actor, body, method = body === undefined ? 'GET' : 'POST') => {
    const response = await fetch(origin + path, {
      method,
      headers: {
        ...(actor ? { Authorization: 'Bearer ' + actor.token } : {}),
        ...(body && !(body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}),
      },
      body: body === undefined ? undefined : body instanceof FormData ? body : JSON.stringify(body),
    })
    return { status: response.status, body: await response.json() }
  }
  const check = async (name, fn) =>
    t.test(name, async () => {
      try {
        await fn()
        passed.push(name)
      } catch (error) {
        failed.push(name)
        throw error
      }
    })
  let owner, staff, customer, other, category, product
  const cart = (action) =>
    api('/api/cart/actions', customer, { id: randomUUID(), userId: customer.id, ...action })
  try {
    owner = await fixture.account('owner', 'owner')
    staff = await fixture.account('staff', 'staff')
    customer = await fixture.account('customer', 'customer')
    other = await fixture.account('other', 'customer')
    await check('health and authentication use the live database', async () => {
      assert.equal((await api('/api/health')).body.database, 'connected')
      assert.equal((await api('/api/me', owner)).body.user.id, owner.id)
      assert.equal((await api('/api/people')).status, 401)
      assert.equal((await api('/api/people', customer)).status, 403)
      assert.equal((await api('/api/people', staff)).status, 403)
    })
    await check('owner creates a category and product with opening stock history', async () => {
      const created = await api('/api/categories', owner, { name: fixture.run + ' groceries' })
      assert.equal(created.status, 201)
      category = created.body.category
      const result = await api('/api/products', owner, {
        name: fixture.run + ' Rice',
        description: 'Integration fixture',
        categoryId: category.id,
        sku: fixture.run.toUpperCase() + '-001',
        barcode: String(Date.now()),
        imageUrl: '/images/products/staples/jasmine_rice.jpg',
        costPrice: 10,
        sellingPrice: 25,
        stockQuantity: 20,
        lowStockThreshold: 3,
        unit: 'pack',
        brand: 'Test',
        isAvailable: true,
        isFeatured: true,
        isArchived: false,
      })
      assert.equal(result.status, 201)
      product = result.body.product
      const movement = await db.inventoryMovement.findFirst({ where: { productId: product.id } })
      assert.equal(movement.quantity, 20)
      assert.equal(movement.actorId, owner.id)
    })
    await check('catalog and staff snapshots hide cost prices and private records', async () => {
      const guest = (await api('/api/snapshot')).body
      assert.ok(guest.products.some((p) => p.id === product.id))
      assert.equal('costPrice' in guest.products.find((p) => p.id === product.id), false)
      assert.equal(guest.orders.length, 0)
      assert.equal(guest.sales.length, 0)
      const staffData = (await api('/api/snapshot', staff)).body
      assert.equal('costPrice' in staffData.products.find((p) => p.id === product.id), false)
      assert.equal(
        (await api('/api/products/' + product.id, staff, { costPrice: 1 }, 'PATCH')).status,
        403,
      )
    })
    await check(
      'duplicate identifiers and stock edits through product metadata are rejected',
      async () => {
        assert.equal((await api('/api/products', owner, { ...product, id: undefined })).status, 409)
        assert.equal(
          (
            await api(
              '/api/products/' + product.id,
              owner,
              { stockQuantity: 999, sellingPrice: 26 },
              'PATCH',
            )
          ).status,
          200,
        )
        const saved = await db.product.findUnique({ where: { id: product.id } })
        assert.equal(saved.stockQuantity, 20)
        assert.equal(Number(saved.sellingPrice), 26)
        await api('/api/products/' + product.id, owner, { sellingPrice: 25 }, 'PATCH')
      },
    )
    await check(
      'stock-in, stock-out and counted adjustments persist consistent history',
      async () => {
        for (const [type, quantity] of [
          ['stock-in', 5],
          ['stock-out', 2],
          ['adjustment', 20],
        ]) {
          assert.equal(
            (
              await api('/api/inventory/adjustments', staff, {
                productId: product.id,
                type,
                quantity,
                reason: fixture.run + ' stock check',
              })
            ).status,
            200,
          )
        }
        assert.equal((await db.product.findUnique({ where: { id: product.id } })).stockQuantity, 20)
        assert.equal(
          (
            await api('/api/inventory/adjustments', staff, {
              productId: product.id,
              type: 'stock-out',
              quantity: 21,
              reason: 'Too many',
            })
          ).status,
          400,
        )
        const rows = await db.inventoryMovement.findMany({ where: { productId: product.id } })
        assert.ok(rows.every((row) => row.quantity === row.after - row.before))
      },
    )
    await check(
      'cart changes persist and retrying the same add does not duplicate quantities',
      async () => {
        const input = {
          id: randomUUID(),
          userId: customer.id,
          action: 'add',
          productId: product.id,
          quantity: 2,
        }
        assert.equal((await api('/api/cart/actions', customer, input)).status, 200)
        assert.equal((await api('/api/cart/actions', customer, input)).body.items[0].quantity, 2)
        assert.equal((await api('/api/cart', customer)).body.items[0].quantity, 2)
        assert.equal(
          (
            await db.cartItem.findUnique({
              where: { userId_productId: { userId: customer.id, productId: product.id } },
            })
          ).quantity,
          2,
        )
        assert.equal((await api('/api/cart', other)).body.items.length, 0)
        assert.equal(
          (await api('/api/cart/actions', other, { ...input, id: randomUUID() })).status,
          403,
        )
        assert.equal(
          (await cart({ action: 'set', productId: product.id, quantity: 21 })).status,
          409,
        )
      },
    )
    await check('parallel cart increments retain both changes', async () => {
      const responses = await Promise.all([
        cart({ action: 'add', productId: product.id, quantity: 1 }),
        cart({ action: 'add', productId: product.id, quantity: 1 }),
      ])
      assert.ok(responses.every((response) => response.status === 200))
      assert.equal((await api('/api/cart', customer)).body.items[0].quantity, 4)
      await cart({ action: 'set', productId: product.id, quantity: 2 })
    })
    let order
    await check(
      'checkout creates order lines, reserves stock and clears the cart atomically',
      async () => {
        const input = {
          orderId: 'ORD-' + randomUUID(),
          items: [{ productId: product.id, quantity: 2 }],
          fulfillment: 'pickup',
        }
        const result = await api('/api/orders', customer, input)
        assert.equal(result.status, 201)
        order = result.body.order
        assert.equal(order.total, 50)
        assert.equal((await db.product.findUnique({ where: { id: product.id } })).stockQuantity, 18)
        assert.equal((await api('/api/cart', customer)).body.items.length, 0)
        assert.equal((await api('/api/orders', customer, input)).body.order.id, order.id)
        assert.equal(await db.order.count({ where: { id: order.id } }), 1)
        assert.equal(
          (await api('/api/orders', other)).body.orders.some((row) => row.id === order.id),
          false,
        )
      },
    )
    await check(
      'cash settlement stores payment and immutable receipt without a second stock deduction',
      async () => {
        const result = await api('/api/orders/' + order.id + '/settle', staff, {})
        assert.equal(result.status, 200)
        assert.equal(result.body.sale.total, 50)
        assert.equal(result.body.sale.paymentMethod, 'cash')
        assert.equal((await db.product.findUnique({ where: { id: product.id } })).stockQuantity, 18)
        assert.equal((await api('/api/orders/' + order.id + '/settle', staff, {})).status, 409)
        assert.equal(await db.sale.count({ where: { orderId: order.id } }), 1)
      },
    )
    await check('cancelling an unpaid order restores stock exactly once', async () => {
      const result = await api('/api/orders', customer, {
        orderId: 'ORD-' + randomUUID(),
        items: [{ productId: product.id, quantity: 1 }],
        fulfillment: 'delivery',
      })
      assert.equal(result.status, 201)
      assert.equal(
        (await api('/api/orders/' + result.body.order.id + '/cancel', owner, {})).status,
        200,
      )
      assert.equal(
        (await api('/api/orders/' + result.body.order.id + '/cancel', owner, {})).status,
        409,
      )
      assert.equal((await db.product.findUnique({ where: { id: product.id } })).stockQuantity, 18)
    })
    const saleInput = () => ({
      transactionId: 'ASC-' + randomUUID(),
      items: [{ productId: product.id, quantity: 1 }],
      discount: 0,
      taxRate: 0,
      paymentMethod: 'cash',
      amountReceived: 100,
    })
    await check('failed POS payment leaves stock, payments and sales unchanged', async () => {
      const request = { ...saleInput(), amountReceived: 1 }
      assert.equal((await api('/api/sales', staff, request)).status, 400)
      assert.equal(await db.payment.count({ where: { transactionId: request.transactionId } }), 0)
      assert.equal((await db.product.findUnique({ where: { id: product.id } })).stockQuantity, 18)
    })
    await check(
      'POS cash sale and retry create one payment, receipt and stock movement',
      async () => {
        const input = saleInput()
        const result = await api('/api/sales', staff, input)
        assert.equal(result.status, 201)
        assert.equal(result.body.sale.change, 75)
        assert.equal((await api('/api/sales', staff, input)).body.sale.id, input.transactionId)
        assert.equal(await db.payment.count({ where: { transactionId: input.transactionId } }), 1)
        assert.equal(
          await db.inventoryMovement.count({ where: { reference: input.transactionId } }),
          1,
        )
      },
    )
    await check(
      'GCash, Maya and card demos store pending and confirmed payment states',
      async () => {
        for (const method of ['gcash', 'maya', 'card']) {
          const input = { ...saleInput(), paymentMethod: method }
          const payment = await api('/api/payments/demo', staff, {
            transactionId: input.transactionId,
            method,
            total: 25,
          })
          assert.equal(payment.status, 201)
          input.paymentId = payment.body.payment.id
          assert.equal((await api('/api/sales', staff, input)).status, 409)
          assert.equal(
            (
              await api('/api/payments/' + input.paymentId + '/simulate', staff, {
                outcome: 'succeeded',
              })
            ).status,
            200,
          )
          assert.equal((await api('/api/sales', staff, input)).status, 201)
        }
        process.env.ENABLE_PAYMENT_DEMOS = 'false'
        assert.equal(
          (
            await api('/api/payments/demo', staff, {
              transactionId: randomUUID(),
              method: 'gcash',
              total: 25,
            })
          ).status,
          403,
        )
        assert.equal((await api('/api/snapshot', staff)).body.paymentDemosEnabled, false)
        process.env.ENABLE_PAYMENT_DEMOS = 'true'
      },
    )
    await check('concurrent checkouts cannot oversell the last unit', async () => {
      await api('/api/inventory/adjustments', owner, {
        productId: product.id,
        type: 'adjustment',
        quantity: 1,
        reason: 'Last unit race fixture',
      })
      const results = await Promise.all([
        api('/api/sales', staff, saleInput()),
        api('/api/sales', owner, saleInput()),
      ])
      assert.equal(results.filter((result) => result.status === 201).length, 1)
      assert.equal(results.filter((result) => result.status === 409).length, 1)
      assert.equal((await db.product.findUnique({ where: { id: product.id } })).stockQuantity, 0)
    })
    await check(
      'product photos upload to Storage and retain the correct content type',
      async () => {
        const form = new FormData()
        form.append(
          'image',
          new Blob(
            [await readFile(resolve(frontendDir, 'public/images/products/produce/banana.jpg'))],
            { type: 'image/jpeg' },
          ),
          'test.jpg',
        )
        const result = await api('/api/uploads/product', owner, form)
        assert.equal(result.status, 200)
        fixture.uploadedKeys.push(result.body.imageUrl.split('/').at(-1))
        const photo = await fetch(result.body.imageUrl)
        assert.equal(photo.status, 200)
        assert.match(photo.headers.get('content-type'), /image\/jpeg/)
        assert.equal(
          (
            await api(
              '/api/products/' + product.id,
              owner,
              { imageUrl: result.body.imageUrl },
              'PATCH',
            )
          ).status,
          200,
        )
      },
    )
    await check(
      'profiles, store settings, newsletter and reports read persisted records',
      async () => {
        assert.equal(
          (
            await api(
              '/api/me',
              customer,
              { name: fixture.run + ' Changed', email: customer.email },
              'PATCH',
            )
          ).status,
          200,
        )
        assert.equal((await api('/api/me', customer)).body.user.name, fixture.run + ' Changed')
        assert.equal(
          (
            await api(
              '/api/settings',
              owner,
              { name: fixture.run + ' store', address: 'Integration address', taxRate: 0 },
              'PATCH',
            )
          ).status,
          200,
        )
        assert.equal((await api('/api/snapshot', owner)).body.settings.name, fixture.run + ' store')
        assert.equal(
          (await api('/api/newsletter', null, { email: fixture.run + '-newsletter@example.com' }))
            .status,
          200,
        )
        assert.equal(
          await db.newsletterSubscription.count({
            where: { email: fixture.run + '-newsletter@example.com' },
          }),
          1,
        )
        const data = (await api('/api/snapshot', owner)).body
        assert.ok(data.sales.some((sale) => sale.orderId === order.id))
        assert.ok(data.movements.some((row) => row.productId === product.id))
      },
    )
    await check(
      'archive removes products from the catalog while preserving receipt prices',
      async () => {
        assert.equal(
          (
            await api(
              '/api/products/' + product.id,
              owner,
              { sellingPrice: 99, isArchived: true },
              'PATCH',
            )
          ).status,
          200,
        )
        assert.equal(
          (await api('/api/snapshot')).body.products.some((row) => row.id === product.id),
          false,
        )
        const receipt = await db.sale.findUnique({
          where: { orderId: order.id },
          include: { items: true },
        })
        assert.equal(Number(receipt.items[0].unitPrice), 25)
        assert.equal(
          (await api('/api/categories/' + category.id, owner, undefined, 'DELETE')).status,
          409,
        )
      },
    )
    await check(
      'disabled staff lose API access and frontend users cannot directly write business tables',
      async () => {
        assert.equal(
          (await api('/api/people/' + staff.id, owner, { isActive: false }, 'PATCH')).status,
          200,
        )
        assert.equal((await api('/api/snapshot', staff)).status, 403)
        const direct = await customer.client.from('products').select('*')
        assert.ok(direct.error)
        const write = await customer.client
          .from('products')
          .update({ stock_quantity: 999 })
          .eq('id', product.id)
        assert.ok(write.error)
        const carts = await customer.client.from('cart_items').select('*')
        assert.ok(carts.error)
      },
    )
  } finally {
    process.env.ENABLE_PAYMENT_DEMOS = originalDemo
    await new Promise((resolve) => server.close(resolve))
    try {
      await fixture.cleanup()
    } finally {
      await mkdir(resolve(projectDir, 'artifacts/integration'), { recursive: true })
      await writeFile(
        resolve(projectDir, 'artifacts/integration/api-results.json'),
        JSON.stringify({ passed, failed, at: new Date().toISOString() }, null, 2),
      )
      await db.$disconnect()
    }
  }
})
