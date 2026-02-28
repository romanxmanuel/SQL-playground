// db:seed — inserts sample data only if the customers table is empty.
// Safe to run repeatedly; will skip if data already exists.

import Database from 'better-sqlite3'
import { resolve } from 'path'

const dbPath = resolve(process.cwd(), 'playground.db')
const db = new Database(dbPath)

const { count } = db.prepare('SELECT COUNT(*) as count FROM customers').get() as { count: number }

if (count > 0) {
  console.log(`Tables already have data (${count} customer rows). Skipping seed.`)
  db.close()
  process.exit(0)
}

const seed = db.transaction(() => {
  // customers
  const insertCustomer = db.prepare('INSERT INTO customers (name, email) VALUES (?, ?)')
  const customers: [string, string][] = [
    ['Alice Martin', 'alice@example.com'],
    ['Bob Chen', 'bob@example.com'],
    ['Carol Davis', 'carol@example.com'],
    ['David Kim', 'david@example.com'],
    ['Eve Johnson', 'eve@example.com'],
  ]
  for (const [name, email] of customers) insertCustomer.run(name, email)

  // products
  const insertProduct = db.prepare('INSERT INTO products (name, category, price) VALUES (?, ?, ?)')
  const products: [string, string, number][] = [
    ['Laptop Pro 15"', 'Electronics', 1299.99],
    ['Wireless Headphones', 'Electronics', 89.99],
    ['Standing Desk', 'Furniture', 549.0],
    ['Ergonomic Chair', 'Furniture', 399.0],
    ['USB-C Hub', 'Electronics', 49.99],
    ['Notebook (5-pack)', 'Stationery', 12.99],
    ['Mechanical Keyboard', 'Electronics', 149.99],
    ['Monitor 27"', 'Electronics', 449.0],
  ]
  for (const [name, category, price] of products) insertProduct.run(name, category, price)

  // orders
  const insertOrder = db.prepare('INSERT INTO orders (customer_id, status) VALUES (?, ?)')
  const orders: [number, string][] = [
    [1, 'completed'], [1, 'completed'],
    [2, 'pending'],
    [3, 'completed'],
    [4, 'shipped'],
    [5, 'pending'],
    [2, 'completed'],
    [3, 'cancelled'],
  ]
  for (const [cid, status] of orders) insertOrder.run(cid, status)

  // order_items
  const insertItem = db.prepare(
    'INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?)'
  )
  const items: [number, number, number, number][] = [
    [1, 1, 1, 1299.99], [1, 5, 2, 49.99],
    [2, 3, 1, 549.0],
    [3, 2, 1, 89.99], [3, 6, 3, 12.99],
    [4, 7, 1, 149.99], [4, 8, 1, 449.0],
    [5, 2, 2, 89.99],
    [6, 1, 1, 1299.99], [6, 5, 1, 49.99],
    [7, 4, 2, 399.0],
    [8, 6, 5, 12.99],
  ]
  for (const [oid, pid, qty, price] of items) insertItem.run(oid, pid, qty, price)
})

seed()
db.close()
console.log('Seed complete.')
