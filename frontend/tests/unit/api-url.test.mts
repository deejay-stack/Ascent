import test from 'node:test'
import assert from 'node:assert/strict'
import { apiUrl } from '../../src/services/apiUrl.ts'

test('API paths use the local proxy or the independently deployed backend', () => {
  assert.equal(apiUrl('/api/me'), '/api/me')
  assert.equal(
    apiUrl('/api/orders?reference=123', ' https://api.example/ '),
    'https://api.example/api/orders?reference=123',
  )
  for (const origin of [
    'https://api.example/api',
    'https://user:secret@api.example',
    'https://api.example?query=1',
    'ftp://api.example',
  ])
    assert.throws(() => apiUrl('/api/me', origin))
  assert.throws(() => apiUrl('//other.example', 'https://api.example'))
})
