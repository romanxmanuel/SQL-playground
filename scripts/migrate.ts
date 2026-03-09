// db:migrate — creates playground tables if they don't exist.
// Safe to run repeatedly (CREATE TABLE IF NOT EXISTS).
// Never drops or alters existing data.
//
// Required env vars: TIDB_HOST, TIDB_USER, TIDB_PASSWORD, TIDB_DB

import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
dotenv.config() // fallback to .env
import { CREATE_TABLES } from './_ddl'
import { getConn, dbExecute } from '../lib/db'

;(async () => {
  // Create the playground database if it doesn't exist
  // Connect to 'test' (always exists on TiDB Serverless) to bootstrap
  const db = process.env.TIDB_DB ?? 'playground'
  const conn = getConn('test')
  await conn.execute(`CREATE DATABASE IF NOT EXISTS \`${db}\``)

  // Now create tables inside it
  for (const sql of CREATE_TABLES) {
    await dbExecute(sql)
  }
  console.log('Migration complete. (TiDB MySQL)')
})()
