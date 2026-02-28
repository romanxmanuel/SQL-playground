// POST /api/restore — re-creates any missing tables and reloads all sample data.
// Safe to call at any time. Existing saved_queries are preserved.
// Uses explicit IDs so FK references stay consistent across repeated restores.

import { getDb } from '@/lib/db'

const CREATE_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS customers (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT    NOT NULL,
    email      TEXT    NOT NULL UNIQUE,
    created_at TEXT    NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS products (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    name     TEXT    NOT NULL,
    category TEXT    NOT NULL,
    price    REAL    NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS orders (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL REFERENCES customers(id),
    status      TEXT    NOT NULL DEFAULT 'pending',
    created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS order_items (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id   INTEGER NOT NULL REFERENCES orders(id),
    product_id INTEGER NOT NULL REFERENCES products(id),
    quantity   INTEGER NOT NULL,
    unit_price REAL    NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS saved_queries (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    title      TEXT NOT NULL,
    sql        TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`,
]

// Explicit IDs ensure FK references stay valid regardless of how many times
// the table has been populated before (AUTOINCREMENT never reuses IDs without reset).
const RESTORE_STATEMENTS = [
  // Disable FK enforcement during the wipe so delete order doesn't matter
  `PRAGMA foreign_keys = OFF`,

  // Clear domain tables in dependency order (saved_queries untouched)
  `DELETE FROM order_items`,
  `DELETE FROM orders`,
  `DELETE FROM products`,
  `DELETE FROM customers`,

  // Reset autoincrement counters so explicit ids 1..N work cleanly
  `DELETE FROM sqlite_sequence WHERE name IN ('customers','products','orders','order_items')`,

  // Customers — explicit ids
  `INSERT INTO customers (id, name, email) VALUES (1, 'Alice Martin',  'alice@example.com')`,
  `INSERT INTO customers (id, name, email) VALUES (2, 'Bob Chen',      'bob@example.com')`,
  `INSERT INTO customers (id, name, email) VALUES (3, 'Carol Davis',   'carol@example.com')`,
  `INSERT INTO customers (id, name, email) VALUES (4, 'David Kim',     'david@example.com')`,
  `INSERT INTO customers (id, name, email) VALUES (5, 'Eve Johnson',   'eve@example.com')`,

  // Products — explicit ids
  `INSERT INTO products (id, name, category, price) VALUES (1, 'Laptop Pro 15"',      'Electronics', 1299.99)`,
  `INSERT INTO products (id, name, category, price) VALUES (2, 'Wireless Headphones', 'Electronics',   89.99)`,
  `INSERT INTO products (id, name, category, price) VALUES (3, 'Standing Desk',       'Furniture',    549.00)`,
  `INSERT INTO products (id, name, category, price) VALUES (4, 'Ergonomic Chair',     'Furniture',    399.00)`,
  `INSERT INTO products (id, name, category, price) VALUES (5, 'USB-C Hub',           'Electronics',   49.99)`,
  `INSERT INTO products (id, name, category, price) VALUES (6, 'Notebook (5-pack)',   'Stationery',    12.99)`,
  `INSERT INTO products (id, name, category, price) VALUES (7, 'Mechanical Keyboard', 'Electronics',  149.99)`,
  `INSERT INTO products (id, name, category, price) VALUES (8, 'Monitor 27"',         'Electronics',  449.00)`,

  // Orders — explicit ids, references customer ids 1–5
  `INSERT INTO orders (id, customer_id, status) VALUES (1, 1, 'completed')`,
  `INSERT INTO orders (id, customer_id, status) VALUES (2, 1, 'completed')`,
  `INSERT INTO orders (id, customer_id, status) VALUES (3, 2, 'pending')`,
  `INSERT INTO orders (id, customer_id, status) VALUES (4, 3, 'completed')`,
  `INSERT INTO orders (id, customer_id, status) VALUES (5, 4, 'shipped')`,
  `INSERT INTO orders (id, customer_id, status) VALUES (6, 5, 'pending')`,
  `INSERT INTO orders (id, customer_id, status) VALUES (7, 2, 'completed')`,
  `INSERT INTO orders (id, customer_id, status) VALUES (8, 3, 'cancelled')`,

  // Order items — explicit ids, references order ids 1–8 and product ids 1–8
  `INSERT INTO order_items (id, order_id, product_id, quantity, unit_price) VALUES  (1, 1, 1, 1, 1299.99)`,
  `INSERT INTO order_items (id, order_id, product_id, quantity, unit_price) VALUES  (2, 1, 5, 2,   49.99)`,
  `INSERT INTO order_items (id, order_id, product_id, quantity, unit_price) VALUES  (3, 2, 3, 1,  549.00)`,
  `INSERT INTO order_items (id, order_id, product_id, quantity, unit_price) VALUES  (4, 3, 2, 1,   89.99)`,
  `INSERT INTO order_items (id, order_id, product_id, quantity, unit_price) VALUES  (5, 3, 6, 3,   12.99)`,
  `INSERT INTO order_items (id, order_id, product_id, quantity, unit_price) VALUES  (6, 4, 7, 1,  149.99)`,
  `INSERT INTO order_items (id, order_id, product_id, quantity, unit_price) VALUES  (7, 4, 8, 1,  449.00)`,
  `INSERT INTO order_items (id, order_id, product_id, quantity, unit_price) VALUES  (8, 5, 2, 2,   89.99)`,
  `INSERT INTO order_items (id, order_id, product_id, quantity, unit_price) VALUES  (9, 6, 1, 1, 1299.99)`,
  `INSERT INTO order_items (id, order_id, product_id, quantity, unit_price) VALUES (10, 6, 5, 1,   49.99)`,
  `INSERT INTO order_items (id, order_id, product_id, quantity, unit_price) VALUES (11, 7, 4, 2,  399.00)`,
  `INSERT INTO order_items (id, order_id, product_id, quantity, unit_price) VALUES (12, 8, 6, 5,   12.99)`,

  // Re-enable FK enforcement
  `PRAGMA foreign_keys = ON`,
]

export async function POST() {
  try {
    const db = await getDb()

    for (const sql of CREATE_STATEMENTS) {
      await db.execute(sql)
    }
    for (const sql of RESTORE_STATEMENTS) {
      await db.execute(sql)
    }

    return Response.json({ restored: true })
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 })
  }
}
