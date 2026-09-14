import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { liveFixture } from '../../backend/tests/helpers/live-fixture.mjs'
import { projectDir, frontendDir } from '../../backend/src/env.mjs'
import { browserDriver } from './browser-driver.mjs'
import { db } from '../../backend/src/db.mjs'
const origin = 'http://127.0.0.1:5190'
const out = resolve(projectDir, 'artifacts/system')
const passed = []
const children = []
let browser, fixture
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const check = (name, value) => {
  if (!value) throw new Error(name)
  passed.push(name)
  console.log('PASS', name)
}
try {
  await mkdir(out, { recursive: true })
  fixture = await liveFixture()
  const owner = await fixture.account('browser-owner', 'owner')
  const staff = await fixture.account('browser-staff', 'staff')
  const customer = await fixture.account('browser-customer', 'customer')
  children.push(
    spawn(process.execPath, [resolve(projectDir, 'backend/src/index.mjs')], {
      env: {
        ...process.env,
        ASCENT_DATA_MODE: 'supabase',
        PORT: '4190',
        ENABLE_PAYMENT_DEMOS: 'false',
      },
      stdio: 'ignore',
      windowsHide: true,
    }),
  )
  children.push(
    spawn(
      process.execPath,
      [
        resolve(projectDir, 'node_modules/vite/bin/vite.js'),
        '--host',
        '127.0.0.1',
        '--port',
        '5190',
        '--strictPort',
      ],
      {
        cwd: frontendDir,
        env: {
          ...process.env,
          VITE_DATA_MODE: 'supabase',
          ASCENT_API_TARGET: 'http://127.0.0.1:4190',
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
      const response = await fetch(origin + '/api/health')
      if (response.ok) {
        ready = true
        break
      }
    } catch {
      /* Wait for the test servers to start. */
    }
    await delay(200)
  }
  if (!ready) throw new Error('Live test servers did not start.')
  browser = await browserDriver(origin, out)
  const management = await browser.page('owner')
  const shopping = await browser.page('customer')
  const second = await browser.page('second-session')
  await management.login(owner)
  check('Owner signs in through Supabase Auth and loads the dashboard', true)
  await management.navigate('/owner/inventory')
  await management.button('Manage categories')
  await management.field('Category name', fixture.run + ' browser aisle')
  await management.button('Add category')
  await management.until(
    `document.querySelector('dialog').textContent.includes(${JSON.stringify(fixture.run + ' browser aisle')})`,
  )
  await management.click('[aria-label="Close Manage categories"]')
  const category = await db.category.findUnique({ where: { name: fixture.run + ' browser aisle' } })
  check('Inventory category form writes to PostgreSQL', !!category)
  await management.button('Add product')
  const name = fixture.run + ' Browser Rice'
  await management.field('Product name', name)
  await management.field('Description', 'Live browser system test product')
  await management.field('Category', category.id)
  await management.field('Selling price', '25')
  await management.field('Cost price', '10')
  await management.field('SKU', fixture.run.toUpperCase() + '-BROWSER')
  await management.field('Barcode', String(Date.now()))
  await management.field('Opening stock', '12')
  await management.field('Choose a supplied photo', '/images/products/staples/jasmine_rice.jpg')
  await management.button('Create product')
  await management.until('!document.querySelector("dialog[open]")')
  const product = await db.product.findFirst({ where: { categoryId: category.id } })
  check(
    'Product form persists photo, price and opening stock',
    product?.stockQuantity === 12 && Number(product.sellingPrice) === 25,
  )
  await management.screenshot('owner-inventory')
  await shopping.login(customer)
  await shopping.navigate('/products/' + product.id)
  await shopping.until('!!document.querySelector(".details-buy-row")')
  check(
    'Customer sees the owner-created product and its image',
    await shopping.evaluate(
      `document.body.textContent.includes(${JSON.stringify(name)})&&document.querySelector('.product-image').src.endsWith('/jasmine_rice.jpg')`,
    ),
  )
  await shopping.button('Add to cart')
  await shopping.navigate('/cart')
  await shopping.until('document.querySelectorAll(".cart-line").length===1')
  await shopping.until(
    'document.querySelector(".order-summary .button").textContent==="Place order"',
  )
  check(
    'Customer cart form writes its item to PostgreSQL',
    (await db.cartItem.count({ where: { userId: customer.id, productId: product.id } })) === 1,
  )
  await second.login(customer)
  await second.navigate('/cart')
  await second.until('document.querySelectorAll(".cart-line").length===1')
  check('Cart persists into another browser session for the same customer', true)
  await shopping.click(`[aria-label="Increase ${name}"]`)
  await shopping.until(
    'document.querySelector(".cart-line .quantity-control span").textContent==="2"',
  )
  await second.until(
    'document.querySelector(".cart-line .quantity-control span").textContent==="2"',
    15000,
  )
  check('Realtime updates the cart in the second session', true)
  await shopping.button('Place order')
  await shopping.until('!!document.querySelector(".checkout-success")', 40000)
  const order = await db.order.findFirst({
    where: { userId: customer.id },
    include: { items: true },
  })
  check(
    'Checkout creates order lines and clears the persisted cart',
    order?.items[0].quantity === 2 &&
      (await db.cartItem.count({ where: { userId: customer.id } })) === 0,
  )
  await second.until('!!document.querySelector(".empty-cart")', 15000)
  check('Checkout clears the cart across sessions', true)
  await management.navigate('/owner/orders')
  await management.until(`document.body.textContent.includes(${JSON.stringify(order.id)})`)
  await management.button('Record payment / fulfill')
  await management.button('Confirm exact cash received')
  await management.until('!!document.querySelector("#print-receipt")', 40000)
  const sale = await db.sale.findUnique({
    where: { orderId: order.id },
    include: { payment: true },
  })
  check(
    'Order payment produces a persisted cash payment and receipt',
    Number(sale?.total) === 50 && sale.payment.status === 'succeeded',
  )
  await management.screenshot('order-receipt')
  await shopping.navigate('/account/orders')
  await shopping.until('document.body.textContent.includes("Completed")')
  check('Customer order history reflects fulfillment', true)
  await management.navigate('/owner/pos')
  await management.until('!!document.querySelector(".pos-grid")')
  await management.click(`[aria-label="Add ${name} to bill"]`)
  await management.button('Exact amount')
  check(
    'Production POS exposes cash without disabled payment demonstrations',
    await management.evaluate(
      'document.querySelectorAll(".billing-panel select option").length===1',
    ),
  )
  await management.button('Complete sale')
  await management.until('!!document.querySelector("#print-receipt")', 40000)
  check(
    'POS cash checkout persists one stock deduction',
    (await db.product.findUnique({ where: { id: product.id } })).stockQuantity === 9,
  )
  const pdf = await management.call('Page.printToPDF', { printBackground: true })
  await writeFile(resolve(out, 'receipt.pdf'), Buffer.from(pdf.data, 'base64'))
  check('Database-backed receipt prints to PDF', pdf.data.length > 5000)
  await management.navigate('/owner/reports')
  await management.until('!!document.querySelector(".compact-stats")')
  check(
    'Reports calculate totals from database sales',
    await management.evaluate(
      'document.querySelector(".compact-stats").textContent.includes("75.00")',
    ),
  )
  await management.navigate('/owner/inventory')
  await management.field('Search inventory', name)
  await management.button('Adjust stock')
  await management.field('Quantity', '3')
  await management.field('Adjustment reason', 'System test delivery')
  await management.button('Save adjustment')
  await management.until('!document.querySelector("dialog[open]")')
  check(
    'Stock adjustment dialog persists movement and responsible user',
    (await db.product.findUnique({ where: { id: product.id } })).stockQuantity === 12,
  )
  await management.button('Edit')
  const doc = await management.call('DOM.getDocument')
  const upload = await management.call('DOM.querySelector', {
    nodeId: doc.root.nodeId,
    selector: 'dialog input[type="file"]',
  })
  await management.call('DOM.setFileInputFiles', {
    nodeId: upload.nodeId,
    files: [resolve(frontendDir, 'public/images/products/produce/banana.jpg')],
  })
  await management.until(
    'document.querySelector(".editor-image").src.startsWith("https://")',
    40000,
  )
  const imageUrl = await management.evaluate('document.querySelector(".editor-image").src')
  fixture.uploadedKeys.push(imageUrl.split('/').at(-1))
  await management.button('Save product')
  await management.until('!document.querySelector("dialog[open]")')
  check(
    'Image upload form stores the object and product URL',
    (await db.product.findUnique({ where: { id: product.id } })).imageUrl === imageUrl,
  )
  await management.navigate('/owner/profile')
  await management.until('!!document.querySelector(".operation-form")')
  await management.field('Name', fixture.run + ' Updated Owner')
  await management.button('Save profile')
  await management.until('document.body.textContent.includes("Profile saved")')
  check(
    'Profile editor persists to the database',
    (await db.profile.findUnique({ where: { id: owner.id } })).name.endsWith('Updated Owner'),
  )
  await management.navigate('/owner/settings')
  await management.field('Store name', fixture.run + ' Store')
  await management.field('Store address', 'System test address')
  await management.button('Save settings')
  await management.until('document.body.textContent.includes("Store preferences saved")')
  check(
    'Settings form persists shared store preferences',
    (await db.storeSettings.findUnique({ where: { id: 'store' } })).name === fixture.run + ' Store',
  )
  await management.navigate('/owner/people')
  await management.button('Create staff account')
  const newEmail = fixture.run + '-created-staff@example.com'
  await management.field('Full name', fixture.run + ' Created Staff')
  await management.field('Email', newEmail)
  await management.field('Initial password', staff.password)
  await management.button('Create staff')
  await management.until('!document.querySelector("dialog[open]")', 40000)
  const createdStaff = await db.profile.findFirst({ where: { email: newEmail, authDeletedAt: null } })
  check(
    'People form creates a Supabase staff account',
    createdStaff?.role === 'staff' && createdStaff.isActive,
  )
  await management.field('Search people', newEmail)
  await management.button('Disable access')
  await management.until(
    '!!document.querySelector("tbody")&&document.querySelector("tbody").textContent.includes("Disabled")',
  )
  check(
    'People access control persists the disabled status',
    (await db.profile.findFirst({ where: { email: newEmail, authDeletedAt: null } })).isActive === false,
  )
  const staffPage = await browser.page('staff')
  await staffPage.login(staff)
  await staffPage.navigate('/staff/inventory')
  await staffPage.until('!!document.querySelector(".data-table")')
  check(
    'Staff can use inventory without owner editing or cost controls',
    await staffPage.evaluate(
      '!document.querySelector(".data-table thead").textContent.includes("Cost")&&![...document.querySelectorAll("button")].some(b=>b.textContent.trim()==="Add product")',
    ),
  )
  await staffPage.navigate('/owner/reports')
  await staffPage.until('location.pathname==="/unauthorized"')
  check('Staff cannot open owner reporting routes', true)
  await shopping.call('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  })
  await shopping.navigate('/products')
  await shopping.until('document.querySelectorAll(".catalog-card").length>0')
  check(
    'Connected mobile catalog has no horizontal overflow',
    await shopping.evaluate('document.documentElement.scrollWidth<=390'),
  )
  await shopping.screenshot('catalog-mobile')
  console.log('ALL LIVE SYSTEM CHECKS PASSED:', passed.length)
  await writeFile(
    resolve(out, 'results.json'),
    JSON.stringify({ run: fixture.run, passed, at: new Date().toISOString() }, null, 2),
  )
} catch (error) {
  await mkdir(out, { recursive: true })
  await writeFile(
    resolve(out, 'results.json'),
    JSON.stringify(
      { run: fixture?.run, passed, failure: error.message, at: new Date().toISOString() },
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
