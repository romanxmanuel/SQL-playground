// Dual-mode DB client.
// - TURSO_DATABASE_URL set  → Turso/libSQL (@libsql/client)
// - Not set                 → local SQLite file (better-sqlite3)
//
// getDb() is a lazy singleton. Call it in every API route.
// Never import better-sqlite3 directly from API routes.

export interface DbResult {
  columns: string[]
  rows: Record<string, unknown>[]
}

interface DbClient {
  execute(sql: string, args?: unknown[]): Promise<DbResult>
}

let _db: DbClient | null = null

export async function getDb(): Promise<DbClient> {
  if (_db) return _db
  _db = process.env.TURSO_DATABASE_URL ? await buildTurso() : await buildSqlite()
  return _db
}

async function buildTurso(): Promise<DbClient> {
  const { createClient } = await import('@libsql/client')
  const client = createClient({
    url: process.env.TURSO_DATABASE_URL!,
    authToken: process.env.TURSO_AUTH_TOKEN,
  })
  return {
    async execute(sql, args = []) {
      const statements = sql.split(';').map((s) => s.trim()).filter((s) => s.length > 0)

      if (statements.length === 1) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const result = await client.execute({ sql, args: args as any })
        const { columns } = result
        const rows = result.rows.map((row) =>
          Object.fromEntries(columns.map((col, i) => [col, row[i] ?? null]))
        )
        return { columns, rows }
      }

      // Multi-statement: run as a batch, return last result that has columns
      const results = await client.batch(
        statements.map((s) => ({ sql: s, args: [] as never[] }))
      )
      let last: DbResult = { columns: [], rows: [] }
      for (const result of results) {
        const { columns } = result
        if (columns.length > 0) {
          const rows = result.rows.map((row) =>
            Object.fromEntries(columns.map((col, i) => [col, row[i] ?? null]))
          )
          last = { columns, rows }
        }
      }
      return last
    },
  }
}

async function buildSqlite(): Promise<DbClient> {
  const { default: Database } = await import('better-sqlite3')
  const { resolve } = await import('path')
  const dbPath = resolve(process.cwd(), 'playground.db')
  const sqlite = new Database(dbPath)
  sqlite.pragma('journal_mode = WAL')
  return {
    async execute(sql, args = []) {
      // Split on ';' to support multi-statement scripts
      const statements = sql.split(';').map((s) => s.trim()).filter((s) => s.length > 0)
      let last: DbResult = { columns: [], rows: [] }
      for (const stmtSql of statements) {
        const stmt = sqlite.prepare(stmtSql)
        if (stmt.reader) {
          const rows = stmt.all(...(statements.length === 1 ? args : [])) as Record<string, unknown>[]
          const columns = stmt.columns().map((c) => c.name)
          last = { columns, rows }
        } else {
          stmt.run(...(statements.length === 1 ? args : []))
        }
      }
      return last
    },
  }
}
