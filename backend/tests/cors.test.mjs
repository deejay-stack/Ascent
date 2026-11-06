import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import { cors, frontendOrigins } from '../src/cors.mjs'

test('production CORS requires exact HTTPS frontend origins', () => {
  assert.deepEqual(frontendOrigins('https://shop.example/, https://preview.example', true),
    ['https://shop.example', 'https://preview.example'])
  for (const value of [undefined, '*', 'http://shop.example', 'https://shop.example/path',
    'https://user:password@shop.example', 'https://shop.example?query=1'])
    assert.throws(() => frontendOrigins(value, true))
})

test('cross-origin bearer-token preflights succeed without authentication; unlisted sites fail', async (t) => {
  const app = express()
  app.use(cors(['https://shop.example']))
  app.get('/api/me', (req, res) => res.json({ authorization: req.headers.authorization }))
  const server = app.listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  t.after(() => new Promise((resolve) => server.close(resolve)))
  const url = `http://127.0.0.1:${server.address().port}/api/me`
  const response = await fetch(url, { method: 'OPTIONS', headers: {
    Origin: 'https://shop.example',
    'Access-Control-Request-Method': 'PATCH',
    'Access-Control-Request-Headers': 'authorization,content-type',
  } })
  assert.equal(response.status, 204)
  assert.equal(response.headers.get('access-control-allow-origin'), 'https://shop.example')
  assert.match(response.headers.get('access-control-allow-headers'), /Authorization/)
  assert.equal(response.headers.get('access-control-allow-credentials'), null)
  const signed = await fetch(url, { headers: { Origin: 'https://shop.example', Authorization: 'Bearer test' } })
  assert.equal((await signed.json()).authorization, 'Bearer test')
  assert.equal((await fetch(url, { headers: { Origin: 'https://shop.example.evil' } })).status, 403)
  assert.equal((await fetch(url)).status, 200)
})

test('the local combined server accepts its own origin while rejecting other sites', async (t) => {
  const app = express()
  app.use(cors(['http://localhost:5173'], { allowSameOrigin: true }))
  app.post('/api/example', (_req, res) => res.json({ ok: true }))
  const server = app.listen(0, '127.0.0.1')
  await new Promise((resolve) => server.once('listening', resolve))
  t.after(() => new Promise((resolve) => server.close(resolve)))
  const origin = `http://127.0.0.1:${server.address().port}`
  const response = await fetch(origin + '/api/example', { method: 'POST', headers: { Origin: origin } })
  assert.equal(response.status, 200)
  assert.equal((await fetch(origin + '/api/example', {
    method: 'POST', headers: { Origin: 'https://unlisted.example' },
  })).status, 403)
})
