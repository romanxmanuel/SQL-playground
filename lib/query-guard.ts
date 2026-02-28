// Pure SQL validation — no DB calls, independently testable.
// Operates on a single statement (the query route splits multi-statement scripts).
// Blocks PRAGMA, ATTACH, DETACH, and sqlite_master references.
// Auto-appends LIMIT 200 for SELECT/WITH queries without a LIMIT clause.

export interface GuardResult {
  safe: boolean
  sql: string       // possibly modified (LIMIT appended)
  error?: string
}

// Blocked as first token (statement-type level)
const BLOCKED_FIRST_TOKEN = new Set(['pragma', 'attach', 'detach'])

// Blocked anywhere in the query (prevents schema scraping)
const BLOCKED_CONTENT = [
  'sqlite_master',
  'sqlite_schema',
  'sqlite_temp_master',
]

// Statement types that get LIMIT 200 auto-appended
const SELECTS = new Set(['select', 'with'])

export function guardQuery(raw: string): GuardResult {
  // Strip comments before analysis
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

  // Auto-append LIMIT 200 for SELECT / WITH
  if (SELECTS.has(firstToken)) {
    const hasLimit = /\blimit\b/i.test(stripped)
    const finalSql = hasLimit
      ? stripped
      : `${stripped.trimEnd().replace(/;$/, '')} LIMIT 200`
    return { safe: true, sql: finalSql }
  }

  return { safe: true, sql: stripped }
}
