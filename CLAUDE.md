# SQL Playground — CLAUDE.md

## Project Overview

A deployable SQL practice web app accessible from mobile and shareable publicly.
Built with Next.js for Vercel compatibility.

## Tech Stack

- **Framework**: Next.js (App Router)
- **Backend**: Next.js API routes
- **Database (local dev)**: SQLite file on disk via `better-sqlite3`
- **Database (production)**: Turso/libSQL via `@libsql/client`
- **ORM**: None — raw SQL only
- **Deployment**: Vercel

## Environment Variables

```
TURSO_DATABASE_URL=   # libsql://... (production only)
TURSO_AUTH_TOKEN=     # (production only)
```

Local dev uses a SQLite file automatically when `TURSO_DATABASE_URL` is not set.

## NPM Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start local dev server |
| `npm run db:migrate` | Create tables if missing; idempotent; never drops or modifies existing data |
| `npm run db:seed` | Insert seed data only if tables are empty; safe to run repeatedly |
| `npm run db:reset` | **Dangerous** — drops all tables and re-migrates; requires typing `RESET` to confirm |

## Data Persistence Rules (Critical)

- **Never wipe the database automatically** — not on startup, not on deploy, not ever.
- On dev server start: do not run any migration or seed logic automatically.
- `db:migrate` uses `CREATE TABLE IF NOT EXISTS` only — never `DROP`, never `ALTER`.
- `db:seed` checks `SELECT COUNT(*) FROM table` before inserting — skips if rows exist.
- `db:reset` must read from stdin and require the user to type `RESET` before proceeding.

## Core Features

### Dataset (seed data)
Four tables seeded with realistic sample data:
- `customers` — id, name, email, created_at
- `products` — id, name, category, price
- `orders` — id, customer_id, status, created_at
- `order_items` — id, order_id, product_id, quantity, unit_price

### UI
- SQL editor (textarea or code editor) with a Run button
- Keyboard shortcut: `Cmd+Enter` / `Ctrl+Enter` to run query
- Results table — max 200 rows displayed
- Schema browser — lists all tables and their columns
- Saved queries — title + SQL, stored in DB, persisted across restarts

### API Routes
- `POST /api/query` — execute a validated SQL query, returns rows
- `GET /api/schema` — return tables with columns, PKs, FKs, indexes, row counts
- `GET /api/saved` — list saved queries
- `POST /api/saved` — save a new query
- `DELETE /api/saved/[id]` — delete a saved query
- `GET /api/health` — health check, returns DB backend name

## Security Rules (SQL Execution)

- Allow only `SELECT` and `WITH` statements (check first non-whitespace token).
- Block: `PRAGMA`, `ATTACH`, `DETACH`, `sqlite_master`, multiple statements (reject if more than one `;`-terminated statement is detected).
- If the query has no `LIMIT` clause, append `LIMIT 200` automatically.
- Hard cap: never return more than 200 rows regardless of query.
- Rate limit `POST /api/query`: simple per-IP counter, in-memory for local, Vercel-compatible middleware for prod.

## Folder Structure

```
/
├── CLAUDE.md
├── README.md
├── next.config.js
├── package.json
├── .env.local                   # gitignored
├── lib/
│   ├── db.ts                    # Single DB client — SQLite locally, Turso in prod
│   └── query-guard.ts           # SQL validation and sanitization logic
├── scripts/
│   ├── migrate.ts               # db:migrate
│   ├── seed.ts                  # db:seed
│   └── reset.ts                 # db:reset (requires "RESET" confirmation)
├── app/
│   ├── page.tsx                 # Main UI (editor + results + schema browser)
│   └── api/
│       ├── query/route.ts       # POST /api/query
│       ├── schema/route.ts      # GET /api/schema
│       └── saved-queries/
│           ├── route.ts         # GET + POST /api/saved-queries
│           └── [id]/route.ts    # DELETE /api/saved-queries/[id]
└── components/
    ├── SqlEditor.tsx
    ├── ResultsTable.tsx
    ├── SchemaBrowser.tsx
    └── SavedQueries.tsx
```

## Coding Conventions

- Raw SQL everywhere — no query builders, no ORMs.
- `lib/db.ts` is the only place that decides SQLite vs Turso. All other files import from it.
- `lib/query-guard.ts` must be pure and independently testable (no DB calls).
- Keep files under ~300 lines. Split if needed.
- No unnecessary abstractions — inline code beats a helper for a one-off.
- Prefer `async/await`. No callbacks.
- No auto-formatting config changes without asking.

## Vercel Compatibility

- `better-sqlite3` is a native module — **local dev only**. Never import it in production code paths.
- In production, use `@libsql/client` exclusively.
- No filesystem writes in API routes — Vercel has a read-only filesystem.
- Keep dependencies minimal and bundle size small.

## README Requirements

The README must cover:
1. Local setup (clone, install, env, migrate, seed, dev)
2. Explanation of persistence model (SQLite locally, Turso in prod, never auto-wipes)
3. Vercel deploy steps
4. Turso setup (create DB, get URL + token)
5. API docs (each route, request/response shape)

## Employability / Code Quality

- Commits: focused, descriptive, one logical change per commit.
- No over-engineering. No premature abstractions.
- Code must be readable to someone unfamiliar with the project.
- No committed TODOs unless they reference a tracked issue.

## Claude Priorities (in order)

1. Simplicity
2. Vercel compatibility
3. Data safety — never auto-wipe
4. Security — validate all SQL input
5. Readability
