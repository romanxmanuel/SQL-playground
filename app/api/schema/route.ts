import { dbExecute } from '@/lib/db'

export interface SchemaColumn {
  name: string
  type: string
  pk: boolean
  notNull: boolean
  dfltValue: string | null
  extra: string
}

export interface ForeignKey {
  from: string    // column in this table
  table: string   // referenced table
  to: string      // referenced column
}

export interface SchemaTable {
  name: string
  rowCount: number
  columns: SchemaColumn[]
  foreignKeys: ForeignKey[]
  indexes: { name: string; unique: boolean; columns: string[] }[]
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url)
    const schema = url.searchParams.get('schema') ?? process.env.TIDB_DB ?? 'playground'

    // Tables in this schema
    const tablesResult = await dbExecute(
      `SELECT TABLE_NAME, TABLE_ROWS
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'
       ORDER BY TABLE_NAME`,
      [schema]
    )

    const tables: SchemaTable[] = []

    for (const row of tablesResult.rows) {
      const tableName = row.TABLE_NAME as string

      // Columns
      const colResult = await dbExecute(
        `SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_KEY,
                COLUMN_DEFAULT, EXTRA
         FROM information_schema.COLUMNS
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
         ORDER BY ORDINAL_POSITION`,
        [schema, tableName]
      )

      const columns: SchemaColumn[] = colResult.rows.map((col) => ({
        name: col.COLUMN_NAME as string,
        type: col.COLUMN_TYPE as string,
        pk: col.COLUMN_KEY === 'PRI',
        notNull: col.IS_NULLABLE === 'NO',
        dfltValue: col.COLUMN_DEFAULT != null ? String(col.COLUMN_DEFAULT) : null,
        extra: (col.EXTRA as string) || '',
      }))

      // Foreign keys
      const fkResult = await dbExecute(
        `SELECT COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
         FROM information_schema.KEY_COLUMN_USAGE
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
           AND REFERENCED_TABLE_NAME IS NOT NULL
         ORDER BY COLUMN_NAME`,
        [schema, tableName]
      )

      const foreignKeys: ForeignKey[] = fkResult.rows.map((fk) => ({
        from: fk.COLUMN_NAME as string,
        table: fk.REFERENCED_TABLE_NAME as string,
        to: fk.REFERENCED_COLUMN_NAME as string,
      }))

      // Indexes
      const idxResult = await dbExecute(
        `SELECT INDEX_NAME, NON_UNIQUE, GROUP_CONCAT(COLUMN_NAME ORDER BY SEQ_IN_INDEX) AS cols
         FROM information_schema.STATISTICS
         WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
         GROUP BY INDEX_NAME, NON_UNIQUE
         ORDER BY INDEX_NAME`,
        [schema, tableName]
      )

      const indexes = idxResult.rows
        .filter((idx) => idx.INDEX_NAME !== 'PRIMARY')
        .map((idx) => ({
          name: idx.INDEX_NAME as string,
          unique: Number(idx.NON_UNIQUE) === 0,
          columns: String(idx.cols).split(','),
        }))

      // Row count (accurate for smaller tables)
      const countResult = await dbExecute(
        `SELECT COUNT(*) AS cnt FROM \`${schema}\`.\`${tableName}\``
      )
      const rowCount = Number(countResult.rows[0]?.cnt ?? 0)

      tables.push({ name: tableName, rowCount, columns, foreignKeys, indexes })
    }

    return Response.json({ tables, schema })
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 })
  }
}
