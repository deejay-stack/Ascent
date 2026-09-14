import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { projectDir } from '../../backend/src/env.mjs'
import { browserDriver } from './browser-driver.mjs'

// Read-only check of the built application using the configured store accounts.
const origin = 'http://127.0.0.1:4192'
const out = resolve(projectDir, 'artifacts/startup')
const passed = []
let server, browser
const check = (name, value) => {
  if (!value) throw new Error(name)
  passed.push(name)
  console.log('PASS', name)
}
try {
  check(
    'Backend defaults to Supabase with payment demonstrations disabled',
    process.env.ASCENT_DATA_MODE === 'supabase' && process.env.ENABLE_PAYMENT_DEMOS === 'false',
  )
  server = spawn(process.execPath, [resolve(projectDir, 'backend/src/index.mjs')], {
    env: { ...process.env, PORT: '4192' },
    stdio: 'ignore',
    windowsHide: true,
  })
  let health
  for (let i = 0; i < 100; i++) {
    try {
      const response = await fetch(origin + '/api/health')
      if (response.ok) {
        health = await response.json()
        break
      }
    } catch {
      /* Wait for the API to connect. */
    }
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  check('Production server connects to PostgreSQL', health?.database === 'connected')
  browser = await browserDriver(origin, out, 9577)
  for (const role of ['owner', 'staff']) {
    const page = await browser.page(role)
    await page.login({
      role,
      email: process.env[`ASCENT_${role.toUpperCase()}_EMAIL`],
      password: process.env[`ASCENT_${role.toUpperCase()}_PASSWORD`],
    })
    check('Configured ' + role + ' can sign in to the production build', true)
    await page.navigate('/' + role + '/inventory')
    await page.until('!!document.querySelector(".data-table")')
    await page.until('document.body.textContent.includes("Connected to Supabase")')
    check(
      'Production ' + role + ' inventory loads from Supabase',
      await page.evaluate('document.body.textContent.includes("Connected to Supabase")'),
    )
  }
  const publicPage = await browser.page('public')
  await publicPage.navigate('/products')
  await publicPage.until('document.body.textContent.includes("Connected to Supabase")')
  await publicPage.screenshot('catalog')
  check('Production public catalog connects without authentication', true)
  publicPage.onEvent((event) => {
    if (event.method === 'Fetch.requestPaused')
      void publicPage.call('Fetch.fulfillRequest', {
        requestId: event.params.requestId,
        responseCode: 503,
        responseHeaders: [{ name: 'Content-Type', value: 'application/json' }],
        body: Buffer.from(JSON.stringify({ message: 'Temporary test outage' })).toString('base64'),
      })
  })
  await publicPage.call('Fetch.enable', { patterns: [{ urlPattern: '*/api/snapshot' }] })
  await publicPage.evaluate('window.dispatchEvent(new Event("focus"))')
  await publicPage.until('document.body.textContent.includes("Connection interrupted")')
  check(
    'A loaded empty catalog survives a temporary refresh failure',
    await publicPage.evaluate(
      '!document.body.textContent.includes("Store connection unavailable")',
    ),
  )
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
} finally {
  await mkdir(out, { recursive: true })
  await writeFile(
    resolve(out, 'results.json'),
    JSON.stringify({ passed, success: !process.exitCode, at: new Date().toISOString() }, null, 2),
  )
  await browser?.close()
  server?.kill()
}
