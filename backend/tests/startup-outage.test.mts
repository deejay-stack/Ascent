import test from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'

for (const entry of ['src/index.ts', 'dist/index.js'])
  test(
    `${entry} stays available when the database is unreachable at startup`,
    { timeout: 20000 },
    async () => {
      const child = spawn(process.execPath, [entry], {
        cwd: new URL('..', import.meta.url),
        env: {
          ...process.env,
          ASCENT_DATA_MODE: 'supabase',
          PORT: '0',
          DATABASE_URL: 'postgresql://test:test@127.0.0.1:1/test',
          SUPABASE_URL: 'https://example.supabase.co',
          SUPABASE_SECRET_KEY: 'test-only',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
        windowsHide: true,
      })
      const exited = once(child, 'exit')
      child.stderr.resume()
      try {
        const port = await new Promise((resolve, reject) => {
          let output = ''
          child.once('error', reject)
          child.once('exit', () =>
            reject(new Error('API exited before listening')),
          )
          child.stdout.on('data', (chunk) => {
            output += chunk.toString()
            const match = output.match(/listening on port (\d+)/)
            if (match) resolve(Number(match[1]))
          })
        })
        const origin = 'http://127.0.0.1:' + port
        const response = await fetch(origin + '/api/health')
        assert.equal(response.status, 503)
        assert.match((await response.json()).message, /database connection/i)
        assert.equal((await fetch(origin + '/api/missing')).status, 404)
        assert.equal(child.exitCode, null)
      } finally {
        child.kill()
        await exited
      }
    },
  )
