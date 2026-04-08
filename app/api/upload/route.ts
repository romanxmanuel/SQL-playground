// POST /api/upload — accepts a .sql file, parses it, and executes it against MySQL.
// Returns the target schema name so the UI can switch to it.
// Uses a two-pass approach: create tables first (FK constraints stripped), then
// add FK constraints as ALTER TABLE statements after all tables exist.

import { dbExecute } from '@/lib/db'
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

    // Drop and recreate the target database for a clean import
    await dbExecute(`DROP DATABASE IF EXISTS \`${targetSchema}\``)
    await dbExecute(`CREATE DATABASE IF NOT EXISTS \`${targetSchema}\``)

    // Two-pass approach: strip FK constraints from CREATE TABLE statements, then
    // add them back as ALTER TABLE after all tables exist. This avoids ordering issues:
    // Pass 1: execute everything, but strip FK constraints from CREATE TABLE statements
    // Pass 2: apply FK constraints as ALTER TABLE ADD CONSTRAINT after all tables exist
    const fkAlters: string[] = []
    const errors: string[] = []
    let executed = 0

    for (const stmt of statements) {
      const upper = stmt.trimStart().toUpperCase()

      if (upper.startsWith('CREATE TABLE')) {
        const { stripped, alters } = extractForeignKeys(stmt, targetSchema)
        fkAlters.push(...alters)
        try {
          await dbExecute(stripped, [], targetSchema)
          executed++
        } catch (err) {
          const msg = String(err)
          if (isIgnorableError(msg)) continue
          errors.push(msg.slice(0, 200))
          break // CREATE TABLE failure is critical
        }
      } else {
        try {
          await dbExecute(stmt, [], targetSchema)
          executed++
        } catch (err) {
          const msg = String(err)
          if (isIgnorableError(msg)) continue
          errors.push(msg.slice(0, 200))
          if (isCriticalError(stmt)) break
        }
      }
    }

    // Pass 2: apply FK constraints now that all tables exist
    const fkErrors: string[] = []
    for (const alter of fkAlters) {
      try {
        await dbExecute(alter, [], targetSchema)
      } catch (err) {
        const msg = String(err)
        if (!isIgnorableError(msg)) fkErrors.push(msg.slice(0, 150))
      }
    }

    return Response.json({
      schema: targetSchema,
      executed,
      warnings: [...warnings, ...errors.slice(0, 5), ...fkErrors.slice(0, 5)],
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
    lower.includes('unknown collation')
  )
}

function isCriticalError(stmt: string): boolean {
  const upper = stmt.trimStart().toUpperCase()
  return upper.startsWith('INSERT')
}

/**
 * Extracts CONSTRAINT ... FOREIGN KEY lines from a CREATE TABLE statement.
 * Returns the stripped CREATE TABLE and a list of ALTER TABLE ADD CONSTRAINT statements.
 */
function extractForeignKeys(
  stmt: string,
  schema: string
): { stripped: string; alters: string[] } {
  // Extract table name
  const tableMatch = stmt.match(/CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?`?(\w+)`?/i)
  const tableName = tableMatch?.[1] ?? ''

  // Match constraint lines:  CONSTRAINT `name` FOREIGN KEY (`col`) REFERENCES `table` (`col`)
  const fkPattern = /^\s*CONSTRAINT\s+`?(\w+)`?\s+FOREIGN\s+KEY\s+(\([^)]+\))\s+REFERENCES\s+`?(\w+)`?\s+(\([^)]+\)).*,?\s*$/gim

  const alters: string[] = []
  const stripped = stmt.replace(fkPattern, (_match, name, fromCols, refTable, refCols) => {
    if (tableName) {
      alters.push(
        `ALTER TABLE \`${schema}\`.\`${tableName}\` ADD CONSTRAINT \`${name}\` FOREIGN KEY ${fromCols} REFERENCES \`${refTable}\` ${refCols}`
      )
    }
    return '' // remove this line
  })

  // Fix trailing comma on last column def before closing paren
  const fixed = stripped.replace(/,(\s*\n\s*\))/g, '$1')

  return { stripped: fixed, alters }
}
