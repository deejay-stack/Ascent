import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  fetchJson,
  ApiError,
  retryConnectionOnce,
} from '../../src/services/http.ts'

test('API client rejects an HTML fallback instead of treating it as a catalog', async (t) => {
  t.mock.method(
    globalThis,
    'fetch',
    async () =>
      new Response('<html>Vite</html>', {
        headers: { 'content-type': 'text/html' },
      }),
  )
  await assert.rejects(
    fetchJson('/api/snapshot'),
    (error) => error instanceof ApiError && error.status === 503,
  )
})

test('retryable writes recover once from a reset but never retry validation or authorization errors', async () => {
  let attempts = 0
  const result = await retryConnectionOnce(async () => {
    if (++attempts === 1) throw new ApiError('Connection reset', 503)
    return 'saved'
  })
  assert.equal(result, 'saved')
  assert.equal(attempts, 2)
  for (const status of [400, 401, 403, 409, 413, 500, 503]) {
    attempts = 0
    await assert.rejects(
      retryConnectionOnce(async () => {
        attempts++
        throw new ApiError('Failed', status)
      }),
      (error) => (error as ApiError).status === status,
    )
    assert.equal(attempts, status === 503 ? 2 : 1)
  }
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
    (error) =>
      (error as ApiError).status === 401 &&
      (error as ApiError).message === 'Session expired',
  )
  mocked.mock.mockImplementation(async () => {
    throw new TypeError('Failed to fetch')
  })
  await assert.rejects(
    fetchJson('/api/me'),
    (error) =>
      (error as ApiError).status === 503 &&
      (error as ApiError).message.includes('store service'),
  )
})
