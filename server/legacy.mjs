import { createServer } from 'node:http'
import { createReadStream, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { extname, join, normalize, resolve } from 'node:path'
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { products as seedProducts } from './catalog.mjs'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const databasePath = process.env.ASCENT_DATA_FILE || join(root, 'server', 'data.json')
const port = Number(process.env.PORT || 4174)

const hashPassword = (password, salt) => scryptSync(password, salt, 64).toString('hex')
const makeAccount = (id, name, email, role, password) => {
  const passwordSalt = randomBytes(16).toString('hex')
  return {
    id,
    name,
    email: email.toLowerCase(),
    role,
    passwordSalt,
    passwordHash: hashPassword(password, passwordSalt),
  }
}

const createStore = () => ({
  users: [
    makeAccount('owner-1', 'Olivia Owner', 'owner@ascent.store', 'owner', 'ascent-demo'),
    makeAccount('staff-1', 'Sam Staff', 'staff@ascent.store', 'staff', 'ascent-demo'),
    makeAccount('customer-1', 'Maya Customer', 'maya@example.com', 'customer', 'ascent-demo'),
  ],
  products: seedProducts,
  sessions: [],
  orders: [],
})

let store
try {
  store = JSON.parse(readFileSync(databasePath, 'utf8'))
  store.products =
    Array.isArray(store.products) && store.products.length ? store.products : seedProducts
  store.sessions = Array.isArray(store.sessions) ? store.sessions : []
  store.orders = Array.isArray(store.orders) ? store.orders : []
} catch {
  store = createStore()
  writeFileSync(databasePath, JSON.stringify(store, null, 2))
}

const save = () => writeFileSync(databasePath, JSON.stringify(store, null, 2))
const publicUser = ({ id, name, email, role, isActive = true }) => ({
  id,
  name,
  email,
  role,
  isActive,
})
const send = (res, status, value) => {
  const body = JSON.stringify(value)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  })
  res.end(body)
}
const readBody = async (req) => {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > 1_000_000) throw new Error('Request is too large.')
    chunks.push(chunk)
  }
  return chunks.length ? JSON.parse(Buffer.concat(chunks).toString('utf8')) : {}
}
const getSession = (req) => {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '')
  const session = token && store.sessions.find((item) => item.token === token)
  if (!session) return null
  return {
    token,
    user: store.users.find((user) => user.id === session.userId && user.isActive !== false),
  }
}
const requireSession = (req, res) => {
  const session = getSession(req)
  if (!session?.user) send(res, 401, { message: 'Please sign in to continue.' })
  return session
}
const createSession = (user) => {
  const token = randomBytes(32).toString('hex')
  store.sessions = store.sessions.filter((session) => session.userId !== user.id)
  store.sessions.push({ token, userId: user.id, createdAt: new Date().toISOString() })
  save()
  return { token, user: publicUser(user) }
}

const api = async (req, res, url) => {
  if (req.method === 'GET' && url.pathname === '/api/health')
    return send(res, 200, { status: 'ok' })

  if (req.method === 'GET' && url.pathname === '/api/products') {
    const search = (url.searchParams.get('search') || '').trim().toLowerCase()
    const category = url.searchParams.get('category') || 'All'
    const sort = url.searchParams.get('sort') || 'featured'
    let result = store.products.filter(
      (product) =>
        (!search ||
          `${product.name} ${product.category} ${product.description}`
            .toLowerCase()
            .includes(search)) &&
        (category === 'All' || product.category === category),
    )
    if (sort === 'price-low') result = result.toSorted((a, b) => a.price - b.price)
    if (sort === 'price-high') result = result.toSorted((a, b) => b.price - a.price)
    if (sort === 'name') result = result.toSorted((a, b) => a.name.localeCompare(b.name))
    return send(res, 200, {
      products: result,
      categories: ['All', ...new Set(store.products.map((product) => product.category))],
    })
  }

  const productMatch = url.pathname.match(/^\/api\/products\/([^/]+)$/)
  if (req.method === 'GET' && productMatch) {
    const product = store.products.find((item) => item.id === decodeURIComponent(productMatch[1]))
    return product ? send(res, 200, { product }) : send(res, 404, { message: 'Product not found.' })
  }

  if (req.method === 'POST' && url.pathname === '/api/auth/login') {
    const body = await readBody(req)
    const user = store.users.find(
      (item) =>
        item.email ===
        String(body.email || '')
          .trim()
          .toLowerCase(),
    )
    if (!user || user.isActive === false)
      return send(res, 401, { message: 'Email or password is incorrect.' })
    const supplied = Buffer.from(
      hashPassword(String(body.password || ''), user.passwordSalt),
      'hex',
    )
    const expected = Buffer.from(user.passwordHash, 'hex')
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected))
      return send(res, 401, { message: 'Email or password is incorrect.' })
    return send(res, 200, createSession(user))
  }

  if (req.method === 'POST' && url.pathname === '/api/auth/register') {
    const body = await readBody(req)
    const name = String(body.name || '').trim()
    const email = String(body.email || '')
      .trim()
      .toLowerCase()
    const password = String(body.password || '')
    if (name.length < 2 || !/^\S+@\S+\.\S+$/.test(email) || password.length < 8)
      return send(res, 400, {
        message: 'Enter a valid name, email, and password of at least 8 characters.',
      })
    if (store.users.some((user) => user.email === email))
      return send(res, 409, { message: 'An account with this email already exists.' })
    const user = makeAccount(`customer-${Date.now()}`, name, email, 'customer', password)
    store.users.push(user)
    return send(res, 201, createSession(user))
  }

  if (req.method === 'POST' && url.pathname === '/api/auth/recover') {
    await readBody(req)
    return send(res, 200, {
      message: 'If an account exists, reset instructions have been prepared.',
    })
  }

  if (req.method === 'GET' && url.pathname === '/api/auth/session') {
    const session = requireSession(req, res)
    if (session?.user) return send(res, 200, { user: publicUser(session.user) })
    return
  }

  if (req.method === 'DELETE' && url.pathname === '/api/auth/session') {
    const session = getSession(req)
    if (session) {
      store.sessions = store.sessions.filter((item) => item.token !== session.token)
      save()
    }
    return send(res, 200, { ok: true })
  }

  if (url.pathname === '/api/me' && req.method === 'PATCH') {
    const session = requireSession(req, res)
    if (!session?.user) return
    const body = await readBody(req)
    const name = String(body.name || '').trim(),
      email = String(body.email || '')
        .trim()
        .toLowerCase()
    if (name.length < 2 || !/^\S+@\S+\.\S+$/.test(email))
      return send(res, 400, { message: 'Enter a valid name and email.' })
    if (store.users.some((u) => u.id !== session.user.id && u.email === email))
      return send(res, 409, { message: 'That email is already registered.' })
    Object.assign(session.user, { name, email })
    save()
    return send(res, 200, { user: publicUser(session.user) })
  }
  if (url.pathname.startsWith('/api/people')) {
    const session = requireSession(req, res)
    if (!session?.user) return
    if (session.user.role !== 'owner')
      return send(res, 403, { message: 'Only owners can manage people.' })
    if (req.method === 'GET' && url.pathname === '/api/people')
      return send(res, 200, { users: store.users.map(publicUser) })
    const body = await readBody(req)
    if (req.method === 'POST' && url.pathname === '/api/people') {
      const name = String(body.name || '').trim(),
        email = String(body.email || '')
          .trim()
          .toLowerCase(),
        password = String(body.password || '')
      if (name.length < 2 || !/^\S+@\S+\.\S+$/.test(email) || password.length < 12)
        return send(res, 400, {
          message: 'Enter a valid name, email and password of at least 12 characters.',
        })
      if (store.users.some((u) => u.email === email))
        return send(res, 409, { message: 'That email is already registered.' })
      const user = makeAccount(
        'staff-' + randomBytes(12).toString('hex'),
        name,
        email,
        'staff',
        password,
      )
      store.users.push(user)
      save()
      return send(res, 201, { user: publicUser(user) })
    }
    if (req.method === 'PATCH') {
      const user = store.users.find(
        (u) => u.id === decodeURIComponent(url.pathname.slice('/api/people/'.length)),
      )
      if (!user) return send(res, 404, { message: 'Account not found.' })
      if (user.role === 'owner')
        return send(res, 400, { message: 'Owner access cannot be disabled here.' })
      if (typeof body.isActive !== 'boolean')
        return send(res, 400, { message: 'A valid account status is required.' })
      user.isActive = body.isActive
      if (!user.isActive) store.sessions = store.sessions.filter((s) => s.userId !== user.id)
      save()
      return send(res, 200, { user: publicUser(user) })
    }
  }
  if (req.method === 'POST' && url.pathname === '/api/newsletter') {
    const body = await readBody(req),
      email = String(body.email || '')
        .trim()
        .toLowerCase()
    if (!/^\S+@\S+\.\S+$/.test(email)) return send(res, 400, { message: 'Enter a valid email.' })
    store.subscribers ??= []
    if (!store.subscribers.some((s) => s.email === email))
      store.subscribers.push({ email, createdAt: new Date().toISOString() })
    save()
    return send(res, 200, { message: 'Your subscription has been saved.' })
  }
  if (req.method === 'GET' && url.pathname === '/api/orders') {
    const session = requireSession(req, res)
    if (!session?.user) return
    const orders =
      session.user.role === 'customer'
        ? store.orders.filter((order) => order.userId === session.user.id)
        : store.orders
    return send(res, 200, { orders: orders.toReversed() })
  }

  if (req.method === 'POST' && url.pathname === '/api/orders') {
    const session = requireSession(req, res)
    if (!session?.user) return
    if (session.user.role !== 'customer')
      return send(res, 403, { message: 'Checkout is available to customer accounts.' })
    const body = await readBody(req)
    const requested = Array.isArray(body.items) ? body.items : []
    if (!requested.length) return send(res, 400, { message: 'Your cart is empty.' })
    const lines = []
    for (const item of requested) {
      const product = store.products.find((candidate) => candidate.id === item.productId)
      const quantity = Math.max(0, Math.floor(Number(item.quantity)))
      if (!product || !quantity)
        return send(res, 400, { message: 'The cart contains an invalid item.' })
      if (product.stock < quantity)
        return send(res, 409, { message: `${product.name} has only ${product.stock} available.` })
      lines.push({
        productId: product.id,
        name: product.name,
        price: product.price,
        unit: product.unit,
        quantity,
        lineTotal: product.price * quantity,
      })
    }
    for (const line of lines)
      store.products.find((product) => product.id === line.productId).stock -= line.quantity
    const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0)
    const order = {
      id: `ASC-${String(Date.now()).slice(-8)}`,
      userId: session.user.id,
      status: 'Processing',
      fulfillment: body.fulfillment === 'delivery' ? 'Delivery' : 'Store pickup',
      createdAt: new Date().toISOString(),
      items: lines,
      subtotal,
      total: subtotal,
    }
    store.orders.push(order)
    save()
    return send(res, 201, { order })
  }

  return send(res, 404, { message: 'API route not found.' })
}

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
}
const serveApp = (res, pathname) => {
  const dist = join(root, 'dist')
  const requested = normalize(join(dist, pathname === '/' ? 'index.html' : pathname))
  const file =
    requested.startsWith(dist) && existsSync(requested) ? requested : join(dist, 'index.html')
  if (!existsSync(file))
    return send(res, 404, { message: 'Build the frontend with npm run build first.' })
  res.writeHead(200, { 'Content-Type': mimeTypes[extname(file)] || 'application/octet-stream' })
  createReadStream(file).pipe(res)
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`)
  try {
    if (url.pathname.startsWith('/api/')) return await api(req, res, url)
    return serveApp(res, decodeURIComponent(url.pathname))
  } catch (error) {
    console.error(error)
    return send(res, error instanceof SyntaxError ? 400 : 500, {
      message: error instanceof Error ? error.message : 'Unexpected server error.',
    })
  }
})

server.listen(port, () => console.log(`ASCENT API listening on http://localhost:${port}`))
