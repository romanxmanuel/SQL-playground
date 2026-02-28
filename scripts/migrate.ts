// db:migrate — creates tables if they don't exist. Safe to run repeatedly.
// Never drops or alters existing data.

import Database from 'better-sqlite3'
import { resolve } from 'path'
import { CREATE_TABLES } from './_ddl'

const dbPath = resolve(process.cwd(), 'playground.db')
const db = new Database(dbPath)
db.pragma('journal_mode = WAL')
db.exec(CREATE_TABLES)
db.close()

console.log('Migration complete.')
