import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { liveFixture } from '../../backend/tests/helpers/live-fixture.mts'
import { projectDir, frontendDir } from '../../backend/src/env.ts'
import { browserDriver } from './browser-driver.mts'
import { db } from '../../backend/src/db.ts'

const origin = 'http://127.0.0.1:5196',
  out = resolve(projectDir, 'artifacts/checkout')
const passed: string[] = [],
  children = []
let browser, fixture
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const check = (name: string, value: unknown) => {
  if (!value) throw new Error(name)
  passed.push(name)
  console.log('PASS', name)
}
try {
  await mkdir(out, { recursive: true })
  fixture = await liveFixture()
  const owner = await fixture.account('wallet-owner', 'owner')
  const staff = await fixture.account('wallet-staff', 'staff')
  const customer = await fixture.account('wallet-customer', 'customer')
  children.push(
    spawn(process.execPath, [resolve(projectDir, 'backend/src/index.ts')], {
      env: {
        ...process.env,
        ASCENT_DATA_MODE: 'supabase',
        APP_URL: origin,
        PORT: '4196',
        ENABLE_PAYMENT_DEMOS: 'true',
      },
      stdio: ['ignore', 'ignore', 'pipe'],
      windowsHide: true,
    }),
  )
  children[0].stderr?.on('data', (chunk: Buffer) => process.stderr.write(chunk))
  children.push(
    spawn(
      process.execPath,
      [
        resolve(projectDir, 'node_modules/vite/bin/vite.js'),
        '--host',
        '127.0.0.1',
        '--port',
        '5196',
        '--strictPort',
      ],
      {
        cwd: frontendDir,
        env: {
          ...process.env,
          VITE_DATA_MODE: 'supabase',
          ASCENT_API_TARGET: 'http://127.0.0.1:4196',
          ASCENT_TEST_CACHE: resolve(out, 'vite-cache'),
        },
        stdio: 'ignore',
        windowsHide: true,
      },
    ),
  )
  let ready = false
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(origin + '/api/health')).ok) {
        ready = true
        break
      }
    } catch {
      /* Starting servers. */
    }
    await delay(200)
  }
  if (!ready) throw new Error('Checkout test servers did not start')
  const category = await db.category.create({
    data: { name: fixture.run + ' wallet aisle' },
  })
  const response = await fetch(origin + '/api/products', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: 'Bearer ' + owner.token,
    },
    body: JSON.stringify({
      name: fixture.run + ' Wallet Rice',
      description: 'Checkout browser fixture',
      categoryId: category.id,
      sku: fixture.run.toUpperCase() + '-WALLET',
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
    }),
  })
  if (response.status !== 201)
    throw new Error('Checkout product setup failed: ' + response.status)
  const { product } = await response.json()
  browser = await browserDriver(origin, out, 9583)
  const shopping = await browser.page('customer'),
    operations = await browser.page('staff'),
    reporting = await browser.page('owner')
  await operations.login(staff)
  await operations.navigate('/staff/orders')
  await shopping.login(customer)
  const orderButton = async (
    page: Awaited<
      ReturnType<Awaited<ReturnType<typeof browserDriver>>['page']>
    >,
    id: string,
    label: string,
  ) => {
    const expression = `(()=>{const row=document.querySelector('[data-order-id="'+${JSON.stringify(id)}+'"]');return [...(row?.querySelectorAll('button')||[])].find(b=>b.textContent.trim()===${JSON.stringify(label)}&&!b.disabled)})()`
    await page.until(`!!${expression}`, 40000)
    await page.evaluate(`${expression}.click()`)
  }
  let dropResponse = false,
    blockRecovery = false,
    droppedOrderId: string | undefined,
    interceptionError
  shopping.onEvent((event) => {
    if (event.method !== 'Fetch.requestPaused') return
    void (async () => {
      const { request, requestId, responseStatusCode } = event.params
      if (
        dropResponse &&
        request.method === 'POST' &&
        responseStatusCode &&
        new URL(request.url).pathname === '/api/orders'
      ) {
        droppedOrderId = JSON.parse(request.postData).orderId
        dropResponse = false
        blockRecovery = true
        await shopping.call('Fetch.failRequest', {
          requestId,
          errorReason: 'ConnectionReset',
        })
      } else if (
        blockRecovery &&
        request.method === 'GET' &&
        new URL(request.url).pathname === '/api/orders/' + droppedOrderId
      ) {
        await shopping.call('Fetch.failRequest', {
          requestId,
          errorReason: 'ConnectionReset',
        })
      } else await shopping.call('Fetch.continueRequest', { requestId })
    })().catch((error) => {
      interceptionError = error.message
    })
  })
  await shopping.call('Fetch.enable', {
    patterns: [
      { urlPattern: '*/api/orders', requestStage: 'Response' },
      { urlPattern: '*/api/orders/*', requestStage: 'Request' },
    ],
  })
  const place = async (
    method: string,
    options: { lostResponse?: boolean } = {},
  ) => {
    await shopping.navigate('/products/' + product.id)
    await shopping.button('Add to cart')
    await shopping.navigate('/cart')
    await shopping.until('document.querySelectorAll(".cart-line").length===1')
    await shopping.field('Contact number', '09123456789')
    if (method === 'cod') {
      await shopping.field('Fulfillment', 'delivery')
      await shopping.field('Delivery address', '123 Test Street, Manila')
    }
    await shopping.click('input[name="paymentMethod"][value="' + method + '"]')
    const before = await db.order.count({ where: { userId: customer.id } })
    await shopping.button('Review order')
    await shopping.until('!!document.querySelector("dialog[open]")')
    check(
      method + ': review does not place an order',
      (await db.order.count({ where: { userId: customer.id } })) === before,
    )
    dropResponse = options.lostResponse === true
    await shopping.button(
      method === 'cod'
        ? 'Confirm order — cash on delivery'
        : method === 'cash'
          ? 'Confirm order — pay at counter'
          : 'Confirm order and continue to payment',
    )
    if (options.lostResponse) {
      await shopping.until('!!document.querySelector(".form-error")', 40000)
      blockRecovery = false
      await shopping.call('Page.reload')
    }
    await shopping.until(
      ['cash', 'cod'].includes(method)
        ? 'document.body.textContent.includes("Order received")'
        : 'location.pathname.startsWith("/checkout/")&&!!document.querySelector(".wallet-card")',
      40000,
    )
    return db.order.findFirst({
      where: { userId: customer.id },
      orderBy: { createdAt: 'desc' },
      include: { payment: true },
    })
  }
  for (const method of ['gcash', 'maya', 'paypal', 'qrph']) {
    const order = await place(method)
    check(
      method + ': explicitly confirmed order is unpaid',
      order!.status === 'Awaiting payment' &&
        order!.payment!.status === 'pending',
    )
    if (method !== 'qrph') {
      await shopping.until(
        'document.querySelector(".wallet-heading img")?.naturalWidth>0',
      )
      check(method + ': official local payment logo loads', true)
    }
    check(
      method + ': demo screen cannot collect wallet credentials',
      await shopping.evaluate(
        'document.body.textContent.includes("No real money moves")&&!document.querySelector(".wallet-card input")',
      ),
    )
    if (method === 'gcash') {
      await shopping.screenshot('gcash-desktop')
      await shopping.call('Emulation.setDeviceMetricsOverride', {
        width: 390,
        height: 844,
        deviceScaleFactor: 1,
        mobile: true,
      })
      check(
        'Mobile wallet fits without horizontal overflow',
        await shopping.evaluate('document.documentElement.scrollWidth<=390'),
      )
      await shopping.screenshot('gcash-mobile')
      await shopping.call('Emulation.setDeviceMetricsOverride', {
        width: 1440,
        height: 1000,
        deviceScaleFactor: 1,
        mobile: false,
      })
      await shopping.button('Simulate failed payment')
      await shopping.until(
        'document.querySelector(".payment-state")?.textContent.includes("failed")',
      )
      await shopping.button('Simulate pending payment')
      await shopping.until(
        'document.querySelector(".payment-state")?.textContent.includes("Awaiting")',
      )
      check(
        'Failed digital payment can return to pending for retry',
        (await db.payment.findUnique({ where: { id: order!.paymentId! } }))!
          .status === 'pending',
      )
    }
    await shopping.button('Simulate successful payment')
    await shopping.until(
      'document.body.textContent.includes("Demo payment confirmed")',
      40000,
    )
    const sale = await db.sale.findUnique({ where: { orderId: order!.id } })
    check(
      method + ': confirmation persists a demo receipt',
      sale?.isDemo &&
        sale.paymentMethod === method &&
        Number(sale.total) === 25,
    )
    if (method === 'gcash') {
      await operations.until(
        'document.querySelector(".notification-toggle span")?.textContent!=="0"',
        20000,
      )
      await operations.click('.notification-toggle')
      await operations.until(
        'document.querySelector(".notification-panel")?.textContent.includes("Demo payment confirmed")',
        20000,
      )
      await operations.screenshot('staff-notifications')
      await operations.click('.notification-panel a')
      await operations.until('!document.querySelector(".notification-panel")')
      for (
        let i = 0;
        i < 30 &&
        !(await db.notification.count({
          where: { userId: staff.id, readAt: { not: null } },
        }));
        i++
      )
        await delay(200)
      check(
        'Staff receives realtime updates and persists read status',
        (await db.notification.count({
          where: { userId: staff.id, readAt: { not: null } },
        })) > 0,
      )
      for (const label of [
        'Start preparing',
        'Mark ready for pickup',
        'Complete order',
      ])
        await orderButton(operations, order!.id, label)
      await operations.until(
        `document.querySelector('[data-order-id="${order!.id}"] .order-status')?.textContent==="Completed"`,
      )
      await shopping.navigate('/account/orders')
      await shopping.until(
        'document.querySelector(".order-status")?.textContent==="Completed"',
      )
      check('Customer sees staff preparation, pickup and completion', true)
      await shopping.button('View receipt')
      await shopping.until('!!document.querySelector("dialog[open]")')
      check(
        'Customer receipt labels the digital payment simulated',
        await shopping.evaluate(
          'document.querySelector("dialog").textContent.includes("simulated")',
        ),
      )
      await shopping.click('[aria-label="Close Receipt"]')
    }
  }
  const cash = await place('cash')
  check(
    'Counter checkout waits for cash collection',
    cash!.paymentMethod === 'cash' &&
      cash!.status === 'Awaiting payment' &&
      !cash!.payment!.isDemo,
  )
  await operations.navigate('/staff/orders')
  await orderButton(operations, cash!.id, 'Receive counter payment')
  await operations.field('Cash received', '30')
  await operations.button('Confirm cash received')
  await operations.until(
    '!!document.querySelector("dialog[open] .receipt-paper")',
    40000,
  )
  const receipt = await db.sale.findUnique({ where: { orderId: cash!.id } })
  check(
    'Staff cash collection stores change and cashier identity',
    Number(receipt!.change) === 5 &&
      receipt!.cashierId === staff.id &&
      !receipt!.isDemo,
  )
  await operations.screenshot('counter-receipt')
  await operations.click('[aria-label="Close Receipt"]')
  await shopping.call('Page.reload')
  await shopping.until('!!document.querySelector(".order-detail-page")')
  check(
    'Order confirmation survives refresh with products, payment, shipping and tracking',
    await shopping.evaluate(
      'document.body.textContent.includes("Order confirmation")&&document.body.textContent.includes("Internal order-status tracking")&&document.body.textContent.includes("Wallet Rice")',
    ),
  )
  const cod = await place('cod')
  check(
    'COD confirmation remains unpaid',
    cod!.payment!.status === 'pending' && !cod!.payment!.isDemo,
  )
  await shopping.call('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  })
  check(
    'Mobile order confirmation fits the viewport',
    await shopping.evaluate('document.documentElement.scrollWidth<=390'),
  )
  await shopping.screenshot('cod-confirmation-mobile')
  await shopping.call('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 1000,
    deviceScaleFactor: 1,
    mobile: false,
  })
  await operations.navigate('/staff/orders')
  for (const label of ['Start preparing', 'Mark out for delivery'])
    await orderButton(operations, cod!.id, label)
  check(
    'COD is still unpaid while out for delivery',
    (await db.payment.findUnique({ where: { id: cod!.paymentId! } }))!
      .status === 'pending',
  )
  await orderButton(operations, cod!.id, 'Record COD collection')
  await operations.field('Cash received', '30')
  await operations.button('Confirm cash received')
  await operations.until(
    '!!document.querySelector("dialog[open] .receipt-paper")',
    40000,
  )
  await operations.click('[aria-label="Close Receipt"]')
  const delivered = await db.order.findUnique({
    where: { id: cod!.id },
    include: { payment: true },
  })
  check(
    'Authorized COD collection records payment and completes delivery',
    delivered!.status === 'Completed' &&
      delivered!.payment!.status === 'succeeded',
  )
  const recovered = await place('cash', { lostResponse: true })
  check(
    'Lost checkout response recovers after refresh without a duplicate order',
    !interceptionError &&
      recovered!.id === droppedOrderId &&
      (await db.order.count({ where: { userId: customer.id } })) === 7,
  )
  await shopping.navigate('/account/orders')
  await orderButton(shopping, recovered!.id, 'Cancel order')
  await shopping.button('Confirm cancellation')
  await shopping.until(
    `document.querySelector('[data-order-id="${recovered!.id}"] .order-status')?.textContent==="Cancelled"`,
  )
  const cancelled = await place('gcash')
  await shopping.navigate('/account/orders')
  await shopping.button('Cancel order')
  await shopping.button('Confirm cancellation')
  await shopping.until(
    'document.querySelector(".order-status")?.textContent==="Cancelled"',
  )
  check(
    'Customer cancellation restores the unpaid reservation',
    (await db.product.findUnique({ where: { id: product.id } }))!
      .stockQuantity === 14 &&
      (await db.inventoryMovement.count({
        where: { reference: cancelled!.id, type: 'stock-in' },
      })) === 1,
  )
  await reporting.login(owner)
  await reporting.navigate('/owner/reports')
  await reporting.until('!!document.querySelector(".data-table tbody")')
  const saleIds = (
    await db.sale.findMany({
      where: { order: { userId: customer.id } },
      select: { id: true },
    })
  ).map((sale) => sale.id)
  const fixtureRows = `[...document.querySelectorAll('.data-table tbody tr')].filter(r=>${JSON.stringify(saleIds)}.some(id=>r.textContent.includes(id))).length`
  check(
    'Sales reports exclude demo receipts by default',
    await reporting.evaluate(fixtureRows + '===2'),
  )
  await reporting.click('input[type="checkbox"]')
  await reporting.until(fixtureRows + '===6')
  check('Owner can explicitly include demo receipts in reports', true)
  await reporting.screenshot('reports-include-demo')
  console.log('ALL CHECKOUT BROWSER CHECKS PASSED:', passed.length)
  await writeFile(
    resolve(out, 'results.json'),
    JSON.stringify(
      { run: fixture.run, passed, at: new Date().toISOString() },
      null,
      2,
    ),
  )
} catch (caught) {
  const error = caught as Error & {
    code?: string
    status?: number
    cause?: { code?: string }
  }
  await mkdir(out, { recursive: true })
  await writeFile(
    resolve(out, 'results.json'),
    JSON.stringify(
      {
        run: fixture?.run,
        passed,
        failure: error.message,
        at: new Date().toISOString(),
      },
      null,
      2,
    ),
  )
  console.error(error.message)
  process.exitCode = 1
} finally {
  await browser?.close()
  children.forEach((child) => child.kill())
  try {
    await fixture?.cleanup()
  } finally {
    await db.$disconnect()
  }
}
