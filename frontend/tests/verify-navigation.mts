import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { browserDriver } from './browser-driver.mts'

const root = fileURLToPath(new URL('../..', import.meta.url))
const origin = 'http://127.0.0.1:5198'
const out = resolve(root, 'artifacts/navigation')
const children = [],
  passed: string[] = [],
  exceptions: unknown[] = []
let browser, failure
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const check = (name: string, value: unknown) => {
  if (!value) throw new Error(name)
  passed.push(name)
  console.log('PASS', name)
}
try {
  await mkdir(out, { recursive: true })
  children.push(
    spawn(process.execPath, [resolve(root, 'backend/src/index.ts')], {
      env: {
        ...process.env,
        ASCENT_DATA_MODE: 'mock',
        PORT: '4198',
        ASCENT_DATA_FILE: resolve(out, 'mock-' + Date.now() + '.json'),
      },
      stdio: 'ignore',
      windowsHide: true,
    }),
  )
  children.push(
    spawn(
      process.execPath,
      [
        resolve(root, 'node_modules/vite/bin/vite.js'),
        '--host',
        '127.0.0.1',
        '--port',
        '5198',
        '--strictPort',
      ],
      {
        cwd: resolve(root, 'frontend'),
        env: {
          ...process.env,
          VITE_DATA_MODE: 'mock',
          ASCENT_API_TARGET: 'http://127.0.0.1:4198',
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
      /* Starting. */
    }
    await delay(150)
  }
  if (!ready) throw new Error('Navigation test servers did not start.')
  browser = await browserDriver(origin, out, 9585)
  const page = await browser.page('navigation')
  page.onEvent((event) => {
    if (event.method === 'Runtime.exceptionThrown')
      exceptions.push(event.params.exceptionDetails!.text)
  })
  await page.navigate('/')
  await page.until('!!document.querySelector(".public-footer")')
  await delay(600)
  await page.evaluate(
    'window.scrollTo({top:document.body.scrollHeight,behavior:"instant"})',
  )
  await page.until('scrollY>1000')
  await page.click('.public-footer a[href="/register"]')
  await page.until(
    'location.pathname==="/register"&&!!document.querySelector(".auth-panel")&&scrollY===0',
  )
  check('Landing footer to registration opens at top', true)
  await page.evaluate(
    'window.scrollTo({top:document.body.scrollHeight,behavior:"instant"})',
  )
  await page.click('.public-footer a[href="/login"]')
  await page.until('location.pathname==="/login"&&scrollY===0')
  check('Registration to login opens at top', true)
  await page.click('.public-footer a[href="/products"]')
  await page.until('!!document.querySelector(".catalog-card")')
  await page.evaluate('window.scrollTo({top:450,behavior:"instant"})')
  await page.until('scrollY===450')
  const details = await page.evaluate(
    'document.querySelector(".catalog-card a").getAttribute("href")',
  )
  await page.click('.catalog-card a')
  await page.until(
    '!!document.querySelector(".product-details-page")&&scrollY===0',
  )
  check('Catalog to product details opens at top', true)
  await page.evaluate('history.back()')
  await page.until('location.pathname==="/products"&&Math.abs(scrollY-450)<2')
  check('Browser Back restores catalog position', true)
  await page.evaluate('history.forward()')
  await page.until(
    'location.pathname===' + JSON.stringify(details) + '&&scrollY===0',
  )
  check('Browser Forward restores product position', true)
  await page.click('.details-back')
  await page.until('location.pathname==="/products"&&scrollY===0')
  check('New navigation to a previously visited route starts at top', true)
  await page.until('!!document.querySelector(".catalog-card")')
  await page.evaluate('window.scrollTo({top:300,behavior:"instant"})')
  await page.until('scrollY===300')
  await page.field('Sort products', 'price-low')
  await page.until('location.search.includes("sort=price-low")')
  const queryScroll = await page.evaluate<number>('scrollY')
  check(
    'Query-only sorting preserves scroll position (actual ' + queryScroll + ')',
    Math.abs(queryScroll - 300) < 2,
  )
  await page.click('.public-footer a[href="/#categories"]')
  await page.until(
    'location.pathname==="/"&&location.hash==="#categories"&&scrollY>100',
  )
  check('Cross-page anchors reach the requested section', true)
  await page.click('a[href="/#faq"]')
  await page.until('location.hash==="#faq"')
  await delay(600)
  check(
    'Same-page anchors remain functional',
    await page.evaluate(
      'Math.abs(document.getElementById("faq").getBoundingClientRect().top)<150',
    ),
  )
  await page.navigate('/#%')
  await page.until('!!document.querySelector(".public-footer")')
  check('Malformed anchor does not crash navigation', exceptions.length === 0)
  await page.call('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  })
  await page.evaluate(
    'window.scrollTo({top:document.body.scrollHeight,behavior:"instant"})',
  )
  await page.click('.public-footer a[href="/register"]')
  await page.until('location.pathname==="/register"&&scrollY===0')
  check(
    'Mobile registration starts at top',
    await page.evaluate('document.documentElement.scrollWidth<=390'),
  )
  await page.call('Page.reload')
  await page.until(
    '!!document.querySelector(".auth-panel")&&location.pathname==="/register"',
  )
  check('Refreshing a deep route renders the form', true)
  await page.screenshot('registration-mobile')
  check('Navigation raises no uncaught browser errors', exceptions.length === 0)
} catch (caught) {
  const error = caught as Error & {
    code?: string
    status?: number
    cause?: { code?: string }
  }
  failure = error.message
  console.error(failure)
  process.exitCode = 1
} finally {
  await writeFile(
    resolve(out, 'results.json'),
    JSON.stringify(
      { passed, failure, exceptions, at: new Date().toISOString() },
      null,
      2,
    ),
  )
  await browser?.close()
  children.forEach((child) => child.kill())
}
