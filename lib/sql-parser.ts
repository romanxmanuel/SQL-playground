/**
 * Parses a MySQL dump file into individual executable statements.
 * Handles the format produced by mysqldump 8.x:
 *  - Extracts the target schema from CREATE DATABASE / USE statements
 *  - Skips LOCK TABLES / UNLOCK TABLES (not needed for serverless execution)
 *  - Preserves MySQL conditional comments (!bang comments) so MySQL can execute them
 *  - Skips USE <schema> (caller handles DB selection at connection level)
 */

export interface ParsedDump {
  /** Database name from CREATE DATABASE / USE, or null if not found */
  targetSchema: string | null
  /** Statements to execute, in order */
  statements: string[]
  /** Any parse warnings (non-fatal) */
  warnings: string[]
}

export function parseDump(rawSql: string): ParsedDump {
  const all = splitStatements(rawSql)
  let targetSchema: string | null = null
  const statements: string[] = []
  const warnings: string[] = []

  for (const stmt of all) {
    const trimmed = stmt.trim()
    if (!trimmed) continue

    // CREATE DATABASE — extract name, skip (caller creates it separately)
    const createDbMatch = trimmed.match(
      /^\s*CREATE\s+(?:DATABASE|SCHEMA)\s+(?:IF\s+NOT\s+EXISTS\s+)?`?(\w+)`?/i
    )
    if (createDbMatch) {
      targetSchema = createDbMatch[1]
      continue
    }

    // USE <schema> — extract name, skip
    const useMatch = trimmed.match(/^\s*USE\s+`?(\w+)`?\s*$/i)
    if (useMatch) {
      targetSchema = useMatch[1]
      continue
    }

    // LOCK TABLES / UNLOCK TABLES — skip (serverless driver doesn't need them)
    if (/^\s*(?:LOCK|UNLOCK)\s+TABLES?\b/i.test(trimmed)) continue

    // DROP DATABASE — skip (don't drop databases during upload)
    if (/^\s*DROP\s+(?:DATABASE|SCHEMA)\b/i.test(trimmed)) continue

    statements.push(trimmed)
  }

  return { targetSchema, statements, warnings }
}

/**
 * Splits SQL text into individual statements on semicolons.
 * Correctly handles:
 *  - Single-quoted string literals (including \' escapes)
 *  - Double-quoted identifiers
 *  - Backtick identifiers
 *  - Standard block comments: /* ... *\/
 *  - MySQL conditional comments: /*!NNNN ... *\/  (preserved as-is)
 *  - Single-line comments: -- ...
 */
function splitStatements(sql: string): string[] {
  const stmts: string[] = []
  let current = ''
  let i = 0
  const n = sql.length

  while (i < n) {
    const ch = sql[i]

    // Single-line comment
    if (ch === '-' && sql[i + 1] === '-') {
      // Skip to end of line but keep newline
      while (i < n && sql[i] !== '\n') i++
      current += ' '
      continue
    }

    // Block comment: /* ... */
    if (ch === '/' && sql[i + 1] === '*') {
      const isConditional = sql[i + 2] === '!'
      const start = i
      i += 2
      while (i < n - 1 && !(sql[i] === '*' && sql[i + 1] === '/')) i++
      i += 2 // skip */
      if (isConditional) {
        // Keep MySQL conditional comments — MySQL will execute them
        current += sql.slice(start, i)
      }
      // Regular comments are dropped
      continue
    }

    // String / identifier quoting
    if (ch === "'" || ch === '"' || ch === '`') {
      const quote = ch
      current += ch
      i++
      while (i < n) {
        const c = sql[i]
        if (c === '\\' && quote !== '`' && i + 1 < n) {
          current += c + sql[i + 1]
          i += 2
          continue
        }
        current += c
        i++
        if (c === quote) break
      }
      continue
    }

    // Statement terminator
    if (ch === ';') {
      const t = current.trim()
      if (t) stmts.push(t)
      current = ''
      i++
      continue
    }

    current += ch
    i++
  }

  const last = current.trim()
  if (last) stmts.push(last)
  return stmts
}
