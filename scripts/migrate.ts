// db:migrate — creates playground tables if they don't exist.
// Safe to run repeatedly (CREATE TABLE IF NOT EXISTS).
// Never drops or alters existing data.
//
// Required env vars: MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE

import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
dotenv.config() // fallback to .env
import { CREATE_TABLES } from './_ddl'
import { getPool, dbExecute } from '../lib/db'

;(async () => {
  // Create the playground database if it doesn't exist
  // Connect to 'defaultdb' to bootstrap
  const db = process.env.MYSQL_DATABASE ?? 'defaultdb'
  const p = getPool()
  await p.execute(`CREATE DATABASE IF NOT EXISTS \`${db}\``)

  // Now create tables inside it
  for (const sql of CREATE_TABLES) {
    await dbExecute(sql)
  }
  console.log('Migration complete. (Aiven MySQL)')
})()
