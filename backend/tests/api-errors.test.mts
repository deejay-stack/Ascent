import test from 'node:test'
import assert from 'node:assert/strict'
import multer from 'multer'
import { apiError } from '../src/api-errors.ts'

test('oversized and malformed requests return actionable client errors', () => {
  const upload = apiError(new multer.MulterError('LIMIT_FILE_SIZE'))
  assert.equal(upload.status, 413)
  assert.match(upload.message, /2 MB/)
  assert.equal(
    apiError(new multer.MulterError('LIMIT_UNEXPECTED_FILE')).status,
    400,
  )
  assert.equal(
    apiError({ type: 'entity.parse.failed', message: 'private payload' })
      .status,
    400,
  )
  assert.equal(apiError({ type: 'entity.too.large' }).status, 413)
})
test('database outages and conflicts retain useful status codes without exposing internals', () => {
  for (const code of ['ECONNRESET', 'P1001', 'P1017', 'P2024', 'P2028']) {
    const result = apiError({
      code,
      message: 'postgresql://private:password@database',
    })
    assert.equal(result.status, 503)
    assert.ok(!result.message.includes('password'))
  }
  assert.equal(apiError({ code: 'P2002' }).status, 409)
  assert.equal(apiError({ code: 'P2034' }).status, 409)
  assert.equal(apiError({ code: 'P2025' }).status, 404)
  assert.equal(apiError(new Error('secret')).message.includes('secret'), false)
})
