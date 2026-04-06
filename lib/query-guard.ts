// MySQL query guard — validates SQL before execution.
// Full MySQL practice environment: all DML/DDL allowed.
// Blocks only file I/O and shell execution.
// Auto-appends LIMIT 200 for SELECT/WITH queries that have no LIMIT clause.
// Supports stored procedures, functions, triggers, events, and views.

export interface GuardResult {
  safe: boolean
  sql: string       // possibly modified (LIMIT appended, DELIMITER stripped)
  error?: string
}

// No statement-level blocks — full MySQL practice environment
const BLOCKED_FIRST_TOKENS = new Set<string>([])

// Blocked patterns anywhere in the query
const BLOCKED_PATTERNS: RegExp[] = [
  /\bload\s+data\b/i,         // file read
  /\binto\s+outfile\b/i,      // file write
  /\binto\s+dumpfile\b/i,     // file write
  /\bsystem\s*\(/i,           // shell execution
]

// Statement types that get LIMIT 200 auto-appended
const SELECTS = new Set(['select', 'with'])

// Compound-body statements: CREATE PROCEDURE/FUNCTION/TRIGGER/EVENT
// These contain BEGIN...END blocks with internal semicolons.
const COMPOUND_RE =
  /^(create\s+(or\s+replace\s+)?(definer\s*=\s*\S+\s+)?(procedure|function|trigger|event))\b/i

// Check if a statement is a compound body (has BEGIN...END)
function isCompoundBody(sql: string): boolean {
  return COMPOUND_RE.test(sql.trim()) && /\bBEGIN\b/i.test(sql)
}

/**
 * Strip DELIMITER declarations and replace custom delimiters.
 * DELIMITER is a MySQL *client* command — the HTTP connector doesn't need it.
 * This lets users paste scripts that include DELIMITER // ... END // patterns.
 */
function stripDelimiters(raw: string): string {
  const delimiterLineRe = /^\s*DELIMITER\s+(\S+)\s*$/gim
  const matches = [...raw.matchAll(delimiterLineRe)]
  if (matches.length === 0) return raw

  // Find the custom (non-semicolon) delimiter
  const customDelim = matches.find(m => m[1] !== ';')?.[1]
  if (!customDelim) {
    // Only DELIMITER ; lines — just strip them
    return raw.replace(delimiterLineRe, '').trim()
  }

  // Strip all DELIMITER lines
  let result = raw.replace(delimiterLineRe, '')
  // Replace custom delimiter occurrences with empty string
  const escaped = customDelim.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  result = result.replace(new RegExp(escaped, 'g'), '')
  return result.trim()
}

export function guardQuery(raw: string): GuardResult {
  // Strip DELIMITER commands first (MySQL client-only, not needed for HTTP)
  const cleaned = stripDelimiters(raw)

  // Strip standard comments before analysis (not MySQL conditional comments /*!*/)
  const stripped = cleaned
    .replace(/--[^\n]*/g, ' ')
    .replace(/\/\*(?!\!)([\s\S]*?)\*\//g, ' ')
    .trim()

  if (!stripped) {
    return { safe: false, sql: raw, error: 'Empty query' }
  }

  const tokens = stripped.split(/\s+/)
  const firstToken = tokens[0].toLowerCase()
  const secondToken = (tokens[1] ?? '').toLowerCase()

  // Allow DROP DATABASE / DROP SCHEMA (schema management)
  if (firstToken === 'drop' && (secondToken === 'database' || secondToken === 'schema')) {
    return { safe: true, sql: stripped.replace(/;$/, '') }
  }

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

  // Auto-append LIMIT 200 for SELECT / WITH (but not inside procedure bodies)
  if (SELECTS.has(firstToken)) {
    const hasLimit = /\blimit\b/i.test(stripped)
    const noSemi = stripped.trimEnd().replace(/;$/, '')
    const finalSql = hasLimit ? noSemi : `${noSemi} LIMIT 200`
    return { safe: true, sql: finalSql }
  }

  // Compound body statements (CREATE PROCEDURE/FUNCTION/TRIGGER/EVENT)
  // Preserve internal semicolons — only strip the final trailing one after END
  if (isCompoundBody(cleaned)) {
    const finalSql = cleaned.trim().replace(/;\s*$/, '')
    return { safe: true, sql: finalSql }
  }

  // CREATE VIEW / DROP VIEW / ALTER VIEW etc. — standard DDL
  return { safe: true, sql: stripped.replace(/;$/, '') }
}

// Extract schema name from a USE statement, or null if not a USE statement.
export function extractUseSchema(sql: string): string | null {
  const match = sql.trim().match(/^USE\s+`?(\w+)`?\s*;?\s*$/i)
  return match ? match[1] : null
}
