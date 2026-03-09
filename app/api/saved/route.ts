// Saved queries are always stored in the playground database regardless of active schema.
import { dbExecute } from '@/lib/db'

export async function GET() {
  try {
    const result = await dbExecute(
      'SELECT id, title, `sql`, created_at FROM saved_queries ORDER BY created_at DESC'
    )
    return Response.json({ queries: result.rows })
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 })
  }
}

export async function POST(request: Request) {
  let body: { title?: unknown; sql?: unknown }
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { title, sql } = body
  if (typeof title !== 'string' || !title.trim()) {
    return Response.json({ error: 'title is required' }, { status: 400 })
  }
  if (typeof sql !== 'string' || !sql.trim()) {
    return Response.json({ error: 'sql is required' }, { status: 400 })
  }
  if (title.length > 200) {
    return Response.json({ error: 'title too long (max 200 chars)' }, { status: 400 })
  }
  if (sql.length > 50000) {
    return Response.json({ error: 'sql too long (max 50000 chars)' }, { status: 400 })
  }

  try {
    await dbExecute(
      'INSERT INTO saved_queries (title, `sql`) VALUES (?, ?)',
      [title.trim(), sql.trim()]
    )
    const result = await dbExecute(
      'SELECT * FROM saved_queries WHERE id = LAST_INSERT_ID()'
    )
    return Response.json(result.rows[0], { status: 201 })
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 })
  }
}
