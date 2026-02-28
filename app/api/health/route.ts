import { getDb } from '@/lib/db'

export async function GET() {
  try {
    const db = await getDb()
    await db.execute('SELECT 1')
    return Response.json({
      status: 'ok',
      backend: process.env.TURSO_DATABASE_URL ? 'turso' : 'sqlite',
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    return Response.json(
      { status: 'error', message: String(err) },
      { status: 500 }
    )
  }
}
