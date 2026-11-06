import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { rootCertificates } from 'node:tls'
import { backendDir, required } from './env.mjs'

export function databaseConfig(connectionString = required('DATABASE_URL')) {
  const url = new URL(connectionString)
  // pg connection-string SSL options otherwise replace the explicit verified TLS settings.
  for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'sslaccept'])
    url.searchParams.delete(key)
  const ca = process.env.DATABASE_CA_CERT
    ? readFileSync(resolve(backendDir, process.env.DATABASE_CA_CERT), 'utf8')
    : readFileSync(new URL('../certs/supabase-ca.crt', import.meta.url), 'utf8')
  return {
    connectionString: url.toString(),
    connectionTimeoutMillis: 20000,
    idleTimeoutMillis: process.env.VERCEL ? 5000 : 60000,
    max: 5,
    keepAlive: true,
    ssl: {
      rejectUnauthorized: true,
      ca: [...rootCertificates, ca],
    },
  }
}
