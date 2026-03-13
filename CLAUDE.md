# SQL Playground - Project Context

## What This Is

Deployable SQL practice web app for learning real query writing in a safe environment.
Users can run queries, inspect schema, browse tables, view an ERD, and save useful queries.

This project may be touched by both Claude Code and Codex. The repo files should be enough for either tool to recover context quickly.

## Current Tech Stack

- Next.js 15 (App Router)
- TypeScript
- Local database: SQLite via `better-sqlite3`
- Production database: Turso / libSQL via `@libsql/client`
- ORM: none - raw SQL only
- Deployment: Vercel

## Commands

```bash
npm install
npm run dev
npm run db:migrate
npm run db:seed
npm run db:reset
npm run build
```

## Environment

Local development does not require `.env.local`.

Production uses:

```bash
TURSO_DATABASE_URL=
TURSO_AUTH_TOKEN=
```

## Core Rules

- Never auto-wipe data on startup or deploy.
- `db:migrate` must stay idempotent.
- `db:seed` should skip inserts if data already exists.
- `db:reset` is destructive and must require explicit confirmation.
- Only `SELECT` and `WITH` queries are allowed through the query API.
- Result sets are capped at 200 rows.
- Raw SQL only - do not add an ORM or query builder.

## Current Product Scope

- SQL editor with keyboard shortcut
- Schema browser
- Tables view
- Mermaid ERD view
- Saved queries
- Mobile-friendly navigation
- Rate limiting and query guardrails

## Key Files

```text
SQL-playground/
  CLAUDE.md
  README.md
  app/
    page.tsx
    globals.css
    api/
  components/
  lib/
    db.ts
    query-guard.ts
    rate-limit.ts
  scripts/
    _ddl.ts
    migrate.ts
    seed.ts
    reset.ts
```

## Working Notes

- `lib/db.ts` owns backend selection between local SQLite and Turso.
- `lib/query-guard.ts` should stay pure and easy to test.
- Prefer small, readable components over abstraction-heavy helpers.
- If repo behavior and this file drift apart, update this file early.

## Collaboration Notes

- Read `README.md` and this file before making architecture changes.
- Check `git status` before editing.
- Preserve existing raw-SQL learning focus.
