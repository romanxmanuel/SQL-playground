// MySQL client via TiDB Cloud Serverless (@tidbcloud/serverless).
// Uses HTTP under the hood — no TCP connections, no connection pooling needed.
// Works on Vercel serverless functions and Edge runtime.
//
// Required env vars:
//   TIDB_HOST     — e.g. gateway01.us-east-1.prod.aws.tidbcloud.com
//   TIDB_USER     — e.g. xxxxx.root
//   TIDB_PASSWORD — your TiDB password
//   TIDB_DB       — default database (e.g. playground)

import { connect } from '@tidbcloud/serverless'

export interface DbResult {
  columns: string[]
  rows: Record<string, unknown>[]
  rowsAffected?: number
  insertId?: string
}

export function getConn(database?: string) {
  return connect({
    host: process.env.TIDB_HOST!,
    username: process.env.TIDB_USER!,
    password: process.env.TIDB_PASSWORD!,
    database: database ?? process.env.TIDB_DB ?? 'playground',
  })
}

export async function dbExecute(
  sql: string,
  params: unknown[] = [],
  database?: string
): Promise<DbResult> {
  const conn = getConn(database)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const result = await conn.execute(sql, params as any, { fullResult: true }) as any
  // @tidbcloud/serverless returns { types, rows, rowsAffected, lastInsertId }
  const columns = Object.keys(result.types ?? {})
  const rows = (result.rows ?? []).map((row: Record<string, unknown>) => {
    const obj: Record<string, unknown> = {}
    for (const col of columns) {
      const val = row[col]
      // Convert BigInt / Date to JSON-serialisable values
      obj[col] = typeof val === 'bigint'
        ? Number(val)
        : val instanceof Date
          ? val.toISOString()
          : (val ?? null)
    }
    return obj
  })
  return {
    columns,
    rows,
    rowsAffected: result.rowsAffected ?? undefined,
    insertId: result.lastInsertId != null ? String(result.lastInsertId) : undefined,
  }
}
