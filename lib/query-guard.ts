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

/**
 * Split raw SQL input into individual statements, respecting:
 *  - String literals ('...' and "...")
 *  - Compound bodies (BEGIN...END) where semicolons are internal
 *  - DELIMITER declarations (stripped before splitting)
 *
 * Returns non-empty trimmed statements.
 */
export function splitStatements(raw: string): string[] {
  const cleaned = stripDelimiters(raw)
  const statements: string[] = []
  let current = ''
  let inSingle = false
  let inDouble = false
  let depth = 0    // BEGIN nesting depth
  let i = 0

  while (i < cleaned.length) {
    const ch = cleaned[i]
    const rest = cleaned.slice(i)

    // Handle escape sequences inside strings
    if ((inSingle || inDouble) && ch === '\\') {
      current += ch + (cleaned[i + 1] ?? '')
      i += 2
      continue
    }

    // Toggle string state
    if (ch === "'" && !inDouble) {
      inSingle = !inSingle
      current += ch
      i++
      continue
    }
    if (ch === '"' && !inSingle) {
      inDouble = !inDouble
      current += ch
      i++
      continue
    }

    // Skip processing inside strings
    if (inSingle || inDouble) {
      current += ch
      i++
      continue
    }

    // Track BEGIN/END nesting (case-insensitive, word boundary)
    // Only count standalone END (not END IF, END WHILE, END LOOP, END CASE, etc.)
    const wordMatch = rest.match(/^(\w+)/)
    if (wordMatch) {
      const word = wordMatch[1].toUpperCase()
      if (word === 'BEGIN') {
        depth++
      } else if (word === 'END' && depth > 0) {
        // Check what follows END — if it's IF/WHILE/LOOP/CASE/REPEAT/FOR, skip
        const afterEnd = rest.slice(3).match(/^\s*(\w+)/)
        const suffix = afterEnd ? afterEnd[1].toUpperCase() : ''
        const compoundSuffixes = new Set(['IF', 'WHILE', 'LOOP', 'CASE', 'REPEAT', 'FOR'])
        if (!compoundSuffixes.has(suffix)) {
          depth--
          // When depth returns to 0, the compound body is complete.
          // Consume the END keyword and treat it as a statement boundary.
          if (depth === 0) {
            current += 'END'
            i += 3 // skip past "END"
            // Skip optional trailing whitespace/semicolon
            while (i < cleaned.length && /[\s;]/.test(cleaned[i])) i++
            const stmt = current.trim()
            if (stmt) statements.push(stmt)
            current = ''
            continue
          }
        }
      }
    }

    // Semicolon outside strings and outside compound bodies = statement boundary
    if (ch === ';' && depth === 0) {
      const stmt = current.trim()
      if (stmt) statements.push(stmt)
      current = ''
      i++
      continue
    }

    current += ch
    i++
  }

  // Remaining text (no trailing semicolon)
  const last = current.trim()
  if (last) statements.push(last)

  return statements
}

// Extract schema name from a USE statement, or null if not a USE statement.
export function extractUseSchema(sql: string): string | null {
  const match = sql.trim().match(/^USE\s+`?(\w+)`?\s*;?\s*$/i)
  return match ? match[1] : null
}
