# SQL Playground — CLAUDE.md

## Project Overview

A deployable MySQL SQL practice web app. Students upload professor's .sql dump files,
practice queries natively in MySQL, and save/share useful queries.
Built with Next.js for Vercel compatibility.

## Tech Stack

- **Framework**: Next.js (App Router)
- **Backend**: Next.js API routes
- **Database**: TiDB Cloud Serverless (MySQL 8.0 compatible, HTTP driver, free tier)
- **Driver**: `@tidbcloud/serverless` — no TCP, works on Vercel Edge/serverless
- **ORM**: None — raw SQL only
- **Deployment**: Vercel

## Environment Variables

```
TIDB_HOST=        # e.g. gateway01.us-east-1.prod.aws.tidbcloud.com
TIDB_USER=        # e.g. xxxxx.root
TIDB_PASSWORD=    # TiDB Cloud password
TIDB_DB=          # default database (e.g. playground)
NEXT_PUBLIC_TIDB_DB=  # same as TIDB_DB — exposed to client for default schema
```

## NPM Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start local dev server |
| `npm run db:migrate` | Create playground tables if missing (idempotent) |
| `npm run db:seed` | Insert sample data if customers table is empty |
| `npm run db:reset` | **Dangerous** — drops all playground tables and re-migrates; requires typing `RESET` |

## Data Persistence Rules (Critical)

- **Never wipe the database automatically** — not on startup, not on deploy, not ever.
- `db:migrate` uses `CREATE TABLE IF NOT EXISTS` only — never `DROP`, never `ALTER`.
- `db:seed` checks `SELECT COUNT(*) FROM customers` before inserting — skips if rows exist.
- `db:reset` must read from stdin and require the user to type `RESET` before proceeding.

## Multi-Schema Architecture

Each professor dump creates its own MySQL database. The UI has a schema selector dropdown.
- Active schema is stored in React state (client-side), sent with every API call
- `GET /api/databases` returns available databases (filters out system DBs)
- `POST /api/upload` accepts `{ sql, filename }` JSON, parses dump, creates target DB, executes statements
- `saved_queries` table lives in the `playground` database only — never schema-specific
- Schema-dependent components receive `schema` prop and re-mount when it changes (`schemaKey`)

## Core Features

### Dataset (seed data in `playground` DB)
- `customers` — id, name, email, created_at
- `products` — id, name, category, price
- `orders` — id, customer_id, status, created_at
- `order_items` — id, order_id, product_id, quantity, unit_price

### UI
- SQL editor with Run button, `Cmd/Ctrl+Enter` shortcut
- Results table — max 200 rows
- Schema browser — tables, columns, PK/FK badges, FK relationships (pink = `--accent-2`)
- ERD diagram — Mermaid-based, zoom/pan, FK lines colored pink via SVG post-processing
- Tables view — card grid, expandable detail, indexes, example SELECT
- Saved queries — 50,000 char limit, stored in playground DB
- Upload SQL — load professor's .sql dump, auto-switches to that schema
- Schema selector dropdown in navbar

### API Routes
- `POST /api/query` — executes SELECT/WITH, auto-adds LIMIT 200, returns `{ columns, rows, schemaChange? }`
- `GET /api/schema?schema=xxx` — tables with columns, PKs, FKs, indexes, row counts (information_schema)
- `GET /api/databases` — list of non-system databases
- `POST /api/upload` — accepts `{ sql, filename }` JSON, returns `{ schema, executed, warnings }`
- `GET /api/saved` — list saved queries (playground DB)
- `POST /api/saved` — save query (title max 200, sql max 50000)
- `DELETE /api/saved/[id]` — delete saved query
- `POST /api/restore` — restore playground sample data
- `POST /api/clear` — delete non-system tables from playground DB

## Security Rules (SQL Execution)

- Allow only `SELECT` and `WITH` statements.
- If no `LIMIT` clause, append `LIMIT 200` automatically.
- Hard cap: never return more than 200 rows.
- Block dangerous keywords: DROP, DELETE, INSERT, UPDATE, CREATE, ALTER, TRUNCATE, GRANT, REVOKE.

## Folder Structure

```
/
├── CLAUDE.md
├── README.md
├── next.config.js
├── package.json
├── .env.local                    # gitignored
├── lib/
│   ├── db.ts                     # TiDB client — getConn(database?), dbExecute(sql, params, db?)
│   ├── query-guard.ts            # MySQL-aware SQL validation
│   └── sql-parser.ts             # mysqldump parser — extracts schema name + statements
├── scripts/
│   ├── _ddl.ts                   # CREATE_TABLES / DROP_TABLES arrays (MySQL syntax)
│   ├── migrate.ts                # db:migrate
│   ├── seed.ts                   # db:seed
│   └── reset.ts                  # db:reset (requires "RESET" confirmation)
├── app/
│   ├── page.tsx                  # Main UI — schema state, schemaKey, upload handler
│   ├── globals.css               # Theme: deep navy/indigo + cyan accent + pink FK accent
│   └── api/
│       ├── query/route.ts        # POST /api/query
│       ├── schema/route.ts       # GET /api/schema?schema=xxx
│       ├── databases/route.ts    # GET /api/databases
│       ├── upload/route.ts       # POST /api/upload (JSON body)
│       ├── restore/route.ts      # POST /api/restore
│       ├── clear/route.ts        # POST /api/clear
│       └── saved/
│           ├── route.ts          # GET + POST /api/saved
│           └── [id]/route.ts     # DELETE /api/saved/[id]
└── components/
    ├── NavBar.tsx                 # Schema selector, upload button, view tabs
    ├── SqlEditor.tsx
    ├── ResultsTable.tsx
    ├── SchemaBrowser.tsx          # Accepts schema prop, shows PK/FK badges
    ├── TablesView.tsx             # Accepts schema prop, card grid
    ├── ErdView.tsx                # Accepts schema prop, zoom/pan, FK colors
    └── SavedQueries.tsx
```

## Coding Conventions

- Raw SQL everywhere — no query builders, no ORMs.
- `lib/db.ts` is the only place that imports `@tidbcloud/serverless`.
- `lib/query-guard.ts` must be pure and independently testable (no DB calls).
- Keep files under ~300 lines. Split if needed.
- No unnecessary abstractions — inline code beats a helper for a one-off.
- Prefer `async/await`. No callbacks.

## Vercel Compatibility

- `@tidbcloud/serverless` uses HTTP — works on Vercel Edge and serverless functions.
- No filesystem writes in API routes.
- Keep dependencies minimal.

## Claude Priorities (in order)

1. Simplicity
2. Vercel + TiDB compatibility
3. Data safety — never auto-wipe
4. Security — validate all SQL input
5. Readability
