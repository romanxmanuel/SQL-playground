import { dbExecute, type DbResult } from '@/lib/db'
import { guardQuery, extractUseSchema, splitStatements } from '@/lib/query-guard'
import { checkRateLimit } from '@/lib/rate-limit'

const MAX_ROWS = 200

/** Adjust MySQL "at line N" errors to match the user's actual query lines. */
function adjustErrorLine(errMsg: string, sql: string): string {
  const lineMatch = errMsg.match(/(at line\s+)(\d+)/i)
  if (lineMatch) {
    const reported = parseInt(lineMatch[2])
    const userLines = sql.split('\n').length
    if (reported > userLines) {
      return errMsg.replace(
        lineMatch[0],
        `${lineMatch[1]}${Math.min(reported, userLines)}`
      )
    }
  }
  return errMsg
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

  // Single statement — fast path (preserves original behaviour)
  if (statements.length <= 1) {
    const guard = guardQuery(raw)
    if (!guard.safe) {
      return Response.json({ error: guard.error }, { status: 400 })
    }

    try {
      const result = await dbExecute(guard.sql, [], schema)
      return formatSingleResult(result)
    } catch (err) {
      const errMsg = adjustErrorLine(String(err), guard.sql)
      return Response.json({ error: errMsg }, { status: 500 })
    }
  }

  // Multiple statements — validate all first, then execute sequentially
  const guarded: { sql: string; index: number }[] = []
  for (let i = 0; i < statements.length; i++) {
    const guard = guardQuery(statements[i])
    if (!guard.safe) {
      return Response.json(
        { error: `Statement ${i + 1}: ${guard.error}` },
        { status: 400 }
      )
    }
    guarded.push({ sql: guard.sql, index: i })
  }

  // Execute each statement; return the last result that produces rows,
  // or a summary of all DDL/DML outcomes.
  const messages: string[] = []
  let lastSelectResult: DbResult | null = null

  for (const { sql, index } of guarded) {
    try {
      const result = await dbExecute(sql, [], schema)
      if (result.columns.length > 0) {
        lastSelectResult = result
      } else {
        const affected = result.rowsAffected ?? 0
        messages.push(`Statement ${index + 1}: OK — ${affected} row(s) affected`)
      }
    } catch (err) {
      const errMsg = adjustErrorLine(String(err), sql)
      return Response.json(
        { error: `Statement ${index + 1}: ${errMsg}` },
        { status: 500 }
      )
    }
  }

  // If the last SELECT produced rows, show that result (with DDL/DML summaries above)
  if (lastSelectResult) {
    const rows = lastSelectResult.rows.slice(0, MAX_ROWS)
    // Prepend DDL/DML summaries as extra info rows if any
    if (messages.length > 0) {
      return Response.json({
        columns: lastSelectResult.columns,
        rows,
        truncated: lastSelectResult.rows.length > MAX_ROWS,
        messages,
      })
    }
    return Response.json({
      columns: lastSelectResult.columns,
      rows,
      truncated: lastSelectResult.rows.length > MAX_ROWS,
    })
  }

  // All statements were DDL/DML — show summary
  return Response.json({
    columns: ['result'],
    rows: messages.map(m => ({ result: m })),
    truncated: false,
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
