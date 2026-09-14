import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { projectDir } from '../../backend/src/env.mjs'
import { db } from '../../backend/src/db.mjs'
import { liveFixture } from '../../backend/tests/helpers/live-fixture.mjs'
import { browserDriver } from './browser-driver.mjs'
const origin = 'http://127.0.0.1:4194',
  out = resolve(projectDir, 'artifacts/auth')
const passed = []
let fixture, server, browser
const check = (name, value) => {
  if (!value) throw new Error(name)
  passed.push(name)
  console.log('PASS', name)
}
try {
  fixture = await liveFixture()
  const owner = await fixture.account('auth-reviewer', 'owner')
  server = spawn(process.execPath, [resolve(projectDir, 'backend/src/index.mjs')], {
    env: { ...process.env, PORT: '4194' },
    stdio: 'ignore',
    windowsHide: true,
  })
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(origin + '/api/health')).ok) break
    } catch {
      /* Wait for startup. */
    }
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  browser = await browserDriver(origin, out, 9579)
  const connection = await browser.page('connection')
  let unavailable = true,
    interceptionError
  connection.onEvent((event) => {
    if (event.method !== 'Fetch.requestPaused') return
    void (
      unavailable
        ? connection.call('Fetch.fulfillRequest', {
            requestId: event.params.requestId,
            responseCode: 503,
            responseHeaders: [{ name: 'Content-Type', value: 'application/json' }],
            body: Buffer.from(JSON.stringify({ message: 'Test service outage' })).toString(
              'base64',
            ),
          })
        : connection.call('Fetch.continueRequest', {
            requestId: event.params.requestId,
          })
    ).catch((error) => {
      interceptionError = error.message
    })
  })
  await connection.call('Fetch.enable', {
    patterns: [{ urlPattern: '*/api/snapshot' }],
  })
  await connection.navigate('/products')
  await connection.until('document.body.textContent.includes("Retry connection")')
  unavailable = false
  await connection.button('Retry connection')
  await connection.until('document.body.textContent.includes("Connected to Supabase")')
  check('Retry recovers the catalog after a failed request', !interceptionError)
  unavailable = true
  await connection.navigate('/products')
  await connection.until('document.body.textContent.includes("Retry connection")')
  await connection.click('a[href="/login"]')
  await connection.until('!!document.querySelector(".auth-panel form")')
  check('Sign-in remains accessible while catalog requests fail', true)
  check(
    'Live sign-in has blank credentials and no demo role picker',
    await connection.evaluate(
      '![...document.querySelectorAll(".auth-panel input")].some(i=>i.value)&&!document.querySelector(".role-switch")&&!document.querySelector(".auth-panel").textContent.includes("demo account")',
    ),
  )
  const management = await browser.page('reviewer')
  await management.login(owner)
  for (const role of ['customer', 'staff', 'owner']) {
    const page = await browser.page('signup-' + role)
    const email = fixture.run + '-signup-' + role + '@example.com'
    const password = owner.password
    let registered, signupFailure
    // Exercise the real Auth signup trigger and password hashing without sending test emails.
    // Only delivery is replaced: generateLink supplies a real confirmation token to verifyOtp.
    page.onEvent((event) => {
      if (event.method !== 'Fetch.requestPaused') return
      void (async () => {
        if (event.params.request.method === 'OPTIONS') {
          await page.call('Fetch.continueRequest', {
            requestId: event.params.requestId,
          })
          return
        }
        const input = JSON.parse(event.params.request.postData)
        const { data, error } = await fixture.admin.auth.admin.generateLink({
          type: 'signup',
          email: input.email,
          password: input.password,
          options: { data: { ...input.data, role: 'owner' } },
        })
        if (error) throw new Error('Test registration setup failed: ' + error.code)
        registered = data
        fixture.accountIds.push(data.user.id)
        await page.call('Fetch.fulfillRequest', {
          requestId: event.params.requestId,
          responseCode: 200,
          responseHeaders: [
            { name: 'Content-Type', value: 'application/json' },
            { name: 'Access-Control-Allow-Origin', value: origin },
          ],
          body: Buffer.from(JSON.stringify({ user: data.user })).toString('base64'),
        })
      })().catch((error) => {
        signupFailure = error.message
        console.error('Registration test setup:', error.message)
      })
    })
    await page.call('Fetch.enable', {
      patterns: [{ urlPattern: '*/auth/v1/signup*' }],
    })
    await page.navigate('/register')
    await page.field('Account type', role)
    await page.field('Full name', fixture.run + ' ' + role)
    await page.field('Email', email)
    await page.field('Password', password)
    await page.field('Confirm password', password)
    await page.button('Create account')
    await page.until('document.body.textContent.includes("Account created.")', 40000)
    check(role + ' registration shows the confirmation step', !!registered && !signupFailure)
    const profile = await db.profile.findUnique({
      where: { id: registered.user.id },
    })
    check(
      role + ' profile starts as customer; metadata cannot grant admin',
      profile.role === 'customer' && profile.requestedRole === (role === 'customer' ? null : role),
    )
    const hashes =
      await db.$queryRaw`SELECT encrypted_password <> ${password} AND length(encrypted_password) > 40 AS hashed FROM auth.users WHERE id = ${registered.user.id}::uuid`
    check(role + ' credentials are hashed in Supabase Auth', hashes[0]?.hashed)
    const client = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const confirmed = await client.auth.verifyOtp({
      token_hash: registered.properties.hashed_token,
      type: 'signup',
    })
    check(role + ' confirmation token is accepted by Supabase Auth', !confirmed.error)
    const account = { role: 'customer', email, password }
    await page.login(account)
    if (role !== 'customer') {
      await page.until('document.body.textContent.includes("awaiting owner approval")')
      const forbidden = await fetch(
        origin + '/api/people/' + registered.user.id + '/access-request',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: 'Bearer ' + confirmed.data.session.access_token,
          },
          body: JSON.stringify({ approve: true }),
        },
      )
      check(role + ' cannot self-approve privileged access', forbidden.status === 403)
      await management.navigate('/owner/people')
      await management.field('Search people', email)
      await management.button('Approve ' + (role === 'owner' ? 'admin' : 'staff'))
      await management.until(
        '!!document.querySelector("tbody")&&!document.querySelector("tbody").textContent.includes("Requests")',
      )
      const approved = await db.profile.findUnique({
        where: { id: registered.user.id },
      })
      check(
        role + ' approval persists only the requested role',
        approved.role === role && approved.requestedRole === null,
      )
      const approvedPage = await browser.page('approved-' + role)
      await approvedPage.login({ ...account, role })
      check(role + ' signs into the approved workspace with their own credentials', true)
      if (role === 'owner') {
        await approvedPage.navigate('/owner/people')
        await approvedPage.field('Search people', email)
        await approvedPage.until('!!document.querySelector("tbody tr")')
        check(
          'Owner cannot disable their own account in People',
          await approvedPage.evaluate(
            '!document.querySelector("tbody").textContent.includes("Disable access")',
          ),
        )
        await approvedPage.field('Search people', owner.email)
        await approvedPage.button('Disable access')
        await approvedPage.until(
          'document.querySelector("tbody")?.textContent.includes("Disabled")',
        )
        const retired = await db.profile.findUnique({
          where: { id: owner.id },
        })
        check(
          'New owner retires the previous owner while preserving their identity',
          !retired.isActive && retired.role === 'owner' && retired.email === owner.email,
        )
        const denied = await fetch(origin + '/api/people', {
          headers: { Authorization: 'Bearer ' + owner.token },
        })
        check('Retired owner loses API access even with an existing session', denied.status === 403)
        await approvedPage.button('Enable access')
        await approvedPage.until(
          'document.querySelector("tbody")?.textContent.includes("Disable access")',
        )
        check(
          'Owner can restore access if a handover is reversed',
          (await db.profile.findUnique({ where: { id: owner.id } })).isActive,
        )
        await approvedPage.navigate('/owner/profile')
        await approvedPage.click('a[href="/reset-password"]')
        await approvedPage.field('New password', password + '-changed')
        await approvedPage.field('Confirm password', password + '-changed')
        await approvedPage.button('Update password')
        await approvedPage.until(
          'document.querySelector("[role=status]")?.textContent.includes("Your password has been updated.")',
        )
        const changed = await browser.page('changed-owner-password')
        await changed.login({
          ...account,
          role,
          password: password + '-changed',
        })
        check('Profile password change persists in Supabase and permits a fresh sign-in', true)
      }
    }
    await client.removeAllChannels()
  }
  console.log('ALL AUTH/CONNECTION CHECKS PASSED:', passed.length)
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
} finally {
  await mkdir(out, { recursive: true })
  await writeFile(
    resolve(out, 'results.json'),
    JSON.stringify(
      {
        run: fixture?.run,
        passed,
        success: !process.exitCode,
        emailDelivery:
          'Simulated; real signup links and OTP verification used without sending messages',
        at: new Date().toISOString(),
      },
      null,
      2,
    ),
  )
  await browser?.close()
  server?.kill()
  try {
    await fixture?.cleanup()
  } finally {
    await db.$disconnect()
  }
}
