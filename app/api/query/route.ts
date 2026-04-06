import { dbExecute, type DbResult } from '@/lib/db'
import { guardQuery, extractUseSchema, splitStatements } from '@/lib/query-guard'
import { checkRateLimit } from '@/lib/rate-limit'

const MAX_ROWS = 200

/**
 * Clean up MySQL / TiDB error messages into something readable.
 *
 * Raw errors from TiDB look like:
 *   "Error: You have an error in your SQL syntax: [parser:1149]You have an error
 *    in your SQL syntax; check the manual ... near 'xyz' at line 3"
 *
 * We extract:
 *  - The error code (e.g. 1149)
 *  - The "near '...'" snippet
 *  - The line number
 *  - A short summary
 */
function cleanError(raw: string, sqlForLineCount?: string): {
  message: string
  line: number | null
} {
  const err = String(raw)

  // Extract line number
  const lineMatch = err.match(/at line\s+(\d+)/i)
  let line = lineMatch ? parseInt(lineMatch[1]) : null

  // Clamp line number to actual user query length
  if (line != null && sqlForLineCount) {
    const maxLine = sqlForLineCount.split('\n').length
    if (line > maxLine) line = maxLine
  }

  // Extract the "near '...'" part — this is the most useful bit
  const nearMatch = err.match(/near\s+'([^']*)'/i)
  const near = nearMatch ? nearMatch[1] : null

  // Extract error code like [parser:1149] or (errno 1054)
  const codeMatch = err.match(/\[(?:parser|planner|executor):(\d+)\]/) ??
                    err.match(/errno\s+(\d+)/i) ??
                    err.match(/\((\d{4})\)/)
  const code = codeMatch ? codeMatch[1] : null

  // Try to extract a specific MySQL error type
  const unknownCol = err.match(/Unknown column '([^']+)'/i)
  const unknownTable = err.match(/Table '([^']+)' doesn't exist/i) ??
                       err.match(/Table '([^']+)' not found/i)
  const dupEntry = err.match(/Duplicate entry '([^']+)' for key '([^']+)'/i)
  const noDb = /No database selected/i.test(err)
  const accessDenied = /Access denied/i.test(err)
  const syntaxErr = /SQL syntax/i.test(err) || /parser/i.test(err)

  const unsupportedSql = /Unsupported SQL/i.test(err)

  // Build a clean message
  let message: string

  if (unsupportedSql) {
    message = 'This SQL statement is not supported by TiDB Serverless. Supported: SELECT, INSERT, UPDATE, DELETE, CREATE/ALTER/DROP TABLE, CREATE VIEW, and other standard SQL'
  } else if (unknownCol) {
    message = `Unknown column: ${unknownCol[1]}`
  } else if (unknownTable) {
    message = `Table not found: ${unknownTable[1]}`
  } else if (dupEntry) {
    message = `Duplicate entry '${dupEntry[1]}' for key '${dupEntry[2]}'`
  } else if (noDb) {
    message = 'No database selected — use the schema selector in the top bar'
  } else if (accessDenied) {
    message = 'Access denied — this operation is not permitted'
  } else if (syntaxErr && near) {
    message = near.length > 0
      ? `Syntax error near: ${near}`
      : 'Syntax error at end of query — check for missing keywords or unclosed quotes'
  } else if (syntaxErr) {
    message = 'SQL syntax error — check for typos, missing commas, or unclosed quotes'
  } else {
    // Fallback: strip "Error: " prefix and the redundant "check the manual" boilerplate
    message = err
      .replace(/^Error:\s*/i, '')
      .replace(/;?\s*check the manual that corresponds to your MySQL server version for the right syntax to use/i, '')
      .replace(/\[(?:parser|planner|executor):\d+\]/g, '')
      .trim()
    // Remove duplicate "You have an error" if present
    const dupIdx = message.toLowerCase().indexOf('you have an error', 10)
    if (dupIdx > 0) message = message.slice(0, dupIdx).trim()
  }

  // Append error code if we have one
  if (code) {
    message += ` (${code})`
  }

  return { message, line }
}

export async function POST(request: Request) {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    request.headers.get('x-real-ip') ??
    '127.0.0.1'

  const { allowed, retryAfter } = checkRateLimit(ip)
  if (!allowed) {
    return Response.json(
      { error: 'Rate limit exceeded. Try again shortly.' },
      { status: 429, headers: { 'Retry-After': String(retryAfter) } }
    )
  }

  let body: { sql?: unknown; schema?: unknown }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const raw = body.sql
  if (typeof raw !== 'string' || !raw.trim()) {
    return Response.json({ error: 'Missing or empty sql field' }, { status: 400 })
  }

  const schema = typeof body.schema === 'string' ? body.schema : undefined

  // If user types USE <db>, tell them to use the schema selector instead
  const useSchema = extractUseSchema(raw.trim())
  if (useSchema) {
    return Response.json({
      columns: ['message'],
      rows: [{ message: `To switch to "${useSchema}", use the schema selector in the top bar.` }],
      truncated: false,
      schemaChange: useSchema,
    })
  }

  // Split into individual statements for multi-statement support
  const statements = splitStatements(raw)

  // Single statement — fast path
  if (statements.length <= 1) {
    const guard = guardQuery(raw)
    if (!guard.safe) {
      return Response.json({ error: guard.error }, { status: 400 })
    }

    try {
      const result = await dbExecute(guard.sql, [], schema)
      return formatSingleResult(result)
    } catch (err) {
      const { message, line } = cleanError(String(err), guard.sql)
      return Response.json({ error: message, errorLine: line }, { status: 500 })
    }
  }

  // Multiple statements — validate all first, then execute sequentially
  const guarded: { sql: string; index: number; original: string }[] = []
  for (let i = 0; i < statements.length; i++) {
    const guard = guardQuery(statements[i])
    if (!guard.safe) {
      return Response.json(
        { error: `Statement ${i + 1}: ${guard.error}` },
        { status: 400 }
      )
    }
    guarded.push({ sql: guard.sql, index: i, original: statements[i] })
  }

  // Execute each statement; collect ALL result sets
  const resultSets: {
    label: string
    columns: string[]
    rows: Record<string, unknown>[]
    truncated: boolean
  }[] = []

  for (const { sql, index, original } of guarded) {
    try {
      const result = await dbExecute(sql, [], schema)
      if (result.columns.length > 0) {
        const rows = result.rows.slice(0, MAX_ROWS)
        resultSets.push({
          label: `Statement ${index + 1}`,
          columns: result.columns,
          rows,
          truncated: result.rows.length > MAX_ROWS,
        })
      } else {
        const affected = result.rowsAffected ?? 0
        resultSets.push({
          label: `Statement ${index + 1}`,
          columns: ['result'],
          rows: [{ result: `Query OK — ${affected} row(s) affected` }],
          truncated: false,
        })
      }
    } catch (err) {
      const { message, line } = cleanError(String(err), original)
      // Compute line offset for accurate line number in the full editor
      let lineOffset = 0
      const stmtStart = raw.indexOf(original)
      if (stmtStart >= 0) {
        lineOffset = raw.slice(0, stmtStart).split('\n').length - 1
      }
      const adjustedLine = line != null ? line + lineOffset : null
      return Response.json(
        {
          error: `Statement ${index + 1}: ${message}`,
          errorLine: adjustedLine,
        },
        { status: 500 }
      )
    }
  }

  // Return all result sets, plus the last result in columns/rows for compatibility
  const last = resultSets[resultSets.length - 1]
  return Response.json({
    columns: last.columns,
    rows: last.rows,
    truncated: last.truncated,
    resultSets,
  })
}

function formatSingleResult(result: DbResult) {
  if (result.columns.length === 0) {
    const affected = result.rowsAffected ?? 0
    return Response.json({
      columns: ['result'],
      rows: [{ result: `Query OK — ${affected} row(s) affected` }],
      truncated: false,
    })
  }

  const rows = result.rows.slice(0, MAX_ROWS)
  return Response.json({
    columns: result.columns,
    rows,
    truncated: result.rows.length > MAX_ROWS,
  })
}
