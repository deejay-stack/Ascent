import { spawn } from 'node:child_process'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const [
  url,
  outputPath,
  sectionId = 'home',
  widthValue = '1440',
  heightValue = '1100',
  delayValue = '700',
  clickSelector,
] = process.argv.slice(2)
const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe'
const port = 9300 + Math.floor(Math.random() * 500)
const width = Number(widthValue)
const height = Number(heightValue)
const captureDelay = Number(delayValue)
const profilePath = await mkdtemp(path.join(os.tmpdir(), 'ascent-edge-'))

if (!url || !outputPath)
  throw new Error('Usage: node capture-section.mjs <url> <output> [section] [width] [height]')

await mkdir(path.dirname(path.resolve(outputPath)), { recursive: true })

const browser = spawn(
  edgePath,
  [
    '--headless=new',
    '--no-sandbox',
    '--no-first-run',
    '--disable-gpu',
    '--disable-gpu-sandbox',
    '--use-angle=swiftshader',
    '--disable-background-timer-throttling',
    '--disable-renderer-backgrounding',
    '--hide-scrollbars',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profilePath}`,
    `--window-size=${width},${height}`,
    'about:blank',
  ],
  { stdio: 'ignore' },
)

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds))

try {
  let version
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      version = await fetch(`http://127.0.0.1:${port}/json/version`).then((response) =>
        response.json(),
      )
      break
    } catch {
      await wait(150)
    }
  }

  if (!version) throw new Error('Edge debugging endpoint did not start')

  const target = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`, {
    method: 'PUT',
  }).then((response) => response.json())
  const socket = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true })
    socket.addEventListener('error', reject, { once: true })
  })

  let messageId = 0
  const pending = new Map()
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data)
    if (!message.id || !pending.has(message.id)) return
    const { resolve, reject } = pending.get(message.id)
    pending.delete(message.id)
    if (message.error) reject(new Error(message.error.message))
    else resolve(message.result)
  })

  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const id = ++messageId
      pending.set(id, { resolve, reject })
      socket.send(JSON.stringify({ id, method, params }))
    })

  await send('Page.enable')
  await send('Page.bringToFront')
  await send('Emulation.setDeviceMetricsOverride', {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: width < 600,
  })
  await send('Emulation.setEmulatedMedia', {
    features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
  })
  await send('Page.navigate', { url })
  for (let attempt = 0; attempt < 30; attempt += 1) {
    const state = await send('Runtime.evaluate', {
      expression: `document.readyState === 'complete' && Boolean(${sectionId === 'body' ? 'document.body' : `document.getElementById(${JSON.stringify(sectionId)})`})`,
      returnByValue: true,
    })
    if (state.result.value) break
    await wait(100)
  }
  await wait(500)
  if (new URL(url).hostname === 'www.hhhusher.com') {
    await send('Runtime.evaluate', {
      expression: `Array.from(document.querySelectorAll('button')).find((button) => button.textContent?.includes('Accept All'))?.click()`,
    })
  }
  await send('Runtime.evaluate', {
    expression: `(() => { const element = ${sectionId === 'body' ? 'document.body' : `document.getElementById(${JSON.stringify(sectionId)})`}; if (!element) return false; const fullBleed = ${JSON.stringify(['home', 'how-it-works'].includes(sectionId))}; window.scrollTo(0, ${sectionId === 'body' ? '0' : 'element.offsetTop - (fullBleed ? 0 : 76)'}); return true })()`,
    returnByValue: true,
  })
  if (clickSelector) {
    await send('Runtime.evaluate', {
      expression: `document.querySelector(${JSON.stringify(clickSelector)})?.click()`,
    })
  }
  await wait(captureDelay)
  const screenshot = await send('Page.captureScreenshot', { format: 'png', fromSurface: true })
  await writeFile(path.resolve(outputPath), Buffer.from(screenshot.data, 'base64'))
  socket.close()
} finally {
  browser.kill()
  await wait(250)
  await rm(profilePath, { force: true, recursive: true }).catch(() => undefined)
}
