import { createHash } from 'node:crypto'
export const sqlChecksum = (sql) => createHash('sha256').update(sql).digest('hex')
export function migrationMatches(sql, checksum) {
  const lf = sql.replaceAll('\r\n', '\n')
  return [sql, lf, lf.replaceAll('\n', '\r\n')].some((value) => sqlChecksum(value) === checksum)
}
