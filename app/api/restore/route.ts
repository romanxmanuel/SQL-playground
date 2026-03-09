// POST /api/restore — re-creates any missing tables and reloads all sample data.
// Only operates on the playground database. Saved queries are preserved.

import { dbExecute } from '@/lib/db'

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
  try {
    for (const sql of CREATE_STATEMENTS) {
      await dbExecute(sql)
    }

    // Wipe and reload domain tables. Disable FK checks so order doesn't matter.
    await dbExecute('SET FOREIGN_KEY_CHECKS = 0')
    await dbExecute('DELETE FROM order_items')
    await dbExecute('DELETE FROM orders')
    await dbExecute('DELETE FROM products')
    await dbExecute('DELETE FROM customers')

    // Reset auto-increment counters so explicit ids 1..N work cleanly
    await dbExecute('ALTER TABLE customers   AUTO_INCREMENT = 1')
    await dbExecute('ALTER TABLE products    AUTO_INCREMENT = 1')
    await dbExecute('ALTER TABLE orders      AUTO_INCREMENT = 1')
    await dbExecute('ALTER TABLE order_items AUTO_INCREMENT = 1')

    await dbExecute(`INSERT INTO customers (id, name, email) VALUES
      (1, 'Alice Martin',  'alice@example.com'),
      (2, 'Bob Chen',      'bob@example.com'),
      (3, 'Carol Davis',   'carol@example.com'),
      (4, 'David Kim',     'david@example.com'),
      (5, 'Eve Johnson',   'eve@example.com')`)

    await dbExecute(`INSERT INTO products (id, name, category, price) VALUES
      (1, 'Laptop Pro 15"',      'Electronics', 1299.99),
      (2, 'Wireless Headphones', 'Electronics',   89.99),
      (3, 'Standing Desk',       'Furniture',    549.00),
      (4, 'Ergonomic Chair',     'Furniture',    399.00),
      (5, 'USB-C Hub',           'Electronics',   49.99),
      (6, 'Notebook (5-pack)',   'Stationery',    12.99),
      (7, 'Mechanical Keyboard', 'Electronics',  149.99),
      (8, 'Monitor 27"',         'Electronics',  449.00)`)

    await dbExecute(`INSERT INTO orders (id, customer_id, status) VALUES
      (1, 1, 'completed'),
      (2, 1, 'completed'),
      (3, 2, 'pending'),
      (4, 3, 'completed'),
      (5, 4, 'shipped'),
      (6, 5, 'pending'),
      (7, 2, 'completed'),
      (8, 3, 'cancelled')`)

    await dbExecute(`INSERT INTO order_items (id, order_id, product_id, quantity, unit_price) VALUES
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

    await dbExecute('SET FOREIGN_KEY_CHECKS = 1')

    return Response.json({ restored: true })
  } catch (err) {
    return Response.json({ error: String(err) }, { status: 500 })
  }
}
