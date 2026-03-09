// GET /api/databases — returns the list of user-accessible databases.
// Filters out MySQL system databases.

import { dbExecute } from '@/lib/db'

const SYSTEM_DATABASES = new Set([
  'information_schema',
  'performance_schema',
  'mysql',
  'sys',
  'tidb_catalog',
  'tidb_cdc',
  'metrics_schema',
])

export async function GET() {
  try {
    const result = await dbExecute('SHOW DATABASES')
    const databases = result.rows
      .map((r) => Object.values(r)[0] as string)
      .filter((name) => !SYSTEM_DATABASES.has(name.toLowerCase()))
      .sort()

    return Response.json({ databases })
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 })
  }
}
