import { dbExecute } from '@/lib/db'

export async function GET() {
  try {
    await dbExecute('SELECT 1')
    return Response.json({
      status: 'ok',
      backend: 'tidb',
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    return Response.json(
      { status: 'error', message: String(err) },
      { status: 500 }
    )
  }
}
