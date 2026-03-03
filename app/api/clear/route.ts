// POST /api/clear — drops all user tables except saved_queries.
// saved_queries is always preserved so bookmarked queries survive a clear.

import { getDb } from '@/lib/db'

const PROTECTED = new Set(['saved_queries'])

export async function POST() {
  try {
    const db = await getDb()

    // Find all user tables
    const result = await db.execute(
      `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`
    )

    const toDrop = result.rows
      .map((r) => r.name as string)
      .filter((name) => !PROTECTED.has(name))

    if (toDrop.length === 0) {
      return Response.json({ dropped: [], message: 'Nothing to clear.' })
    }

    // Disable FK enforcement so drop order doesn't matter
    await db.execute('PRAGMA foreign_keys = OFF')
    for (const name of toDrop) {
      await db.execute(`DROP TABLE IF EXISTS "${name}"`)
    }
    await db.execute('PRAGMA foreign_keys = ON')

    return Response.json({ dropped: toDrop, message: `${toDrop.length} table(s) dropped.` })
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 })
  }
}
