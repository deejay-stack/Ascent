import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
const origin = process.env.ASCENT_TEST_URL || 'http://127.0.0.1:5186'
const out = path.resolve('artifacts/phase-1')
await mkdir(out, { recursive: true })
const helpers = []
if (!process.env.ASCENT_TEST_URL) {
  helpers.push(
    spawn(process.execPath, ['server/index.mjs'], {
      env: {
        ...process.env,
        ASCENT_DATA_MODE: 'mock',
        PORT: '4186',
        ASCENT_DATA_FILE: path.join(out, 'test-backend-' + Date.now() + '.json'),
      },
      stdio: 'ignore',
      windowsHide: true,
    }),
  )
  helpers.push(
    spawn(
      process.execPath,
      ['node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', '5186', '--strictPort'],
      {
        env: {
          ...process.env,
          VITE_DATA_MODE: 'mock',
          ASCENT_API_TARGET: 'http://127.0.0.1:4186',
          ASCENT_TEST_CACHE: path.join(out, 'vite-cache'),
        },
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      },
    ),
  )
  helpers.at(-1).stdout.on('data', (data) => process.stdout.write(data))
  helpers.at(-1).stderr.on('data', (data) => process.stderr.write(data))
  let ready = false
  for (let i = 0; i < 100; i++) {
    try {
      const r = await fetch(origin + '/api/health')
      if (r.ok) {
        ready = true
        break
      }
    } catch {}
    await new Promise((r) => setTimeout(r, 150))
  }
  if (!ready) {
    helpers.forEach((p) => p.kill())
    throw new Error('Isolated test servers did not start.')
  }
}
const port = 9573
const browser = spawn(
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  [
    '--headless=new',
    '--no-first-run',
    '--disable-gpu',
    '--disable-background-networking',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${path.join(out, 'browser-profile-' + Date.now())}`,
    'about:blank',
  ],
  { stdio: 'ignore', windowsHide: true },
)
const wait = (ms) => new Promise((r) => setTimeout(r, ms))
const passed = []
let socket
try {
  let version
  for (let i = 0; i < 60; i++) {
    try {
      version = await fetch(`http://127.0.0.1:${port}/json/version`).then((r) => r.json())
      break
    } catch {
      await wait(150)
    }
  }
  if (!version) throw new Error('Headless Edge did not start.')
  const target = await fetch(`http://127.0.0.1:${port}/json/new?${origin}`, { method: 'PUT' }).then(
    (r) => r.json(),
  )
  socket = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true })
    socket.addEventListener('error', reject, { once: true })
  })
  let seq = 0
  const pending = new Map()
  socket.addEventListener('message', (e) => {
    const msg = JSON.parse(e.data)
    if (msg.method === 'Runtime.exceptionThrown')
      console.error('BROWSER ERROR', JSON.stringify(msg.params))
    if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error')
      console.error('BROWSER LOG', msg.params.entry.text)
    if (pending.has(msg.id)) {
      const p = pending.get(msg.id)
      pending.delete(msg.id)
      if (msg.error) p.reject(new Error(msg.error.message))
      else p.resolve(msg.result)
    }
  })
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++seq
      pending.set(id, { resolve, reject })
      socket.send(JSON.stringify({ id, method, params }))
    })
  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', {
      expression,
      awaitPromise: true,
      returnByValue: true,
    })
    if (r.exceptionDetails)
      throw new Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text)
    return r.result.value
  }
  const check = (name, condition) => {
    if (!condition) throw new Error(name)
    passed.push(name)
    console.log('PASS', name)
  }
  const until = async (expression) => {
    for (let i = 0; i < 400; i++) {
      if (await evaluate(expression)) return
      await wait(100)
    }
    await writeFile(
      path.join(out, 'browser-failure-page.txt'),
      await evaluate('document.documentElement.outerHTML'),
    )
    const shot = await send('Page.captureScreenshot', { format: 'png' })
    await writeFile(path.join(out, 'browser-failure.png'), Buffer.from(shot.data, 'base64'))
    throw new Error('Timeout: ' + expression)
  }
  const click = async (selector) => {
    await until(`!!document.querySelector(${JSON.stringify(selector)})`)
    await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`)
    await wait(80)
  }
  const button = async (text) => {
    await evaluate(
      `(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(text)});if(!b)throw new Error('Button missing: '+${JSON.stringify(text)});if(b.disabled)throw new Error('Button disabled: '+${JSON.stringify(text)});b.click()})()`,
    )
    await wait(100)
  }
  const fill = async (selector, value) => {
    await evaluate(
      `(()=>{const el=document.querySelector(${JSON.stringify(selector)});if(!el)throw new Error('Input missing');Object.getOwnPropertyDescriptor(el.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}))})()`,
    )
    await wait(80)
  }
  const navigate = async (route) => {
    await send('Page.navigate', { url: origin + route })
    await until('document.readyState !== "loading"')
    await wait(350)
  }
  const snapshot = async (name) => {
    const shot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true })
    await writeFile(path.join(out, name + '.png'), Buffer.from(shot.data, 'base64'))
  }
  await send('Page.enable')
  await send('Runtime.enable')
  await send('Log.enable')
  await send('Network.enable')
  await send('Network.setBlockedURLs', { urls: ['*fonts.googleapis.com*', '*fonts.gstatic.com*'] })
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1440,
    height: 1100,
    deviceScaleFactor: 1,
    mobile: false,
  })
  await send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
  })
  await navigate('/products')
  await until('document.querySelectorAll(".catalog-card").length===12')
  await button('Load more products (27 remaining)')
  await until('document.querySelectorAll(".catalog-card").length===24')
  check(
    'Catalog pagination loads more',
    await evaluate('document.querySelectorAll(".catalog-card").length===24'),
  )
  await fill('.desktop-filters select', 'beverages')
  await until('document.querySelectorAll(".catalog-card").length===4')
  check(
    'Catalog category filter UI',
    await evaluate('document.querySelectorAll(".catalog-card").length===4'),
  )
  await fill('.desktop-filters input[type="number"]', '60')
  await until('document.querySelectorAll(".catalog-card").length===3')
  check(
    'Catalog minimum price filter UI',
    await evaluate('document.querySelectorAll(".catalog-card").length===3'),
  )
  await fill('.desktop-filters .field:nth-child(3) input', '80')
  await until('document.querySelectorAll(".catalog-card").length===2')
  check(
    'Catalog maximum price filter UI',
    await evaluate('document.querySelectorAll(".catalog-card").length===2'),
  )
  await button('Clear filters')
  await fill('.desktop-filters .field:nth-child(4) select', 'out-of-stock')
  await until('document.querySelectorAll(".catalog-card").length===2')
  check(
    'Catalog out-of-stock buttons disabled',
    await evaluate(
      'document.querySelectorAll(".catalog-card").length===2&&[...document.querySelectorAll(".catalog-add")].every(b=>b.disabled)',
    ),
  )
  await button('Clear filters')
  const serviceChecks = await evaluate(
    `import('/scripts/commerce-checks.mjs').then(m=>m.runCommerceChecks())`,
  )
  passed.push(...serviceChecks)
  console.log('PASS', serviceChecks.length, 'service checks')
  await fill('[aria-label="Search products"]', '4801000000016')
  // Use the actual barcode from the service to avoid duplicating seed details.
  const barcode = await evaluate(
    `import('/src/services/index.ts').then(m=>m.productService.snapshot().find(p=>p.name==='Premium Rice 5 kg').barcode)`,
  )
  await fill('[aria-label="Search products"]', barcode)
  await until('document.querySelectorAll(".catalog-card").length===1')
  check(
    'Catalog barcode search UI',
    await evaluate('document.querySelector(".catalog-card").textContent.includes("Premium Rice")'),
  )
  await button('Quick view')
  await until('!!document.querySelector("dialog[open]")')
  await button('Add to cart')
  check(
    'Quick view adds to cart',
    await evaluate('document.querySelector(".catalog-add").textContent.includes("Added")'),
  )
  await click('[aria-label="Close Premium Rice 5 kg"]')
  await evaluate(`document.querySelector('.product-image').src='/images/test-missing.svg'`)
  await until(
    `document.querySelector('.product-image').src.endsWith('/images/placeholders/product.svg')`,
  )
  check(
    'Image fallback rendered',
    await evaluate('document.querySelector(".product-image").naturalWidth===320'),
  )
  await navigate('/products/grocery-015')
  await until('!!document.querySelector(".details-buy-row")')
  for (let i = 0; i < 35; i++) await click('[aria-label="Increase Bananas 1 kg"]')
  await button('Add to cart')
  check(
    'Customer quantity cannot exceed stock',
    await evaluate('document.querySelector(".details-buy-row .button").disabled'),
  )
  await navigate('/cart')
  await until('document.querySelectorAll(".cart-line").length===2')
  check(
    'Persistent customer cart and quantity limits',
    await evaluate(
      '[...document.querySelectorAll(".cart-line")].some(l=>l.textContent.includes("30"))',
    ),
  )
  await snapshot('cart-desktop')
  await button('Sign in to checkout')
  await until('!!document.querySelector(".auth-panel form")')
  await button('Customer')
  await click('.auth-panel button[type="submit"]')
  await until('location.pathname==="/cart" || location.pathname==="/account"')
  if (await evaluate('location.pathname!=="/cart"')) await navigate('/cart')
  await until(
    '[...document.querySelectorAll("button")].some(b=>b.textContent.trim()==="Place order")',
  )
  await button('Place order')
  await until('!!document.querySelector(".checkout-success")')
  check('Customer checkout confirms order', true)
  await navigate('/account/orders')
  await until('document.body.textContent.includes("Awaiting payment")')
  check('Customer order history uses shared store', true)
  // Restore this reservation so the POS fixture retains its known starting stock.
  await evaluate(
    `(async()=>{const {orderService}=await import('/src/services/orders/mockOrderService.ts');const actor={id:'fixture-owner',name:'Fixture Owner',role:'owner'};for(const order of orderService.list(actor))if(order.status==='Awaiting payment')await orderService.cancel(order.id,actor)})()`,
  )
  await button('Sign out')
  await until('location.pathname==="/login"')
  await navigate('/login')
  await until('!!document.querySelector(".auth-panel form")')
  await click('.auth-panel button[type="submit"]')
  await until('location.pathname==="/owner"')
  await evaluate(
    `import('/src/services/storage/mockStorage.ts').then(m=>m.mockStorage.setText('ascent-theme','light'))`,
  )
  await navigate('/owner/pos')
  await until('!!document.querySelector(".pos-grid")')
  await fill('[aria-label="POS search"]', 'ASC-STA-001')
  check('POS SKU search UI', await evaluate('document.querySelectorAll(".pos-product").length===1'))
  await fill('[aria-label="POS search"]', '')
  check(
    'POS out-of-stock product disabled',
    await evaluate('document.querySelector(\'[aria-label="Add Onions 1 kg to bill"]\').disabled'),
  )
  await button('Camera scanner')
  check(
    'Camera scanner requires explicit start',
    await evaluate('document.querySelector("dialog").textContent.includes("Start the camera")'),
  )
  await button('Use barcode input')
  const emptyBarcode = await evaluate(
    `import('/src/services/index.ts').then(m=>m.productService.snapshot().find(p=>p.name==='Onions 1 kg').barcode)`,
  )
  await fill('[aria-label="Barcode input"]', emptyBarcode)
  await evaluate('document.querySelector(".pos-searches form").requestSubmit()')
  await until('document.body.textContent.includes("Onions 1 kg is out of stock")')
  check('Scanning out-of-stock item gives warning', true)
  await click('[aria-label="Add Premium Rice 5 kg to bill"]')
  await fill('[aria-label="Barcode input"]', barcode)
  await evaluate('document.querySelector(".pos-searches form").requestSubmit()')
  await wait(80)
  await fill('[aria-label="Barcode input"]', barcode)
  await evaluate('document.querySelector(".pos-searches form").requestSubmit()')
  await wait(80)
  check(
    'Duplicate barcode scan ignored in UI',
    await evaluate('document.querySelector(".billing-line output").textContent==="2"'),
  )
  check(
    'Scanner keeps input focus',
    await evaluate('document.activeElement.getAttribute("aria-label")==="Barcode input"'),
  )
  await wait(400)
  await fill('[aria-label="Barcode input"]', barcode)
  await evaluate('document.querySelector(".pos-searches form").requestSubmit()')
  await wait(100)
  check(
    'Deliberate rescan increments quantity',
    await evaluate('document.querySelector(".billing-line output").textContent==="3"'),
  )
  await fill('[aria-label="Barcode input"]', '0000000')
  await evaluate('document.querySelector(".pos-searches form").requestSubmit()')
  await until('document.body.textContent.includes("Unknown barcode")')
  check('Unknown barcode feedback', true)
  await click('[aria-label="Decrease Premium Rice 5 kg"]')
  await fill('.billing-panel input[placeholder="0.00"]', '1')
  check(
    'Cash insufficiency warning',
    await evaluate(
      'document.querySelector(".billing-panel").textContent.includes("Insufficient cash")',
    ),
  )
  await fill('.billing-panel input[placeholder="0.00"]', '1000')
  check(
    'Cash change calculation UI',
    await evaluate('document.querySelector(".change-row").textContent.includes("350.00")'),
  )
  await snapshot('pos-desktop')
  await button('Complete sale')
  await until('!!document.querySelector("#print-receipt")')
  check(
    'Payment creates receipt with price snapshots',
    await evaluate('document.querySelector("#print-receipt").textContent.includes("650.00")'),
  )
  await evaluate('window.__printCalls=0;window.print=()=>{window.__printCalls++}')
  await button('Print receipt')
  check('Print receipt action', await evaluate('window.__printCalls===1'))
  await send('Emulation.setEmulatedMedia', { media: 'print' })
  check(
    'Print CSS hides application shell',
    await evaluate('getComputedStyle(document.querySelector("#root")).display==="none"'),
  )
  const pdf = await send('Page.printToPDF', { printBackground: true })
  await writeFile(path.join(out, 'receipt.pdf'), Buffer.from(pdf.data, 'base64'))
  check('Receipt PDF generated', pdf.data.length > 5000)
  await send('Emulation.setEmulatedMedia', { media: 'screen' })
  await snapshot('receipt-desktop')
  await button('New transaction')
  check(
    'Completed sale clears bill',
    await evaluate('document.querySelectorAll(".billing-line").length===0'),
  )
  await click('[aria-label="Add Bottled Water 1 L to bill"]')
  await fill('.billing-panel select', 'gcash')
  await button('Open payment demonstration')
  check(
    'Opening QR does not complete sale',
    await evaluate(
      'document.querySelector(".payment-demo").textContent.includes("Pending payment")',
    ),
  )
  await button('Simulate Failed Payment')
  await button('Return to bill')
  check(
    'Failed QR retains bill',
    await evaluate('document.querySelectorAll(".billing-line").length===1'),
  )
  await button('Open payment demonstration')
  await button('Cancel Payment')
  check(
    'Cancelled QR retains bill',
    await evaluate('document.querySelectorAll(".billing-line").length===1'),
  )
  await button('Open payment demonstration')
  await button('Simulate Successful Payment')
  await until('!!document.querySelector("#print-receipt")')
  await button('Close receipt')
  await navigate('/owner')
  await until('!!document.querySelector(".compact-stats")')
  check(
    'Dashboard shows POS sales after navigation',
    await evaluate('document.querySelector(".compact-stats").textContent.includes("675.00")'),
  )
  await snapshot('dashboard-desktop')
  await evaluate(
    `(async()=>{const {salesService}=await import('/src/services/index.ts');const {authApi}=await import('/src/services/api.ts');await salesService.complete({transactionId:salesService.nextTransaction(),actor:await authApi.session(),items:[{productId:'grocery-033',quantity:1}],discount:0,taxRate:0,paymentMethod:'cash',amountReceived:32})})()`,
  )
  await until('document.querySelector(".compact-stats").textContent.includes("707.00")')
  check('Mounted dashboard updates immediately without reload', true)
  await navigate('/owner/reports')
  await until('!!document.querySelector(".data-table")')
  check(
    'Report totals and transactions',
    await evaluate('document.querySelector(".compact-stats").textContent.includes("707.00")'),
  )
  await navigate('/owner/inventory')
  await until('!!document.querySelector(".table-product")')
  check(
    'Stock and inventory movement UI',
    await evaluate(
      'document.body.textContent.includes("POS sale")&&document.body.textContent.includes("43")',
    ),
  )
  await button('Adjust stock')
  await fill('dialog input[type="number"]', '3')
  await evaluate(
    `(()=>{const el=document.querySelector('dialog textarea');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(el,'Browser test delivery');el.dispatchEvent(new Event('input',{bubbles:true}))})()`,
  )
  await button('Save adjustment')
  await until('!document.querySelector("dialog[open]")')
  check(
    'Inventory stock-in form and movement history',
    await evaluate(
      'document.body.textContent.includes("Browser test delivery")&&document.querySelector(".data-table tbody tr").textContent.includes("46")',
    ),
  )
  await button('Edit')
  await fill('dialog input[type="number"]', '330')
  await button('Save product')
  await until('!document.querySelector("dialog[open]")')
  check(
    'Owner product edit form saves price',
    await evaluate('document.querySelector(".data-table tbody tr").textContent.includes("330.00")'),
  )
  await snapshot('inventory-desktop')

  const field = async (label, value) => {
    const selector = await evaluate(
      `(()=>{const label=[...document.querySelectorAll('label')].find(l=>l.textContent.trim().startsWith(${JSON.stringify(label)}));const el=label?.querySelector('input,textarea,select');if(!el)throw new Error('Missing field');el.setAttribute('data-test-field','current');return '[data-test-field="current"]'})()`,
    )
    await evaluate(
      `(()=>{const el=document.querySelector(${JSON.stringify(selector)});const proto=el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:el.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}));el.removeAttribute('data-test-field')})()`,
    )
    await wait(80)
  }
  await button('Manage categories')
  await field('Category name', 'Browser test category')
  await button('Add category')
  await until('document.querySelector("dialog").textContent.includes("Browser test category")')
  check('Owner creates category', true)
  await click('[aria-label="Close Manage categories"]')
  await button('Add product')
  await field('Product name', 'Browser Test Grocery')
  await field('Selling price', '12.50')
  await field('Cost price', '8')
  await field('Description', 'A product created by the browser verification.')
  await field('SKU', 'TEST-GROCERY-001')
  await field('Barcode', '1234567890128')
  await field('Opening stock', '9')
  await button('Create product')
  await until('!document.querySelector("dialog[open]")')
  check(
    'Product creation records opening stock',
    await evaluate(
      `(async()=>{const m=await import('/src/services/index.ts');const {authApi}=await import('/src/services/api.ts');const actor=await authApi.session();return m.inventoryService.list(actor).some(p=>p.name==='Browser Test Grocery'&&p.stockQuantity===9)&&m.inventoryService.movements(actor).some(m=>m.productName==='Browser Test Grocery'&&m.quantity===9)})()`,
    ),
  )
  await navigate('/owner/people')
  await until('!!document.querySelector(".data-table tbody tr")')
  await button('Create staff account')
  await field('Full name', 'Browser Test Staff')
  await field('Email', 'browser.staff@example.com')
  await field('Initial password', 'Browser-Test-Password-2026')
  await button('Create staff')
  await until('!document.querySelector("dialog[open]")')
  check(
    'Owner creates staff account through API',
    await evaluate(
      'document.querySelector(".data-table").textContent.includes("browser.staff@example.com")',
    ),
  )
  await evaluate(
    `(()=>{const row=[...document.querySelectorAll('tbody tr')].find(r=>r.textContent.includes('browser.staff@example.com'));row.querySelector('button').click()})()`,
  )
  await until(
    `[...document.querySelectorAll('tbody tr')].some(r=>r.textContent.includes('browser.staff@example.com')&&r.textContent.includes('Disabled'))`,
  )
  check('Owner disables staff access', true)
  check(
    'Disabled staff cannot sign in',
    await evaluate(
      `fetch('/api/auth/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:'browser.staff@example.com',password:'Browser-Test-Password-2026'})}).then(r=>!r.ok)`,
    ),
  )
  await snapshot('people-desktop')
  await navigate('/owner/profile')
  await until('!!document.querySelector(".operation-form")')
  await field('Name', 'Browser Owner')
  await button('Save profile')
  await until('document.body.textContent.includes("Profile saved")')
  await navigate('/owner/profile')
  await until('!!document.querySelector(".operation-form input")')
  check(
    'Profile changes persist across reload',
    await evaluate('document.querySelector(".operation-form input").value==="Browser Owner"'),
  )

  await navigate('/owner/pos')
  await until('!!document.querySelector(".pos-grid")')
  await send('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  })
  await click('[aria-label="Add Canned Sardines 155 g to bill"]')
  await click('.pos-tabs button:nth-child(2)')
  check(
    'Mobile billing tab visible',
    await evaluate(
      'getComputedStyle(document.querySelector(".billing-panel")).display!=="none"&&getComputedStyle(document.querySelector(".pos-products")).display==="none"',
    ),
  )
  check(
    'Mobile POS has no horizontal page overflow',
    await evaluate('document.documentElement.scrollWidth<=390'),
  )
  await snapshot('pos-mobile-bill')
  await click('.pos-tabs button:first-child')
  await snapshot('pos-mobile-products')
  await navigate('/owner/reports')
  await until('!!document.querySelector(".data-table")')
  check(
    'Sales survive browser refresh',
    await evaluate('document.querySelector(".compact-stats").textContent.includes("707.00")'),
  )
  await navigate('/products')
  await until('document.querySelectorAll(".catalog-card").length>0')
  await button('Filters')
  await until('!!document.querySelector("dialog[open]")')
  check('Responsive filter drawer', true)
  await snapshot('catalog-mobile-filters')
  await writeFile(
    path.join(out, 'verification.json'),
    JSON.stringify({ passed, at: new Date().toISOString() }, null, 2),
  )
  console.log('ALL PASSED:', passed.length)
} catch (error) {
  await writeFile(path.join(out, 'verification-failure.txt'), error.stack)
  console.error(error)
  process.exitCode = 1
} finally {
  socket?.close()
  browser.kill()
  helpers.forEach((p) => p.kill())
}
