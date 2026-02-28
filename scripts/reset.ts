// db:reset — DANGEROUS. Drops all tables and re-runs migration.
// Requires typing RESET to confirm.

import Database from 'better-sqlite3'
import { resolve } from 'path'
import * as readline from 'readline'
import { DROP_TABLES, CREATE_TABLES } from './_ddl'

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })

rl.question('⚠ This will DELETE all data. Type RESET to confirm: ', (answer) => {
  rl.close()

  if (answer.trim() !== 'RESET') {
    console.log('Aborted.')
    process.exit(0)
  }

  const dbPath = resolve(process.cwd(), 'playground.db')
  const db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.exec(DROP_TABLES)
  db.exec(CREATE_TABLES)
  db.close()

  console.log('Reset complete. Run npm run db:seed to re-populate.')
})
