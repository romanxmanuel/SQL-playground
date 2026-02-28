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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await client.execute({ sql, args: args as any })
      const { columns } = result
      const rows = result.rows.map((row) =>
        Object.fromEntries(columns.map((col, i) => [col, row[i] ?? null]))
      )
      return { columns, rows }
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
      const stmt = sqlite.prepare(sql)
      if (stmt.reader) {
        const rows = stmt.all(...args) as Record<string, unknown>[]
        const columns = stmt.columns().map((c) => c.name)
        return { columns, rows }
      }
      stmt.run(...args)
      return { columns: [], rows: [] }
    },
  }
}
