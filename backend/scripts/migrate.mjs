import { readFile, readdir } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { resolve } from 'node:path'
import pg from 'pg'
import { backendDir } from '../src/env.mjs'
import { databaseConfig } from '../src/database-config.mjs'
import { sqlChecksum, migrationMatches } from '../src/migration-history.mjs'

// Deploy the reviewed SQL through the same verified connection as the API.
// Retain Prisma's migration ledger and checksums for Prisma CLI interoperability.
// Advisory locks must use the direct/session connection, not transaction pooling.
const client = new pg.Client(databaseConfig(process.env.DIRECT_URL || undefined))
try {
  await client.connect()
  await client.query('SELECT pg_advisory_lock(718459302)')
  await client.query(`CREATE TABLE IF NOT EXISTS public._prisma_migrations (
    id VARCHAR(36) PRIMARY KEY, checksum VARCHAR(64) NOT NULL,
    finished_at TIMESTAMPTZ, migration_name VARCHAR(255) NOT NULL, logs TEXT,
    rolled_back_at TIMESTAMPTZ, started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    applied_steps_count INTEGER NOT NULL DEFAULT 0
  )`)
  const path = resolve(backendDir, 'prisma/migrations')
  const directories = (await readdir(path, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
  const { rows: history } = await client.query(
    'SELECT migration_name, checksum, finished_at, rolled_back_at FROM public._prisma_migrations',
  )
  if (history.some((row) => !row.finished_at && !row.rolled_back_at))
    throw new Error('An unfinished migration needs review before continuing.')
  for (const name of directories) {
    const sql = await readFile(resolve(path, name, 'migration.sql'), 'utf8')
    const checksum = sqlChecksum(sql)
    const existing = history.find(
      (row) => row.migration_name === name && row.finished_at && !row.rolled_back_at,
    )
    if (existing) {
      if (!migrationMatches(sql, existing.checksum))
        throw new Error('Applied migration checksum changed: ' + name)
      console.log('Already applied:', name)
      continue
    }
    await client.query('BEGIN')
    try {
      await client.query(sql)
      await client.query(
        'INSERT INTO public._prisma_migrations (id,checksum,migration_name,finished_at,applied_steps_count) VALUES ($1,$2,$3,now(),1)',
        [randomUUID(), checksum, name],
      )
      await client.query('COMMIT')
      console.log('Applied:', name)
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    }
  }
  console.log('All migrations are applied.')
} catch (error) {
  console.error('Migration failed:', error.code || error.message)
  process.exitCode = 1
} finally {
  await client.end()
}
