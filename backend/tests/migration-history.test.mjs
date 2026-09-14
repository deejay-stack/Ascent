import test from 'node:test'
import assert from 'node:assert/strict'
import { sqlChecksum, migrationMatches } from '../src/migration-history.mjs'
test('migration checksums accept Windows/Linux line endings and reject changed SQL', () => {
  const sql = 'CREATE TABLE example (id TEXT);\nSELECT 1;\n'
  assert.equal(migrationMatches(sql.replaceAll('\n', '\r\n'), sqlChecksum(sql)), true)
  assert.equal(migrationMatches(sql, sqlChecksum(sql.replaceAll('\n', '\r\n'))), true)
  assert.equal(migrationMatches(sql.replace('SELECT 1', 'SELECT 2'), sqlChecksum(sql)), false)
})
