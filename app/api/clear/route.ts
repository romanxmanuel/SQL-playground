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

    const allTables = result.rows.map((r) => r.TABLE_NAME as string)
    const toDrop = allTables.filter((name) => !PROTECTED.has(name))

    if (toDrop.length === 0) {
      return Response.json({ dropped: [], message: 'Nothing to clear.' })
    }

    // Sort tables in FK-dependency order (children first) using a retry loop
    const remaining = [...toDrop]
    const dropped: string[] = []
    const maxAttempts = toDrop.length * toDrop.length + 1
    let attempts = 0

    while (remaining.length > 0 && attempts < maxAttempts) {
      attempts++
      const name = remaining.shift()!
      try {
        await dbExecute(`DROP TABLE IF EXISTS \`${name}\``)
        dropped.push(name)
      } catch (err) {
        const msg = String(err)
        if (msg.includes('3730') || msg.includes('foreign key constraint')) {
          // Has FK dependents — retry after other tables are dropped
          remaining.push(name)
        } else {
          return Response.json({ error: msg }, { status: 500 })
        }
      }
    }

    if (remaining.length > 0) {
      return Response.json({ error: `Could not drop: ${remaining.join(', ')}` }, { status: 500 })
    }

    return Response.json({ dropped, message: `${dropped.length} table(s) dropped.` })
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 })
  }
}
