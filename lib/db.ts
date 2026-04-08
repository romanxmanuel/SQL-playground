// MySQL client via mysql2 connection pool.
// Works with Aiven MySQL, PlanetScale, or any standard MySQL server.
// Uses TCP with SSL — supports full MySQL including stored procedures.
//
// Required env vars:
//   MYSQL_HOST     — e.g. mysql-xxxx.aivencloud.com
//   MYSQL_PORT     — e.g. 25284
//   MYSQL_USER     — e.g. avnadmin
//   MYSQL_PASSWORD — your MySQL password
//   MYSQL_DATABASE — default database (e.g. defaultdb)

import mysql from 'mysql2/promise'

export interface DbResult {
  columns: string[]
  rows: Record<string, unknown>[]
  rowsAffected?: number
  insertId?: string
}

// Connection pool — reused across requests in the same serverless instance
let pool: mysql.Pool | null = null

/** Get a connection pool, optionally for a specific database. */
export function getPool(database?: string): mysql.Pool {
  const db = database ?? process.env.MYSQL_DATABASE ?? 'defaultdb'

  // If the requested database differs from the pool's default, create a fresh connection
  // For the common case (default db), reuse the pool
  if (!database || database === (process.env.MYSQL_DATABASE ?? 'defaultdb')) {
    if (!pool) {
      pool = mysql.createPool({
        host: process.env.MYSQL_HOST!,
        port: parseInt(process.env.MYSQL_PORT ?? '3306'),
        user: process.env.MYSQL_USER!,
        password: process.env.MYSQL_PASSWORD!,
        database: db,
        ssl: { rejectUnauthorized: true },
        waitForConnections: true,
        connectionLimit: 5,
        idleTimeout: 60000,
        enableKeepAlive: true,
      })
    }
    return pool
  }

  // Different database requested — create a one-off pool
  return mysql.createPool({
    host: process.env.MYSQL_HOST!,
    port: parseInt(process.env.MYSQL_PORT ?? '3306'),
    user: process.env.MYSQL_USER!,
    password: process.env.MYSQL_PASSWORD!,
    database: db,
    ssl: { rejectUnauthorized: true },
    waitForConnections: true,
    connectionLimit: 2,
    idleTimeout: 30000,
  })
}

export async function dbExecute(
  sql: string,
  params: unknown[] = [],
  database?: string
): Promise<DbResult> {
  const p = getPool(database)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [result] = await p.execute(sql, params as any)

  // SELECT / SHOW / DESCRIBE / EXPLAIN return RowDataPacket[]
  if (Array.isArray(result)) {
    const rows = result as Record<string, unknown>[]
    const columns = rows.length > 0 ? Object.keys(rows[0]) : []

    // Convert values to JSON-safe types
    const safeRows = rows.map(row => {
      const obj: Record<string, unknown> = {}
      for (const col of columns) {
        const val = row[col]
        obj[col] = typeof val === 'bigint'
          ? Number(val)
          : val instanceof Date
            ? val.toISOString()
            : Buffer.isBuffer(val)
              ? val.toString('utf8')
              : (val ?? null)
      }
      return obj
    })

    return { columns, rows: safeRows }
  }

  // INSERT / UPDATE / DELETE / DDL return ResultSetHeader
  const header = result as mysql.ResultSetHeader
  return {
    columns: [],
    rows: [],
    rowsAffected: header.affectedRows ?? 0,
    insertId: header.insertId != null ? String(header.insertId) : undefined,
  }
}
