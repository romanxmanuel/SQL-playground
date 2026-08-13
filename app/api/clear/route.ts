// POST /api/clear — drops all user tables in the playground database except saved_queries.
// Saved queries survive a clear so bookmarks are preserved.
// Uses a single connection with FK_CHECKS=0 so drop order doesn't matter.

import { getPool } from '@/lib/db'

const PROTECTED = new Set(['saved_queries'])
const DB = process.env.MYSQL_DATABASE ?? 'defaultdb'

export async function POST() {
  try {
    const pool = getPool()
    const conn = await pool.getConnection()

    try {
      const [rows] = await conn.query(
        `SELECT TABLE_NAME FROM information_schema.TABLES
         WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'
         ORDER BY TABLE_NAME`,
        [DB]
      )

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const allTables = (rows as any[]).map((r: any) => r.TABLE_NAME as string)
      const toDrop = allTables.filter((name) => !PROTECTED.has(name))

      if (toDrop.length === 0) {
        return Response.json({ dropped: [], message: 'Nothing to clear.' })
      }

      await conn.query('SET FOREIGN_KEY_CHECKS = 0')

      const dropped: string[] = []
      for (const name of toDrop) {
        await conn.query(`DROP TABLE IF EXISTS \`${name}\``)
        dropped.push(name)
      }

      await conn.query('SET FOREIGN_KEY_CHECKS = 1')

      return Response.json({ dropped, message: `${dropped.length} table(s) dropped.` })
    } finally {
      try { await conn.query('SET FOREIGN_KEY_CHECKS = 1') } catch { /* best effort */ }
      conn.release()
    }
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 })
  }
}
