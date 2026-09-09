import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { resolve } from 'node:path'

const root = resolve(fileURLToPath(new URL('..', import.meta.url)))
const node = process.execPath
const api = spawn(node, ['server/index.mjs'], { cwd: root, stdio: 'inherit' })
const vite = spawn(node, ['node_modules/vite/bin/vite.js'], { cwd: root, stdio: 'inherit' })
const stop = () => {
  api.kill()
  vite.kill()
}
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
api.on('exit', (code) => {
  if (code) process.exitCode = code
  vite.kill()
})
vite.on('exit', (code) => {
  if (code) process.exitCode = code
  api.kill()
})
