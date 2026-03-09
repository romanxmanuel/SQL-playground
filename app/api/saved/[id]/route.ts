import { dbExecute } from '@/lib/db'

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
    // Check it exists first
    const check = await dbExecute('SELECT id FROM saved_queries WHERE id = ?', [numId])
    if (check.rows.length === 0) {
      return Response.json({ error: 'Not found' }, { status: 404 })
    }

    await dbExecute('DELETE FROM saved_queries WHERE id = ?', [numId])
    return new Response(null, { status: 204 })
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 })
  }
}
