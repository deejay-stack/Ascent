import { spawn } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

export async function browserDriver(origin, out, port = 9575) {
  await mkdir(out, { recursive: true })
  const browser = spawn(
    'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    [
      '--headless=new',
      '--no-first-run',
      '--disable-gpu',
      '--disable-background-networking',
      `--remote-debugging-port=${port}`,
      `--user-data-dir=${path.join(out, 'browser-' + Date.now())}`,
      'about:blank',
    ],
    { stdio: 'ignore', windowsHide: true },
  )
  let version
  for (let i = 0; i < 80; i++) {
    try {
      version = await fetch(`http://127.0.0.1:${port}/json/version`).then((r) => r.json())
      break
    } catch {
      await delay(150)
    }
  }
  if (!version) {
    browser.kill()
    throw new Error('Headless Edge did not start.')
  }
  const socket = new WebSocket(version.webSocketDebuggerUrl)
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true })
    socket.addEventListener('error', reject, { once: true })
  })
  let sequence = 0
  const pending = new Map()
  const eventListeners = new Map()
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data)
    if (message.method)
      for (const listener of eventListeners.get(message.sessionId) || []) listener(message)
    const task = pending.get(message.id)
    if (task) {
      pending.delete(message.id)
      clearTimeout(task.timeout)
      if (message.error) task.reject(new Error(message.error.message))
      else task.resolve(message.result)
    }
  })
  const send = (method, params = {}, sessionId) =>
    new Promise((resolve, reject) => {
      const id = ++sequence
      const timeout = setTimeout(() => {
        pending.delete(id)
        reject(new Error('Browser command timed out: ' + method))
      }, 30000)
      pending.set(id, { resolve, reject, timeout })
      socket.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }))
    })
  async function page(label) {
    const { browserContextId } = await send('Target.createBrowserContext')
    const { targetId } = await send('Target.createTarget', { url: 'about:blank', browserContextId })
    const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true })
    const call = (method, params) => send(method, params, sessionId)
    const onEvent = (listener) => {
      const listeners = eventListeners.get(sessionId) || new Set()
      listeners.add(listener)
      eventListeners.set(sessionId, listeners)
      return () => listeners.delete(listener)
    }
    await call('Page.enable')
    await call('Runtime.enable')
    await call('Emulation.setDeviceMetricsOverride', {
      width: 1440,
      height: 1000,
      deviceScaleFactor: 1,
      mobile: false,
    })
    await call('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
    })
    const evaluate = async (expression) => {
      const result = await call('Runtime.evaluate', {
        expression,
        awaitPromise: true,
        returnByValue: true,
      })
      if (result.exceptionDetails)
        throw new Error(
          result.exceptionDetails.exception?.description || result.exceptionDetails.text,
        )
      return result.result.value
    }
    const screenshot = async (name) => {
      const shot = await call('Page.captureScreenshot', { format: 'png' })
      await writeFile(path.join(out, name + '.png'), Buffer.from(shot.data, 'base64'))
    }
    const until = async (expression, timeout = 25000) => {
      const start = Date.now()
      while (Date.now() - start < timeout) {
        if (await evaluate(expression)) return
        await delay(120)
      }
      await screenshot('failure-' + label).catch(() => undefined)
      throw new Error(label + ' timed out: ' + expression)
    }
    const navigate = async (route) => {
      await call('Page.navigate', { url: origin + route })
      await until('document.readyState!=="loading"')
    }
    const button = async (text) => {
      await until(
        `[...document.querySelectorAll('button')].some(b=>b.textContent.trim()===${JSON.stringify(text)}&&!b.disabled)`,
      )
      await evaluate(
        `[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(text)}&&!b.disabled).click()`,
      )
    }
    const click = async (selector) => {
      await until(`!!document.querySelector(${JSON.stringify(selector)})`)
      await evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`)
    }
    const field = async (text, value) => {
      await until(
        `(()=>{const root=document.querySelector('dialog[open]')||document;return [...root.querySelectorAll('label')].some(l=>l.textContent.trim().startsWith(${JSON.stringify(text)})&&l.querySelector('input,textarea,select'))})()`,
      )
      await evaluate(
        `(()=>{const root=document.querySelector('dialog[open]')||document;const label=[...root.querySelectorAll('label')].find(l=>l.textContent.trim().startsWith(${JSON.stringify(text)}));const el=label?.querySelector('input,textarea,select');if(!el)throw new Error('Field missing');const proto=el.tagName==='TEXTAREA'?HTMLTextAreaElement.prototype:el.tagName==='SELECT'?HTMLSelectElement.prototype:HTMLInputElement.prototype;Object.getOwnPropertyDescriptor(proto,'value').set.call(el,${JSON.stringify(value)});el.dispatchEvent(new Event(el.tagName==='SELECT'?'change':'input',{bubbles:true}))})()`,
      )
      await delay(50)
    }
    const login = async (account) => {
      await navigate('/login')
      await until('!!document.querySelector(".auth-panel form")')
      await field('Email', account.email)
      await field('Password', account.password)
      await click('.auth-panel button[type="submit"]')
      await until(
        `location.pathname===${JSON.stringify(account.role === 'customer' ? '/account' : '/' + account.role)}`,
        40000,
      )
      await until('document.body.textContent.includes("Connected to Supabase")')
    }
    return { call, evaluate, until, navigate, button, click, field, login, screenshot, onEvent }
  }
  return {
    page,
    close: async () => {
      for (const task of pending.values()) {
        clearTimeout(task.timeout)
        task.reject(new Error('Browser closed'))
      }
      socket.close()
      browser.kill()
    },
  }
}
