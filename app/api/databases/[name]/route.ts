import { dbExecute } from '@/lib/db'

// System databases that can never be deleted
const PROTECTED = new Set(['information_schema', 'performance_schema', 'mysql', 'sys', 'tidb_catalog', 'playground'])

export async function DELETE(_req: Request, { params }: { params: { name: string } }) {
  const name = params.name
  if (!name || PROTECTED.has(name.toLowerCase())) {
    return Response.json({ error: `Cannot delete database "${name}"` }, { status: 400 })
  }
  try {
    await dbExecute(`DROP DATABASE IF EXISTS \`${name}\``)
    return Response.json({ ok: true })
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 })
  }
}
