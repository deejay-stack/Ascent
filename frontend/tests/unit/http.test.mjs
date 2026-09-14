import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fetchJson, ApiError } from '../../src/services/http.ts'

test('API client rejects an HTML fallback instead of treating it as a catalog', async (t) => {
  t.mock.method(
    globalThis,
    'fetch',
    async () => new Response('<html>Vite</html>', { headers: { 'content-type': 'text/html' } }),
  )
  await assert.rejects(
    fetchJson('/api/snapshot'),
    (error) => error instanceof ApiError && error.status === 503,
  )
})
test('API client preserves authentication errors and explains network failure', async (t) => {
  const mocked = t.mock.method(
    globalThis,
    'fetch',
    async () =>
      new Response(JSON.stringify({ message: 'Session expired' }), {
        status: 401,
        headers: { 'content-type': 'application/json' },
      }),
  )
  await assert.rejects(
    fetchJson('/api/me'),
    (error) => error.status === 401 && error.message === 'Session expired',
  )
  mocked.mock.mockImplementation(async () => {
    throw new TypeError('Failed to fetch')
  })
  await assert.rejects(
    fetchJson('/api/me'),
    (error) => error.status === 503 && error.message.includes('store service'),
  )
})
