import { getDb } from '@/lib/db'
import { guardQuery } from '@/lib/query-guard'
import { checkRateLimit } from '@/lib/rate-limit'

const MAX_ROWS = 200

export async function POST(request: Request) {
  // Rate limiting
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

  // Parse body
  let body: { sql?: unknown }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const raw = body.sql
  if (typeof raw !== 'string' || !raw.trim()) {
    return Response.json({ error: 'Missing or empty sql field' }, { status: 400 })
  }

  // Validate SQL
  const guard = guardQuery(raw)
  if (!guard.safe) {
    return Response.json({ error: guard.error }, { status: 400 })
  }

  // Execute
  try {
    const db = await getDb()
    const result = await db.execute(guard.sql)
    const rows = result.rows.slice(0, MAX_ROWS)
    return Response.json({ columns: result.columns, rows, truncated: result.rows.length > MAX_ROWS })
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 })
  }
}
