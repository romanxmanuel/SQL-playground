// db:seed — inserts sample data only if customers table is empty.
// Safe to run repeatedly; skips if data already exists.
//
// Required env vars: MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE

import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
dotenv.config()
import { dbExecute } from '../lib/db'

;(async () => {
  const check = await dbExecute('SELECT COUNT(*) AS cnt FROM customers')
  const cnt = Number(check.rows[0]?.cnt ?? 0)
  if (cnt > 0) {
    console.log(`Customers table already has data (${cnt} rows). Skipping seed.`)
    return
  }

  const stmts = [
    `INSERT INTO customers (id, name, email) VALUES
      (1, 'Alice Martin',  'alice@example.com'),
      (2, 'Bob Chen',      'bob@example.com'),
      (3, 'Carol Davis',   'carol@example.com'),
      (4, 'David Kim',     'david@example.com'),
      (5, 'Eve Johnson',   'eve@example.com')`,

    `INSERT INTO products (id, name, category, price) VALUES
      (1, 'Laptop Pro 15"',      'Electronics', 1299.99),
      (2, 'Wireless Headphones', 'Electronics',   89.99),
      (3, 'Standing Desk',       'Furniture',    549.00),
      (4, 'Ergonomic Chair',     'Furniture',    399.00),
      (5, 'USB-C Hub',           'Electronics',   49.99),
      (6, 'Notebook (5-pack)',   'Stationery',    12.99),
      (7, 'Mechanical Keyboard', 'Electronics',  149.99),
      (8, 'Monitor 27"',         'Electronics',  449.00)`,

    `INSERT INTO orders (id, customer_id, status) VALUES
      (1, 1, 'completed'),
      (2, 1, 'completed'),
      (3, 2, 'pending'),
      (4, 3, 'completed'),
      (5, 4, 'shipped'),
      (6, 5, 'pending'),
      (7, 2, 'completed'),
      (8, 3, 'cancelled')`,

    `INSERT INTO order_items (id, order_id, product_id, quantity, unit_price) VALUES
      ( 1, 1, 1, 1, 1299.99),
      ( 2, 1, 5, 2,   49.99),
      ( 3, 2, 3, 1,  549.00),
      ( 4, 3, 2, 1,   89.99),
      ( 5, 3, 6, 3,   12.99),
      ( 6, 4, 7, 1,  149.99),
      ( 7, 4, 8, 1,  449.00),
      ( 8, 5, 2, 2,   89.99),
      ( 9, 6, 1, 1, 1299.99),
      (10, 6, 5, 1,   49.99),
      (11, 7, 4, 2,  399.00),
      (12, 8, 6, 5,   12.99)`,
  ]

  for (const sql of stmts) {
    await dbExecute(sql)
  }

  console.log('Seed complete. (Aiven MySQL)')
})()
