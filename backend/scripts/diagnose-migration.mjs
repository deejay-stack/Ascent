import { backendDir, projectDir } from '../src/env.mjs'
import { spawn } from 'node:child_process'
import { resolve } from 'node:path'
const child = spawn(
  process.execPath,
  [resolve(projectDir, 'node_modules/prisma/build/index.js'), 'migrate', 'status'],
  {
    cwd: backendDir,
    env: { ...process.env, RUST_LOG: 'info', DEBUG: 'prisma:schemaEngine*' },
    windowsHide: true,
  },
)
const sanitize = (value) => {
  let text = value.toString()
  for (const [key, secret] of Object.entries(process.env))
    if (/(PASSWORD|SECRET|KEY|DATABASE_URL|DIRECT_URL)/.test(key) && secret)
      text = text.replaceAll(secret, '[REDACTED]')
  return text.replace(/postgres(?:ql)?:\/\/[^\s"']+/g, '[REDACTED_DATABASE_URL]')
}
child.stdout.on('data', (value) => process.stdout.write(sanitize(value)))
child.stderr.on('data', (value) => process.stderr.write(sanitize(value)))
child.on('exit', (code) => {
  process.exitCode = code
})
