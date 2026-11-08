import test from 'node:test'
import assert from 'node:assert/strict'
import {
  checkoutInput,
  nextOrderStatus,
  validateProgress,
  checkoutOptions,
} from '../src/checkout-rules.ts'
const input = {
  items: [{ productId: 'rice', quantity: 1 }],
  fulfillment: 'pickup',
  orderId: 'ORD-test-123',
  paymentMethod: 'gcash',
  confirmed: true,
  contactName: 'Demo customer',
  contactPhone: '09123456789',
  expectedTotal: 50,
}
test('checkout requires explicit confirmation, a payment choice and delivery contact details', () => {
  assert.equal(checkoutInput.safeParse(input).success, true)
  for (const changes of [
    { confirmed: false },
    { paymentMethod: undefined },
    { paymentMethod: 'fake' },
    { contactPhone: '' },
    { fulfillment: 'delivery' },
  ])
    assert.equal(
      checkoutInput.safeParse({ ...input, ...changes }).success,
      false,
    )
})
test('fulfillment cannot skip payment, preparation or the pickup/delivery step', () => {
  assert.equal(nextOrderStatus('Awaiting payment', 'Delivery'), null)
  assert.equal(nextOrderStatus('Paid', 'Store pickup'), 'Preparing')
  assert.equal(nextOrderStatus('Preparing', 'Delivery'), 'Out for delivery')
  assert.equal(nextOrderStatus('Preparing', 'Store pickup'), 'Ready for pickup')
  assert.throws(
    () =>
      validateProgress(
        { status: 'Paid', fulfillment: 'Delivery' },
        'Completed',
      ),
    {
      status: 409,
    },
  )
})
test('turning off demos disables wallet choices but keeps counter payment available', () => {
  const previous = process.env.ENABLE_PAYMENT_DEMOS
  try {
    process.env.ENABLE_PAYMENT_DEMOS = 'false'
    assert.deepEqual(
      checkoutOptions()
        .filter((m) => m.available)
        .map((m) => m.id),
      ['cash', 'cod'],
    )
    process.env.ENABLE_PAYMENT_DEMOS = 'true'
    assert.equal(checkoutOptions().filter((m) => m.available).length, 6)
    assert.ok(
      checkoutOptions()
        .filter((m) => !['cash', 'cod'].includes(m.id))
        .every((m) => m.isDemo),
    )
  } finally {
    if (previous === undefined) delete process.env.ENABLE_PAYMENT_DEMOS
    else process.env.ENABLE_PAYMENT_DEMOS = previous
  }
})

test('COD requires delivery, can prepare unpaid, and cannot complete without cash collection', () => {
  assert.equal(
    checkoutInput.safeParse({ ...input, paymentMethod: 'cod' }).success,
    false,
  )
  assert.equal(
    checkoutInput.safeParse({
      ...input,
      paymentMethod: 'cod',
      fulfillment: 'delivery',
      deliveryAddress: '123 Test Street, Manila',
    }).success,
    true,
  )
  assert.equal(
    nextOrderStatus('Awaiting payment', 'Delivery', 'cod'),
    'Preparing',
  )
  validateProgress(
    {
      status: 'Awaiting payment',
      fulfillment: 'Delivery',
      paymentMethod: 'cod',
    },
    'Preparing',
  )
  assert.throws(
    () =>
      validateProgress(
        {
          status: 'Out for delivery',
          fulfillment: 'Delivery',
          paymentMethod: 'cod',
        },
        'Completed',
      ),
    { status: 409 },
  )
})
