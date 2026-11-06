import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { createServer as createViteServer } from 'vite'
import { apiProxy } from '../../api-proxy.ts'

test(
  'Vite returns JSON on an upstream reset, does not replay writes, and recovers on the next request',
  { timeout: 20000 },
  async () => {
    let reset = true,
      requests = 0,
      vite,
      proxy
    const upstream = createServer((req, res) => {
      requests++
      req.resume()
      req.on('end', () => {
        if (reset) req.socket.destroy()
        else res.writeHead(200, { 'Content-Type': 'application/json' }).end('{"ok":true}')
      })
    })
    const listen = (server) => new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
    const close = async (server) => {
      if (!server) return
      server.closeAllConnections()
      await new Promise((resolve) => server.close(resolve))
    }
    try {
      await listen(upstream)
      vite = await createViteServer({
        configFile: false,
        logLevel: 'silent',
        server: {
          middlewareMode: true,
          proxy: { '/api': apiProxy('http://127.0.0.1:' + upstream.address().port) },
        },
      })
      proxy = createServer(vite.middlewares)
      await listen(proxy)
      const url = 'http://127.0.0.1:' + proxy.address().port + '/api/products'
      const failed = await fetch(url, { method: 'POST', body: '{}' })
      assert.equal(failed.status, 503)
      assert.match((await failed.json()).message, /interrupted/)
      assert.equal(requests, 1)
      reset = false
      const recovered = await fetch(url, { method: 'POST', body: '{}' })
      assert.equal(recovered.status, 200)
      assert.deepEqual(await recovered.json(), { ok: true })
      assert.equal(requests, 2)
    } finally {
      await close(proxy)
      await vite?.close()
      await close(upstream)
    }
  },
)
