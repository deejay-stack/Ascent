import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { rootCertificates } from 'node:tls'
import { backendDir, required } from './env.mjs'

export function databaseConfig(connectionString = required('DATABASE_URL')) {
  const url = new URL(connectionString)
  // pg connection-string SSL options otherwise replace the explicit verified TLS settings.
  for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'sslaccept'])
    url.searchParams.delete(key)
  const caPath = process.env.DATABASE_CA_CERT || resolve(backendDir, 'certs/supabase-ca.crt')
  return {
    connectionString: url.toString(),
    connectionTimeoutMillis: 20000,
    idleTimeoutMillis: 60000,
    max: 5,
    keepAlive: true,
    ssl: {
      rejectUnauthorized: true,
      ca: [...rootCertificates, readFileSync(resolve(backendDir, caPath), 'utf8')],
    },
  }
}
