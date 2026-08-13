// POST /api/restore — re-creates any missing tables and reloads all sample data.
// Only operates on the playground database. Saved queries are preserved.
// Uses a single connection so SET FOREIGN_KEY_CHECKS persists across all statements.

import { getPool } from '@/lib/db'

const CREATE_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS customers (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    name       VARCHAR(255) NOT NULL,
    email      VARCHAR(255) NOT NULL UNIQUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS products (
    id       INT AUTO_INCREMENT PRIMARY KEY,
    name     VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    price    DECIMAL(10,2) NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS orders (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    customer_id INT NOT NULL,
    status      VARCHAR(50) NOT NULL DEFAULT 'pending',
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_orders_customer FOREIGN KEY (customer_id) REFERENCES customers(id)
  )`,
  `CREATE TABLE IF NOT EXISTS order_items (
    id         INT AUTO_INCREMENT PRIMARY KEY,
    order_id   INT NOT NULL,
    product_id INT NOT NULL,
    quantity   INT NOT NULL,
    unit_price DECIMAL(10,2) NOT NULL,
    CONSTRAINT fk_items_order   FOREIGN KEY (order_id)   REFERENCES orders(id),
    CONSTRAINT fk_items_product FOREIGN KEY (product_id) REFERENCES products(id)
  )`,
]

export async function POST() {
  const pool = getPool()
  const conn = await pool.getConnection()
  try {
    await conn.query('SET FOREIGN_KEY_CHECKS = 0')

    for (const sql of CREATE_STATEMENTS) {
      await conn.query(sql)
    }

    await conn.query('DELETE FROM order_items')
    await conn.query('DELETE FROM orders')
    await conn.query('DELETE FROM products')
    await conn.query('DELETE FROM customers')

    await conn.query('ALTER TABLE customers   AUTO_INCREMENT = 1')
    await conn.query('ALTER TABLE products    AUTO_INCREMENT = 1')
    await conn.query('ALTER TABLE orders      AUTO_INCREMENT = 1')
    await conn.query('ALTER TABLE order_items AUTO_INCREMENT = 1')

    await conn.query(`INSERT INTO customers (id, name, email) VALUES
      (1, 'Alice Martin',  'alice@example.com'),
      (2, 'Bob Chen',      'bob@example.com'),
      (3, 'Carol Davis',   'carol@example.com'),
      (4, 'David Kim',     'david@example.com'),
      (5, 'Eve Johnson',   'eve@example.com')`)

    await conn.query(`INSERT INTO products (id, name, category, price) VALUES
      (1, 'Laptop Pro 15"',      'Electronics', 1299.99),
      (2, 'Wireless Headphones', 'Electronics',   89.99),
      (3, 'Standing Desk',       'Furniture',    549.00),
      (4, 'Ergonomic Chair',     'Furniture',    399.00),
      (5, 'USB-C Hub',           'Electronics',   49.99),
      (6, 'Notebook (5-pack)',   'Stationery',    12.99),
      (7, 'Mechanical Keyboard', 'Electronics',  149.99),
      (8, 'Monitor 27"',         'Electronics',  449.00)`)

    await conn.query(`INSERT INTO orders (id, customer_id, status) VALUES
      (1, 1, 'completed'),
      (2, 1, 'completed'),
      (3, 2, 'pending'),
      (4, 3, 'completed'),
      (5, 4, 'shipped'),
      (6, 5, 'pending'),
      (7, 2, 'completed'),
      (8, 3, 'cancelled')`)

    await conn.query(`INSERT INTO order_items (id, order_id, product_id, quantity, unit_price) VALUES
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
      (12, 8, 6, 5,   12.99)`)

    await conn.query('SET FOREIGN_KEY_CHECKS = 1')

    return Response.json({ restored: true })
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 })
  } finally {
    try { await conn.query('SET FOREIGN_KEY_CHECKS = 1') } catch { /* best effort */ }
    conn.release()
  }
}
