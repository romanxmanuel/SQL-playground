// MySQL query guard — validates SQL before execution.
// More permissive than the old SQLite version since students need full MySQL DDL/DML.
// Blocks only truly dangerous operations (privilege escalation, file I/O, system DBs).
// Auto-appends LIMIT 200 for SELECT/WITH queries that have no LIMIT clause.

export interface GuardResult {
  safe: boolean
  sql: string       // possibly modified (LIMIT appended)
  error?: string
}

// Blocked statement types (first token)
const BLOCKED_FIRST_TOKENS = new Set([
  'grant', 'revoke',          // privilege escalation
])

// Blocked patterns anywhere in the query
const BLOCKED_PATTERNS: RegExp[] = [
  /\bload\s+data\b/i,         // file read
  /\binto\s+outfile\b/i,      // file write
  /\binto\s+dumpfile\b/i,     // file write
  /\bsystem\s*\(/i,           // shell execution
]

// Statement types that get LIMIT 200 auto-appended
const SELECTS = new Set(['select', 'with'])

export function guardQuery(raw: string): GuardResult {
  // Strip standard comments before analysis (not MySQL conditional comments /*!*/)
  const stripped = raw
    .replace(/--[^\n]*/g, ' ')
    .replace(/\/\*(?!\!)([\s\S]*?)\*\//g, ' ')
    .trim()

  if (!stripped) {
    return { safe: false, sql: raw, error: 'Empty query' }
  }

  const firstToken = stripped.split(/\s+/)[0].toLowerCase()

  if (BLOCKED_FIRST_TOKENS.has(firstToken)) {
    return {
      safe: false,
      sql: raw,
      error: `${firstToken.toUpperCase()} statements are not allowed`,
    }
  }

  const lower = stripped.toLowerCase()

  for (const re of BLOCKED_PATTERNS) {
    if (re.test(lower)) {
      return { safe: false, sql: raw, error: 'This type of operation is not allowed' }
    }
  }

  // Auto-append LIMIT 200 for SELECT / WITH
  if (SELECTS.has(firstToken)) {
    const hasLimit = /\blimit\b/i.test(stripped)
    const noSemi = stripped.trimEnd().replace(/;$/, '')
    const finalSql = hasLimit ? noSemi : `${noSemi} LIMIT 200`
    return { safe: true, sql: finalSql }
  }

  return { safe: true, sql: stripped.replace(/;$/, '') }
}

// Extract schema name from a USE statement, or null if not a USE statement.
export function extractUseSchema(sql: string): string | null {
  const match = sql.trim().match(/^USE\s+`?(\w+)`?\s*;?\s*$/i)
  return match ? match[1] : null
}
