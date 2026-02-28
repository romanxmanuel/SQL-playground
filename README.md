# SQL Playground

A deployable SQL practice web app. Run queries against a real SQLite database, explore your schema, visualize relationships, and save queries — all from your browser or phone.

**Live demo:** deploy to Vercel in ~2 minutes (see below).

---

## Features

- **SQL editor** — write and run `SELECT` queries with `Cmd/Ctrl+Enter`
- **Schema browser** — collapsible tree of all tables and columns
- **Tables view** — searchable cards with column types, PK/FK badges, indexes, and row counts
- **ERD diagram** — auto-generated entity relationship diagram (Mermaid), with Copy source and Download SVG export
- **Saved queries** — persist titles + SQL across restarts
- **Mobile-first** — bottom tab navigation on iPhone/Android, touch-friendly controls
- **Safe by default** — only `SELECT` and `WITH` are allowed; results capped at 200 rows; rate-limited

---

## Tech stack

| Layer | Local dev | Production |
|---|---|---|
| Framework | Next.js 15 (App Router) | Next.js 15 (App Router) |
| Database | SQLite file (`playground.db`) | [Turso](https://turso.tech) (libSQL) |
| DB driver | `better-sqlite3` | `@libsql/client` |
| ORM | None — raw SQL only | None — raw SQL only |
| Hosting | `npm run dev` | Vercel |

The database driver is selected automatically: if `TURSO_DATABASE_URL` is set, Turso is used; otherwise a local SQLite file is created.

---

## Local setup

**Requirements:** Node.js 20+, npm

```bash
# 1. Clone
git clone https://github.com/romanxmanuel/SQL-playground.git
cd SQL-playground

# 2. Install dependencies
npm install

# 3. Create tables (idempotent — safe to run any time)
npm run db:migrate

# 4. Seed sample data (skips automatically if data already exists)
npm run db:seed

# 5. Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

No `.env.local` file is needed for local development — the SQLite file is created automatically.

---

## Seed dataset

The seed creates four tables with realistic sample data:

| Table | Rows | Description |
|---|---|---|
| `customers` | 5 | id, name, email, created_at |
| `products` | 8 | id, name, category, price |
| `orders` | 8 | id, customer_id (FK), status, created_at |
| `order_items` | 12 | id, order_id (FK), product_id (FK), quantity, unit_price |

Try this query to get started:

```sql
SELECT
  c.name          AS customer,
  COUNT(o.id)     AS total_orders,
  ROUND(SUM(oi.quantity * oi.unit_price), 2) AS total_spent
FROM customers c
JOIN orders o ON o.customer_id = c.id
JOIN order_items oi ON oi.order_id = o.id
WHERE o.status = 'completed'
GROUP BY c.id, c.name
ORDER BY total_spent DESC
```

---

## Database scripts

| Command | What it does |
|---|---|
| `npm run db:migrate` | Creates tables if they don't exist. Idempotent — never drops data. |
| `npm run db:seed` | Inserts sample data only if tables are empty. Safe to re-run. |
| `npm run db:reset` | **Dangerous.** Drops all tables and re-migrates. Requires typing `RESET` to confirm. |

**Persistence guarantee:** the database is never wiped automatically — not on startup, not on deploy, not ever. Migration only uses `CREATE TABLE IF NOT EXISTS`.

---

## Deploy to Vercel

### 1. Set up Turso

Turso is a hosted SQLite database that works in Vercel's serverless environment.

```bash
# Install Turso CLI
curl -sSfL https://get.tur.so/install.sh | bash

# Log in
turso auth login

# Create a database
turso db create sql-playground

# Get the connection URL
turso db show sql-playground --url
# → libsql://sql-playground-<username>.turso.io

# Create an auth token
turso db tokens create sql-playground
# → <token>
```

### 2. Deploy

```bash
# Install Vercel CLI (if needed)
npm i -g vercel

# Deploy
vercel
```

When prompted, set these environment variables (or add them in the Vercel dashboard under Settings → Environment Variables):

```
TURSO_DATABASE_URL=libsql://sql-playground-<username>.turso.io
TURSO_AUTH_TOKEN=<token>
```

### 3. Migrate and seed the Turso database

After deploying, run migrations against Turso by setting the env vars locally and running the scripts:

```bash
# Set locally for the duration of these commands
export TURSO_DATABASE_URL=libsql://sql-playground-<username>.turso.io
export TURSO_AUTH_TOKEN=<token>

# The scripts use better-sqlite3 locally — for Turso migration, use the Turso shell instead:
turso db shell sql-playground < <(npx tsx -e "
  import { CREATE_TABLES } from './scripts/_ddl';
  process.stdout.write(CREATE_TABLES);
")
```

Or use the Turso web shell at [app.turso.tech](https://app.turso.tech) to paste and run the `CREATE TABLE IF NOT EXISTS` statements from `scripts/_ddl.ts` directly.

---

## API reference

All endpoints return JSON. Errors include an `error` string field.

### `POST /api/query`

Run a SQL query.

**Request:**
```json
{ "sql": "SELECT * FROM customers" }
```

**Response:**
```json
{
  "columns": ["id", "name", "email", "created_at"],
  "rows": [{ "id": 1, "name": "Alice Martin", ... }],
  "truncated": false
}
```

**Rules:** Only `SELECT` and `WITH` are allowed. Results are capped at 200 rows. `LIMIT 200` is appended automatically if omitted. Rate-limited to 30 requests/minute per IP.

**Errors:** `400` for blocked/invalid SQL, `429` for rate limit, `500` for DB errors.

---

### `GET /api/schema`

Returns full schema metadata for all tables.

**Response:**
```json
{
  "tables": [
    {
      "name": "orders",
      "rowCount": 8,
      "columns": [
        { "name": "id", "type": "INTEGER", "pk": true, "notNull": true, "dfltValue": null },
        { "name": "customer_id", "type": "INTEGER", "pk": false, "notNull": true, "dfltValue": null }
      ],
      "foreignKeys": [
        { "from": "customer_id", "table": "customers", "to": "id" }
      ],
      "indexes": [
        { "name": "idx_orders_customer", "unique": false, "columns": ["customer_id"] }
      ]
    }
  ]
}
```

---

### `GET /api/saved`

List all saved queries, newest first.

**Response:**
```json
{
  "queries": [
    { "id": 1, "title": "Top customers", "sql": "SELECT ...", "created_at": "2026-02-28 17:49:02" }
  ]
}
```

---

### `POST /api/saved`

Save a query.

**Request:**
```json
{ "title": "Top customers", "sql": "SELECT * FROM customers" }
```

**Response:** `201` with the created query object.

---

### `DELETE /api/saved/:id`

Delete a saved query by ID.

**Response:** `204 No Content`, or `404` if not found.

---

### `GET /api/health`

Health check.

**Response:**
```json
{ "status": "ok", "backend": "sqlite", "timestamp": "2026-02-28T17:48:09.707Z" }
```

`backend` is `"sqlite"` locally or `"turso"` in production.

---

## Project structure

```
├── app/
│   ├── page.tsx                  # Root UI — view state, layout switching
│   ├── globals.css               # CSS variables, dark theme, responsive layout
│   ├── layout.tsx
│   └── api/
│       ├── query/route.ts        # POST /api/query
│       ├── schema/route.ts       # GET /api/schema
│       ├── saved/route.ts        # GET + POST /api/saved
│       ├── saved/[id]/route.ts   # DELETE /api/saved/:id
│       └── health/route.ts       # GET /api/health
├── components/
│   ├── NavBar.tsx                # Desktop top-nav + mobile bottom tabs
│   ├── SqlEditor.tsx             # Textarea with keyboard shortcut
│   ├── ResultsTable.tsx          # Query results with horizontal scroll
│   ├── SchemaBrowser.tsx         # Collapsible table/column tree
│   ├── TablesView.tsx            # Searchable table cards with detail
│   ├── ErdView.tsx               # Mermaid ERD diagram + export
│   └── SavedQueries.tsx          # Save, load, delete queries
├── lib/
│   ├── db.ts                     # Dual-mode DB client (SQLite / Turso)
│   ├── query-guard.ts            # SQL validation — pure function
│   └── rate-limit.ts             # Per-IP rate limiter
└── scripts/
    ├── _ddl.ts                   # Shared CREATE TABLE statements
    ├── migrate.ts                # db:migrate
    ├── seed.ts                   # db:seed
    └── reset.ts                  # db:reset
```

---

## Security

- Only `SELECT` and `WITH` statements are accepted
- Blocked keywords: `PRAGMA`, `ATTACH`, `DETACH`, `sqlite_master`, `sqlite_schema`
- Multiple statements (`;` separated) are rejected
- Results hard-capped at 200 rows
- Per-IP rate limiting: 30 requests per 60-second window

---

## License

MIT
