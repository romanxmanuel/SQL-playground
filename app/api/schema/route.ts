import { getDb } from '@/lib/db'

export interface SchemaColumn {
  name: string
  type: string
  pk: boolean
  notNull: boolean
  dfltValue: string | null
}

export interface ForeignKey {
  from: string   // column in this table
  table: string  // referenced table
  to: string     // referenced column
}

export interface SchemaIndex {
  name: string
  unique: boolean
  columns: string[]
}

export interface SchemaTable {
  name: string
  rowCount: number
  columns: SchemaColumn[]
  foreignKeys: ForeignKey[]
  indexes: SchemaIndex[]
}

const TABLE_NAME_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/

export async function GET() {
  try {
    const db = await getDb()

    const tablesResult = await db.execute(
      `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`
    )

    const tables: SchemaTable[] = []

    for (const row of tablesResult.rows) {
      const tableName = row.name as string
      if (!TABLE_NAME_RE.test(tableName)) continue

      // Columns with PK / NOT NULL / default value
      const infoResult = await db.execute(`PRAGMA table_info(${tableName})`)
      const columns: SchemaColumn[] = infoResult.rows.map((col) => ({
        name: col.name as string,
        type: (col.type as string) || 'TEXT',
        pk: Number(col.pk) > 0,
        notNull: Number(col.notnull) === 1,
        dfltValue: col.dflt_value != null ? String(col.dflt_value) : null,
      }))

      // Foreign keys
      const fkResult = await db.execute(`PRAGMA foreign_key_list(${tableName})`)
      const foreignKeys: ForeignKey[] = fkResult.rows.map((fk) => ({
        from: fk.from as string,
        table: fk.table as string,
        to: fk.to as string,
      }))

      // Indexes — skip system-named ones (e.g. sqlite_autoindex_*)
      const idxListResult = await db.execute(`PRAGMA index_list(${tableName})`)
      const indexes: SchemaIndex[] = []
      for (const idx of idxListResult.rows) {
        const idxName = idx.name as string
        if (!TABLE_NAME_RE.test(idxName)) continue
        const idxInfoResult = await db.execute(`PRAGMA index_info(${idxName})`)
        indexes.push({
          name: idxName,
          unique: Number(idx.unique) === 1,
          columns: idxInfoResult.rows.map((r) => r.name as string),
        })
      }

      // Row count
      const countResult = await db.execute(`SELECT COUNT(*) as count FROM ${tableName}`)
      const rowCount = Number(countResult.rows[0]?.count ?? 0)

      tables.push({ name: tableName, rowCount, columns, foreignKeys, indexes })
    }

    return Response.json({ tables })
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 })
  }
}
