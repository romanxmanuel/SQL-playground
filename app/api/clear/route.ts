// POST /api/clear — drops all user tables in the playground database except saved_queries.
// Saved queries survive a clear so bookmarks are preserved.

import { dbExecute } from '@/lib/db'

const PROTECTED = new Set(['saved_queries'])
const DB = process.env.TIDB_DB ?? 'playground'

export async function POST() {
  try {
    const result = await dbExecute(
      `SELECT TABLE_NAME FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'
       ORDER BY TABLE_NAME`,
      [DB]
    )

    const toDrop = result.rows
      .map((r) => r.TABLE_NAME as string)
      .filter((name) => !PROTECTED.has(name))

    if (toDrop.length === 0) {
      return Response.json({ dropped: [], message: 'Nothing to clear.' })
    }

    await dbExecute('SET FOREIGN_KEY_CHECKS = 0')
    for (const name of toDrop) {
      await dbExecute(`DROP TABLE IF EXISTS \`${name}\``)
    }
    await dbExecute('SET FOREIGN_KEY_CHECKS = 1')

    return Response.json({ dropped: toDrop, message: `${toDrop.length} table(s) dropped.` })
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 })
  }
}
