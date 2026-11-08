import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'

for (const entry of [
  './src/app.ts',
  './src/index.ts',
  './dist/app.js',
  './dist/index.js',
])
  test(`Vercel imports ${entry} and serves preflight, auth and JSON 404s`, () => {
    const source = `
    import assert from 'node:assert/strict'
    import app from '${entry}'
    const server = app.listen(0, '127.0.0.1')
    await new Promise(resolve => server.once('listening', resolve))
    try {
      const origin = 'http://127.0.0.1:' + server.address().port
      const preflight = await fetch(origin + '/api/me', { method: 'OPTIONS', headers: {
        Origin: 'https://shop.example', 'Access-Control-Request-Headers': 'authorization'
      } })
      assert.equal(preflight.status, 204)
      assert.equal((await fetch(origin + '/api/me')).status, 401)
      const missing = await fetch(origin + '/owner/inventory')
      assert.equal(missing.status, 404)
      assert.match(missing.headers.get('content-type'), /application.json/)
      console.log('Native Express deployment smoke passed')
    } finally { await new Promise(resolve => server.close(resolve)) }
  `
    const result = spawnSync(
      process.execPath,
      ['--input-type=module', '-e', source],
      {
        cwd: new URL('..', import.meta.url),
        env: {
          ...process.env,
          VERCEL: '1',
          ASCENT_DATA_MODE: 'supabase',
          APP_URL: 'https://shop.example',
          DATABASE_URL: 'postgresql://test:test@127.0.0.1:1/test',
          SUPABASE_URL: 'https://example.supabase.co',
          SUPABASE_SECRET_KEY: 'test-only',
        },
        encoding: 'utf8',
        timeout: 15000,
        windowsHide: true,
      },
    )
    assert.equal(result.status, 0, result.stderr || result.error?.message)
    assert.match(result.stdout, /Native Express deployment smoke passed/)
  })
