import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createAuthStorage } from '../../src/services/storage/authStorage.ts'
function fixture() {
  const records = new Map<string, { value: string | null }>(),
    legacy = new Map([
      ['sb-test-auth-token', 'old-session'],
      ['ascent-commerce-v1', 'saved-inventory'],
    ])
  const store = {
    read: async (key: string) => records.get(key),
    write: async (key: string, value: { value: string | null }) => {
      records.set(key, value)
    },
  }
  const storage = {
    get length() {
      return legacy.size
    },
    key: (index: number) => [...legacy.keys()][index] ?? null,
    clear: () => legacy.clear(),
    getItem: (key: string) => legacy.get(key) ?? null,
    removeItem: (key: string) => legacy.delete(key),
    setItem: () => {
      throw new Error('QuotaExceededError')
    },
  }
  return {
    records,
    legacy,
    store,
    storage,
    auth: createAuthStorage(store, () => storage),
  }
}
test('a full localStorage does not prevent saving and reloading an Auth session', async () => {
  const f = fixture()
  await f.auth.setItem('sb-test-auth-token', 'new-session')
  assert.equal(
    await createAuthStorage(f.store, () => f.storage).getItem(
      'sb-test-auth-token',
    ),
    'new-session',
  )
  assert.equal(f.legacy.get('ascent-commerce-v1'), 'saved-inventory')
})
test('existing sessions migrate only after a successful durable write', async () => {
  const f = fixture()
  assert.equal(await f.auth.getItem('sb-test-auth-token'), 'old-session')
  assert.equal(f.legacy.has('sb-test-auth-token'), false)
  assert.equal(f.legacy.get('ascent-commerce-v1'), 'saved-inventory')
  const failed = fixture()
  failed.store.write = async () => {
    throw new Error('Storage unavailable')
  }
  await assert.rejects(failed.auth.getItem('sb-test-auth-token'))
  assert.equal(failed.legacy.get('sb-test-auth-token'), 'old-session')
})
test('logout cannot resurrect a stale legacy session when removal is blocked', async () => {
  const f = fixture()
  f.storage.removeItem = () => {
    throw new Error('Storage blocked')
  }
  await f.auth.removeItem('sb-test-auth-token')
  assert.equal(
    await createAuthStorage(f.store, () => f.storage).getItem(
      'sb-test-auth-token',
    ),
    null,
  )
})
