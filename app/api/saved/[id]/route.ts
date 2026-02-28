import { getDb } from '@/lib/db'

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const numId = Number(id)

  if (!Number.isInteger(numId) || numId <= 0) {
    return Response.json({ error: 'Invalid id' }, { status: 400 })
  }

  try {
    const db = await getDb()
    const result = await db.execute(
      'DELETE FROM saved_queries WHERE id = ? RETURNING id',
      [numId]
    )

    if (result.rows.length === 0) {
      return Response.json({ error: 'Not found' }, { status: 404 })
    }

    return new Response(null, { status: 204 })
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 })
  }
}
