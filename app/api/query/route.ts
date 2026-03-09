import { dbExecute } from '@/lib/db'
import { guardQuery, extractUseSchema } from '@/lib/query-guard'
import { checkRateLimit } from '@/lib/rate-limit'

const MAX_ROWS = 200

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

  const guard = guardQuery(raw)
  if (!guard.safe) {
    return Response.json({ error: guard.error }, { status: 400 })
  }

  try {
    const result = await dbExecute(guard.sql, [], schema)

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
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 })
  }
}
