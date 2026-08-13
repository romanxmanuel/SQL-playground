// POST /api/upload — accepts a .sql file, parses it, and executes it against MySQL.
// Returns the target schema name so the UI can switch to it.
// Uses a single connection with FOREIGN_KEY_CHECKS=0 so table order doesn't matter.

import mysql from 'mysql2/promise'
import { getPool } from '@/lib/db'
import { parseDump } from '@/lib/sql-parser'

const MAX_FILE_SIZE = 4 * 1024 * 1024 // 4 MB
const SYSTEM_DATABASES = new Set(['information_schema', 'performance_schema', 'mysql', 'sys'])

export async function POST(request: Request) {
  try {
    let body: { sql?: unknown; filename?: unknown }
    try {
      body = await request.json()
    } catch {
      return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
    }

    const { sql, filename } = body
    if (typeof sql !== 'string' || !sql.trim()) {
      return Response.json({ error: 'sql is required' }, { status: 400 })
    }
    if (sql.length > MAX_FILE_SIZE) {
      return Response.json({ error: 'File too large (max 4 MB)' }, { status: 400 })
    }
    void filename

    const { targetSchema, statements, warnings } = parseDump(sql)

    if (!targetSchema) {
      return Response.json(
        { error: 'Could not determine target database. Make sure the file contains CREATE DATABASE or USE.' },
        { status: 400 }
      )
    }

    if (SYSTEM_DATABASES.has(targetSchema.toLowerCase())) {
      return Response.json({ error: `Cannot upload to system database "${targetSchema}"` }, { status: 400 })
    }

    if (statements.length === 0) {
      return Response.json({ error: 'No executable statements found in file' }, { status: 400 })
    }

    // Drop and recreate the target database
    const defaultPool = getPool()
    await defaultPool.execute(`DROP DATABASE IF EXISTS \`${targetSchema}\``)
    await defaultPool.execute(`CREATE DATABASE \`${targetSchema}\``)

    // Create a dedicated connection to the target database.
    // A single connection ensures SET FOREIGN_KEY_CHECKS=0 persists across all queries.
    const conn = await mysql.createConnection({
      host: process.env.MYSQL_HOST!,
      port: parseInt(process.env.MYSQL_PORT ?? '3306'),
      user: process.env.MYSQL_USER!,
      password: process.env.MYSQL_PASSWORD!,
      database: targetSchema,
      ssl: { rejectUnauthorized: true },
    })

    const errors: string[] = []
    let executed = 0

    try {
      await conn.query('SET FOREIGN_KEY_CHECKS = 0')

      for (const stmt of statements) {
        try {
          await conn.query(stmt)
          executed++
        } catch (err) {
          const msg = String(err)
          if (isIgnorableError(msg)) continue
          errors.push(msg.slice(0, 200))
          if (isCriticalError(stmt)) break
        }
      }

      try { await conn.query('SET FOREIGN_KEY_CHECKS = 1') } catch { /* best effort */ }
    } finally {
      await conn.end()
    }

    return Response.json({
      schema: targetSchema,
      executed,
      warnings: [...warnings, ...errors.slice(0, 5)],
    })
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 })
  }
}

function isIgnorableError(msg: string): boolean {
  const lower = msg.toLowerCase()
  return (
    lower.includes('unknown system variable') ||
    lower.includes('unknown variable') ||
    (lower.includes("doesn't exist") && lower.includes('variable')) ||
    lower.includes("can't be set to the value") ||
    (lower.includes('variable') && lower.includes('null')) ||
    lower.includes('unknown collation') ||
    lower.includes('access denied') ||
    lower.includes('super privilege') ||
    lower.includes('system_variables_admin') ||
    lower.includes('table already exists')
  )
}

function isCriticalError(stmt: string): boolean {
  const upper = stmt.trimStart().toUpperCase()
  return upper.startsWith('CREATE TABLE')
}
