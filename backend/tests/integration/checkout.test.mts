import type { Server } from 'node:http'
import type { TestAccount } from '../helpers/live-fixture.mts'
import type { ApiBody } from '../helpers/api-types.ts'
import type { AddressInfo } from 'node:net'
import test from 'node:test'
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { app } from '../../src/app.ts'
import { db } from '../../src/db.ts'
import { liveFixture } from '../helpers/live-fixture.mts'

test(
  'demo checkout, cash collection, notifications and fulfillment',
  { timeout: 300000 },
  async (t) => {
    const fixture = await liveFixture(),
      previous = process.env.ENABLE_PAYMENT_DEMOS
    process.env.ENABLE_PAYMENT_DEMOS = 'true'
    const server = await new Promise<Server>((resolve) => {
      const value = app.listen(0, '127.0.0.1', () => resolve(value))
    })
    const origin = 'http://127.0.0.1:' + (server.address() as AddressInfo).port
    const api = async (
      path: string,
      actor?: TestAccount,
      body?: Record<string, unknown> | FormData,
      method = body === undefined ? 'GET' : 'POST',
    ) => {
      const response = await fetch(origin + path, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(actor ? { Authorization: 'Bearer ' + actor.token } : {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
      return {
        status: response.status,
        body: (await response.json()) as ApiBody,
      }
    }
    try {
      const owner = await fixture.account('checkout-owner', 'owner'),
        staff = await fixture.account('checkout-staff', 'staff')
      const customer = await fixture.account('checkout-customer', 'customer'),
        other = await fixture.account('checkout-other', 'customer')
      const category = await db.category.create({
        data: { name: fixture.run + ' checkout' },
      })
      const result = await api('/api/products', owner, {
        name: fixture.run + ' Checkout Rice',
        description: 'Checkout fixture',
        categoryId: category.id,
        sku: fixture.run.toUpperCase() + '-CHECKOUT',
        barcode: String(Date.now()),
        imageUrl: '/images/products/staples/jasmine_rice.jpg',
        costPrice: 10,
        sellingPrice: 25,
        stockQuantity: 20,
        lowStockThreshold: 2,
        unit: 'bag',
        isAvailable: true,
        isFeatured: false,
        isArchived: false,
      })
      assert.equal(result.status, 201)
      const product = result.body.product
      const input = (method = 'gcash') => ({
        orderId: 'ORD-' + randomUUID(),
        items: [{ productId: product.id, quantity: 1 }],
        fulfillment: 'pickup',
        paymentMethod: method,
        confirmed: true,
        contactName: customer.name,
        contactPhone: '09123456789',
        expectedTotal: 25,
      })
      const simulate = (
        order: Pick<ApiBody['order'], 'id'>,
        outcome: string,
        eventId = randomUUID(),
        actor = customer,
      ) =>
        api('/api/orders/' + order.id + '/demo-payment', actor, {
          outcome,
          eventId,
        })
      await t.test(
        'confirmation and current price are required before stock is reserved',
        async () => {
          assert.equal(
            (
              await api('/api/orders', customer, {
                ...input(),
                confirmed: false,
              })
            ).status,
            400,
          )
          assert.equal(
            (
              await api('/api/orders', customer, {
                ...input(),
                paymentMethod: undefined,
              })
            ).status,
            400,
          )
          assert.equal(
            (
              await api('/api/orders', customer, {
                ...input(),
                expectedTotal: 1,
              })
            ).status,
            409,
          )
          assert.equal(
            (await db.product.findUnique({ where: { id: product.id } }))!
              .stockQuantity,
            20,
          )
          assert.equal(
            await db.order.count({ where: { userId: customer.id } }),
            0,
          )
        },
      )
      for (const method of ['gcash', 'maya', 'paypal', 'qrph']) {
        await t.test(
          method +
            ' persists payment outcomes and confirms exactly one demo sale',
          async () => {
            const created = await api('/api/orders', customer, input(method))
            assert.equal(created.status, 201)
            const order = created.body.order
            assert.equal(order.payment!.status, 'pending')
            assert.equal(order.payment!.isDemo, true)
            assert.equal(
              (
                await api('/api/orders/' + order.id + '/settle', staff, {
                  amountReceived: 25,
                })
              ).status,
              409,
            )
            assert.equal(
              (await simulate(order, 'succeeded', randomUUID(), other)).status,
              404,
            )
            assert.equal(
              (await simulate(order, 'failed')).body.order.payment!.status,
              'failed',
            )
            assert.equal(
              (await simulate(order, 'pending')).body.order.payment!.status,
              'pending',
            )
            const eventId = randomUUID()
            const successes = await Promise.all([
              simulate(order, 'succeeded', eventId),
              simulate(order, 'succeeded', eventId),
            ])
            assert.ok(
              successes.every(
                (r) => r.status === 200 && r.body.order.status === 'Paid',
              ),
            )
            assert.equal(
              (await simulate(order, 'failed')).body.order.payment!.status,
              'succeeded',
            )
            assert.equal(
              await db.sale.count({ where: { orderId: order.id } }),
              1,
            )
            assert.equal(
              await db.paymentWebhook.count({
                where: { id: 'demo:' + eventId },
              }),
              1,
            )
            const receipt = await api(
              '/api/orders/' + order.id + '/receipt',
              customer,
            )
            assert.equal(receipt.body.sale.total, 25)
            assert.equal(receipt.body.sale.paymentMethod, method)
            assert.equal(receipt.body.sale.isDemo, true)
            assert.equal(receipt.body.sale.cashierId, null)
            assert.equal(
              (await api('/api/orders/' + order.id + '/receipt', other)).status,
              404,
            )
            assert.equal(
              (
                await api('/api/orders/' + order.id + '/progress', customer, {
                  status: 'Preparing',
                })
              ).status,
              403,
            )
            assert.equal(
              (
                await api('/api/orders/' + order.id + '/progress', staff, {
                  status: 'Completed',
                })
              ).status,
              409,
            )
            for (const status of ['Preparing', 'Ready for pickup', 'Completed'])
              assert.equal(
                (
                  await api('/api/orders/' + order.id + '/progress', staff, {
                    status,
                  })
                ).status,
                200,
              )
            assert.equal(
              (await api('/api/orders/' + order.id + '/cancel', customer, {}))
                .status,
              409,
            )
            assert.equal(
              await db.inventoryMovement.count({
                where: { reference: order.id, type: 'order' },
              }),
              1,
            )
          },
        )
      }
      await t.test(
        'COD remains unpaid until authorized delivery collection and cannot skip steps',
        async () => {
          const payload = {
            ...input('cod'),
            fulfillment: 'delivery',
            deliveryAddress: '123 Test Street, Manila',
          }
          const orders = await Promise.all([
            api('/api/orders', customer, payload),
            api('/api/orders', customer, payload),
          ])
          assert.ok(
            orders.every((r) => r.status === 201),
            JSON.stringify(orders),
          )
          const order = orders[0].body.order
          assert.equal(orders[1].body.order.id, order.id)
          assert.equal(order.payment!.status, 'pending')
          assert.equal(order.payment!.isDemo, false)
          assert.equal(order.events!.length, 1)
          assert.equal(
            (await api('/api/orders/' + order.id, other)).status,
            404,
          )
          assert.equal((await api('/api/orders/' + order.id)).status, 401)
          assert.equal(
            (await api('/api/orders/not-a-real-order', customer)).status,
            404,
          )
          assert.equal(
            (await api('/api/orders/' + order.id, customer)).body.order.payment!
              .status,
            'pending',
          )
          assert.equal(
            (
              await api('/api/orders/' + order.id + '/settle', customer, {
                amountReceived: 30,
              })
            ).status,
            403,
          )
          assert.equal(
            (
              await api('/api/orders/' + order.id + '/settle', staff, {
                amountReceived: 30,
              })
            ).status,
            409,
          )
          assert.equal(
            (
              await api('/api/orders/' + order.id + '/progress', staff, {
                status: 'Out for delivery',
              })
            ).status,
            409,
          )
          for (const status of ['Preparing', 'Out for delivery']) {
            assert.equal(
              (
                await api('/api/orders/' + order.id + '/progress', staff, {
                  status,
                })
              ).status,
              200,
            )
            assert.equal(
              (await api('/api/orders/' + order.id, customer)).body.order
                .payment!.status,
              'pending',
            )
          }
          assert.equal(
            (
              await api('/api/orders/' + order.id + '/progress', staff, {
                status: 'Completed',
              })
            ).status,
            409,
          )
          assert.equal(
            (
              await api('/api/orders/' + order.id + '/settle', staff, {
                amountReceived: 24,
              })
            ).status,
            400,
          )
          const settlements = await Promise.all([
            api('/api/orders/' + order.id + '/settle', staff, {
              amountReceived: 30,
            }),
            api('/api/orders/' + order.id + '/settle', staff, {
              amountReceived: 30,
            }),
          ])
          assert.ok(
            settlements.every((r) => r.status === 200),
            JSON.stringify(settlements),
          )
          assert.equal(settlements[0].body.sale.change, 5)
          const complete = (await api('/api/orders/' + order.id, customer)).body
            .order
          assert.equal(complete.status, 'Completed')
          assert.equal(complete.payment!.status, 'succeeded')
          assert.equal(complete.events!.length, 4)
          assert.equal(await db.sale.count({ where: { orderId: order.id } }), 1)
          assert.equal(
            await db.inventoryMovement.count({
              where: { reference: order.id, type: 'order' },
            }),
            1,
          )
          const history = (await api('/api/orders', customer)).body.orders.find(
            (o) => o.id === order.id,
          )
          assert.equal(history!.payment!.status, 'succeeded')
          assert.equal(history!.events!.length, 4)
          assert.equal((await api('/api/orders', other)).body.orders.length, 0)
          assert.equal(
            (
              await api('/api/orders', customer, {
                ...payload,
                expectedTotal: 1,
              })
            ).status,
            409,
          )
        },
      )
      await t.test(
        'counter payment rejects underpayment and records change before delivery fulfillment',
        async () => {
          const created = await api('/api/orders', customer, {
            ...input('cash'),
            fulfillment: 'delivery',
            deliveryAddress: '123 Test Street, Manila',
          })
          assert.equal(created.status, 201)
          const order = created.body.order
          assert.equal((await simulate(order, 'succeeded')).status, 403)
          assert.equal(
            (
              await api('/api/orders/' + order.id + '/settle', staff, {
                amountReceived: 24,
              })
            ).status,
            400,
          )
          const paid = await api('/api/orders/' + order.id + '/settle', staff, {
            amountReceived: 30,
          })
          assert.equal(paid.body.sale.change, 5)
          assert.equal(paid.body.sale.isDemo, false)
          assert.equal(
            (await db.order.findUnique({ where: { id: order.id } }))!.status,
            'Paid',
          )
          assert.equal(
            (
              await api('/api/orders/' + order.id + '/settle', staff, {
                amountReceived: 30,
              })
            ).body.sale.id,
            paid.body.sale.id,
          )
          for (const status of ['Preparing', 'Out for delivery', 'Completed'])
            assert.equal(
              (
                await api('/api/orders/' + order.id + '/progress', staff, {
                  status,
                })
              ).status,
              200,
            )
        },
      )
      await t.test(
        'cancelling an unpaid wallet order restores stock once and blocks later payment',
        async () => {
          const created = await api('/api/orders', customer, input())
          const order = created.body.order
          for (let i = 0; i < 2; i++)
            assert.equal(
              (await api('/api/orders/' + order.id + '/cancel', customer, {}))
                .status,
              200,
            )
          assert.equal((await simulate(order, 'succeeded')).status, 409)
          assert.equal(
            await db.inventoryMovement.count({
              where: { reference: order.id, type: 'stock-in' },
            }),
            1,
          )
          assert.equal(
            (await db.payment.findUnique({ where: { id: order.payment!.id } }))!
              .status,
            'cancelled',
          )
        },
      )
      await t.test(
        'notifications persist per recipient and customers cannot read another person’s updates',
        async () => {
          const list = (await api('/api/snapshot', staff)).body.notifications
          const notification = list.find((n) => n.message.includes('confirmed'))
          assert.ok(notification)
          assert.equal(
            (await api('/api/snapshot', other)).body.notifications.length,
            0,
          )
          await api(
            '/api/notifications/' + notification.id + '/read',
            other,
            {},
            'PATCH',
          )
          assert.equal(
            (await db.notification.findUnique({
              where: { id: notification.id },
            }))!.readAt,
            null,
          )
          await api(
            '/api/notifications/' + notification.id + '/read',
            staff,
            {},
            'PATCH',
          )
          assert.ok(
            (await db.notification.findUnique({
              where: { id: notification.id },
            }))!.readAt,
          )
        },
      )
      await t.test(
        'disabling demonstrations blocks wallet checkout without reserving stock',
        async () => {
          process.env.ENABLE_PAYMENT_DEMOS = 'false'
          const before = (await db.product.findUnique({
            where: { id: product.id },
          }))!.stockQuantity
          assert.equal(
            (await api('/api/orders', customer, input())).status,
            409,
          )
          assert.equal(
            (await db.product.findUnique({ where: { id: product.id } }))!
              .stockQuantity,
            before,
          )
        },
      )
    } finally {
      process.env.ENABLE_PAYMENT_DEMOS = previous
      await new Promise((resolve) => server.close(resolve))
      try {
        await fixture.cleanup()
      } finally {
        await db.$disconnect()
      }
    }
  },
)
