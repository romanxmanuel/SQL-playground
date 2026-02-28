// db:migrate — creates tables if they don't exist. Safe to run repeatedly.
// Never drops or alters existing data.
//
// Dual-mode:
//   TURSO_DATABASE_URL set  → migrates against Turso/libSQL
//   Not set                 → migrates against local playground.db (SQLite)

import { CREATE_TABLES } from './_ddl'

// libSQL executes one statement at a time, so split the multi-statement DDL string.
// Splitting on ';' is safe here — no semicolons appear inside column definitions.
const statements = CREATE_TABLES
  .split(';')
  .map((s) => s.trim())
  .filter((s) => s.length > 0)

;(async () => {
  if (process.env.TURSO_DATABASE_URL) {
    const { createClient } = await import('@libsql/client')
    const client = createClient({
      url: process.env.TURSO_DATABASE_URL,
      authToken: process.env.TURSO_AUTH_TOKEN,
    })
    for (const sql of statements) {
      await client.execute(sql)
    }
    client.close()
    console.log('Migration complete. (turso)')
  } else {
    const { default: Database } = await import('better-sqlite3')
    const { resolve } = await import('path')
    const db = new Database(resolve(process.cwd(), 'playground.db'))
    db.pragma('journal_mode = WAL')
    db.exec(CREATE_TABLES)
    db.close()
    console.log('Migration complete. (sqlite)')
  }
})()
