// POST /api/upload — accepts a .sql file, parses it, and executes it against TiDB.
// Returns the target schema name so the UI can switch to it.

import { dbExecute } from '@/lib/db'
import { parseDump } from '@/lib/sql-parser'

const MAX_FILE_SIZE = 4 * 1024 * 1024 // 4 MB
const SYSTEM_DATABASES = new Set(['information_schema', 'performance_schema', 'mysql', 'sys', 'tidb_catalog'])

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
    void filename // accepted but not required

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

    // Create the target database
    await dbExecute(`CREATE DATABASE IF NOT EXISTS \`${targetSchema}\``)

    // Execute all statements against the target schema
    const errors: string[] = []
    let executed = 0

    for (const stmt of statements) {
      try {
        await dbExecute(stmt, [], targetSchema)
        executed++
      } catch (err) {
        const msg = String(err)
        // Skip ignorable errors (e.g. SET variable not supported)
        if (isIgnorableError(msg)) {
          continue
        }
        errors.push(msg.slice(0, 200))
        // Stop on critical errors (CREATE TABLE / INSERT failures)
        if (isCriticalError(stmt)) break
      }
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
    lower.includes("doesn't exist") && lower.includes('variable')
  )
}

function isCriticalError(stmt: string): boolean {
  const upper = stmt.trimStart().toUpperCase()
  return upper.startsWith('CREATE TABLE') || upper.startsWith('INSERT')
}
