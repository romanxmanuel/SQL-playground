// db:reset — DANGEROUS. Drops all tables and re-runs migration.
// Requires typing RESET to confirm.
//
// Required env vars: MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE

import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
dotenv.config()
import * as readline from 'readline'
import { DROP_TABLES, CREATE_TABLES } from './_ddl'
import { dbExecute } from '../lib/db'

const rl = readline.createInterface({ input: process.stdin, output: process.stdout })

rl.question('⚠ This will DELETE all data. Type RESET to confirm: ', async (answer) => {
  rl.close()

  if (answer.trim() !== 'RESET') {
    console.log('Aborted.')
    process.exit(0)
  }

  await dbExecute('SET FOREIGN_KEY_CHECKS = 0')
  for (const sql of DROP_TABLES) {
    await dbExecute(sql)
  }
  await dbExecute('SET FOREIGN_KEY_CHECKS = 1')
  for (const sql of CREATE_TABLES) {
    await dbExecute(sql)
  }

  console.log('Reset complete. Run npm run db:seed to re-populate.')
})
