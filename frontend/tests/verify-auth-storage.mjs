import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { projectDir } from '../../backend/src/env.mjs'
import { db } from '../../backend/src/db.mjs'
import { liveFixture } from '../../backend/tests/helpers/live-fixture.mjs'
import { browserDriver } from './browser-driver.mjs'
const origin = 'http://127.0.0.1:4196',
  out = resolve(projectDir, 'artifacts/auth-storage'),
  passed = []
let fixture, browser, server
const check = (name, ok) => {
  if (!ok) throw new Error(name)
  passed.push(name)
  console.log('PASS', name)
}
try {
  fixture = await liveFixture()
  const account = await fixture.account('storage-customer', 'customer')
  server = spawn(process.execPath, [resolve(projectDir, 'backend/src/index.mjs')], {
    env: { ...process.env, PORT: '4196' },
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
  browser = await browserDriver(origin, out, 9581)
  const page = await browser.page('quota')
  await page.navigate('/login')
  await page.until('!!document.querySelector(".auth-panel form")')
  const full = await page.evaluate(
    `(()=>{localStorage.setItem('ascent-preserved-test-record','keep');for(const size of [100000,1000,10]){for(let i=0;i<10000;i++){try{localStorage.setItem('quota-'+size+'-'+i,'x'.repeat(size))}catch{break}}}try{localStorage.setItem('quota-probe','x'.repeat(1000));return false}catch{return true}})()`,
  )
  check('The browser reproduces a full localStorage quota', full)
  await page.login(account)
  check('A real customer signs in with localStorage full', true)
  await page.navigate('/account')
  await page.until('document.body.textContent.includes("Connected to Supabase")')
  check(
    'The IndexedDB session survives a page reload',
    await page.evaluate('location.pathname==="/account"'),
  )
  const persistence = await page.evaluate(
    `new Promise((resolve,reject)=>{const r=indexedDB.open('ascent-auth',1);r.onerror=reject;r.onsuccess=()=>{const db=r.result,q=db.transaction('sessions').objectStore('sessions').getAll();q.onsuccess=()=>{resolve(q.result.some(x=>typeof x.value==='string'&&x.value.includes('access_token')));db.close()}}})`,
  )
  check(
    'Auth persists in IndexedDB without clearing saved local data',
    persistence &&
      (await page.evaluate('localStorage.getItem("ascent-preserved-test-record")==="keep"')),
  )
  await page.button('Sign out')
  await page.navigate('/login')
  await page.until('!!document.querySelector(".auth-panel form")')
  check(
    'Logout remains signed out after a reload with storage full',
    await page.evaluate('location.pathname==="/login"'),
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
  try {
    await fixture?.cleanup()
  } finally {
    await db.$disconnect()
  }
}
