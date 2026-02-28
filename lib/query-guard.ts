// Pure SQL validation — no DB calls, independently testable.
// Allows all DML + DDL (SELECT, INSERT, UPDATE, DELETE, CREATE, DROP, ALTER, WITH).
// Blocks only genuinely dangerous internals: PRAGMA, ATTACH, DETACH, sqlite_master.
// Auto-appends LIMIT 200 for SELECT/WITH queries that have no LIMIT clause.

export interface GuardResult {
  safe: boolean
  sql: string       // possibly modified (LIMIT appended)
  error?: string
}

// Blocked as first statement token (statement-type level)
const BLOCKED_FIRST_TOKEN = new Set(['pragma', 'attach', 'detach'])

// Blocked as content anywhere in the query (schema scraping)
const BLOCKED_CONTENT = [
  'sqlite_master',
  'sqlite_schema',
  'sqlite_temp_master',
]

// Statement types that get LIMIT 200 auto-appended
const SELECTS = new Set(['select', 'with'])

export function guardQuery(raw: string): GuardResult {
  // Strip single-line and block comments before analysis
  const stripped = raw
    .replace(/--[^\n]*/g, ' ')
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .trim()

  if (!stripped) {
    return { safe: false, sql: raw, error: 'Empty query' }
  }

  const firstToken = stripped.split(/\s+/)[0].toLowerCase()

  if (BLOCKED_FIRST_TOKEN.has(firstToken)) {
    return {
      safe: false,
      sql: raw,
      error: `${firstToken.toUpperCase()} statements are not allowed`,
    }
  }

  const lower = stripped.toLowerCase()
  for (const keyword of BLOCKED_CONTENT) {
    if (lower.includes(keyword)) {
      return { safe: false, sql: raw, error: `Blocked keyword: ${keyword}` }
    }
  }

  // Block multiple statements (semicolon outside string literals)
  if (countSemicolons(stripped) > 1) {
    return { safe: false, sql: raw, error: 'Only one statement at a time is allowed' }
  }

  // Auto-append LIMIT 200 only for SELECT / WITH
  if (SELECTS.has(firstToken)) {
    const hasLimit = /\blimit\b/i.test(stripped)
    const finalSql = hasLimit
      ? stripped
      : `${stripped.trimEnd().replace(/;$/, '')} LIMIT 200`
    return { safe: true, sql: finalSql }
  }

  return { safe: true, sql: stripped }
}

function countSemicolons(sql: string): number {
  let inString = false
  let count = 0
  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i]
    if (ch === "'" && sql[i - 1] !== '\\') inString = !inString
    if (!inString && ch === ';') count++
  }
  return count
}
