// Pure SQL validation — no DB calls, independently testable.
// Allows only SELECT and WITH queries; blocks dangerous keywords;
// auto-appends LIMIT 200 when no LIMIT clause is present.

export interface GuardResult {
  safe: boolean
  sql: string       // possibly modified (LIMIT appended)
  error?: string
}

const BLOCKED = [
  'pragma',
  'attach',
  'detach',
  'sqlite_master',
  'sqlite_schema',
  'sqlite_temp_master',
]

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
  if (firstToken !== 'select' && firstToken !== 'with') {
    return {
      safe: false,
      sql: raw,
      error: `Only SELECT and WITH queries are allowed. Got: ${firstToken.toUpperCase()}`,
    }
  }

  const lower = stripped.toLowerCase()
  for (const keyword of BLOCKED) {
    if (lower.includes(keyword)) {
      return { safe: false, sql: raw, error: `Blocked keyword: ${keyword}` }
    }
  }

  // Block multiple statements by counting semicolons outside string literals
  if (countSemicolons(stripped) > 1) {
    return { safe: false, sql: raw, error: 'Multiple statements are not allowed' }
  }

  // Auto-append LIMIT 200 when missing
  const hasLimit = /\blimit\b/i.test(stripped)
  const finalSql = hasLimit
    ? stripped
    : `${stripped.trimEnd().replace(/;$/, '')} LIMIT 200`

  return { safe: true, sql: finalSql }
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
