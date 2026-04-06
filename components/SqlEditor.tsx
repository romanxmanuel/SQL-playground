'use client'

import { useCallback, useRef, useState, useEffect, useMemo } from 'react'

interface Props {
  value: string
  onChange: (sql: string) => void
  onRun: (sqlOverride?: string) => void
  isLoading: boolean
}

const FONT_SIZE = 16
const LINE_HEIGHT_PX = Math.round(FONT_SIZE * 1.6) // 26px
const PAD_TOP = 8

// ── SQL syntax highlighting ────────────────────────────────────────

const SQL_KEYWORDS = new Set([
  'SELECT','FROM','WHERE','AND','OR','NOT','IN','IS','NULL','AS','ON',
  'JOIN','LEFT','RIGHT','INNER','OUTER','CROSS','FULL','NATURAL',
  'INSERT','INTO','VALUES','UPDATE','SET','DELETE','REPLACE',
  'CREATE','ALTER','DROP','TABLE','INDEX','VIEW','DATABASE','SCHEMA',
  'PROCEDURE','FUNCTION','TRIGGER','EVENT','RETURNS','RETURN',
  'IF','THEN','ELSE','ELSEIF','END','CASE','WHEN','WHILE','DO',
  'LOOP','REPEAT','UNTIL','FOR','EACH','ROW','LEAVE','ITERATE',
  'BEGIN','DECLARE','CURSOR','OPEN','FETCH','CLOSE','HANDLER',
  'CALL','DELIMITER','DEFINER','DETERMINISTIC','READS','MODIFIES',
  'SQL','DATA','CONTAINS','LANGUAGE','COMMENT','SECURITY','INVOKER',
  'CASCADE','RESTRICT','NO','ACTION','REFERENCES','FOREIGN','KEY',
  'PRIMARY','UNIQUE','CHECK','DEFAULT','AUTO_INCREMENT','CONSTRAINT',
  'ADD','COLUMN','MODIFY','CHANGE','RENAME','TRUNCATE',
  'GROUP','BY','ORDER','HAVING','LIMIT','OFFSET','ASC','DESC',
  'UNION','ALL','INTERSECT','EXCEPT','EXISTS','ANY','SOME',
  'BETWEEN','LIKE','REGEXP','RLIKE','ESCAPE',
  'DISTINCT','TOP','WITH','RECURSIVE','TEMPORARY','TEMP',
  'GRANT','REVOKE','PRIVILEGES','TO','IDENTIFIED',
  'SHOW','DESCRIBE','DESC','EXPLAIN','USE','ANALYZE',
  'COMMIT','ROLLBACK','SAVEPOINT','START','TRANSACTION','LOCK','UNLOCK',
  'TRUE','FALSE','UNKNOWN','BOOLEAN','BOOL',
  'INT','INTEGER','BIGINT','SMALLINT','TINYINT','MEDIUMINT',
  'FLOAT','DOUBLE','DECIMAL','NUMERIC','REAL',
  'CHAR','VARCHAR','TEXT','TINYTEXT','MEDIUMTEXT','LONGTEXT',
  'BLOB','TINYBLOB','MEDIUMBLOB','LONGBLOB','BINARY','VARBINARY',
  'DATE','TIME','DATETIME','TIMESTAMP','YEAR',
  'JSON','ENUM','UNSIGNED','SIGNED','ZEROFILL',
  'NOT','NULL','DEFAULT','AFTER','FIRST',
  'IF','EXISTS','OR','REPLACE',
  'OVER','PARTITION','ROWS','RANGE','UNBOUNDED','PRECEDING','FOLLOWING','CURRENT',
])

const SQL_FUNCTIONS = new Set([
  'COUNT','SUM','AVG','MIN','MAX','GROUP_CONCAT',
  'CONCAT','CONCAT_WS','SUBSTRING','SUBSTR','LEFT','RIGHT','TRIM',
  'LTRIM','RTRIM','UPPER','UCASE','LOWER','LCASE','LENGTH','CHAR_LENGTH',
  'REPLACE','REVERSE','REPEAT','SPACE','LPAD','RPAD','INSTR','LOCATE',
  'FORMAT','INSERT','FIELD','FIND_IN_SET','MAKE_SET','ELT',
  'ABS','CEIL','CEILING','FLOOR','ROUND','TRUNCATE','MOD','POWER','POW',
  'SQRT','SIGN','RAND','GREATEST','LEAST','LOG','LOG2','LOG10','EXP','PI',
  'NOW','CURDATE','CURTIME','CURRENT_DATE','CURRENT_TIME','CURRENT_TIMESTAMP',
  'DATE_FORMAT','DATE_ADD','DATE_SUB','DATEDIFF','TIMEDIFF','TIMESTAMPDIFF',
  'DAY','MONTH','YEAR','HOUR','MINUTE','SECOND','DAYNAME','MONTHNAME',
  'DAYOFWEEK','DAYOFYEAR','WEEK','WEEKDAY','EXTRACT','STR_TO_DATE',
  'COALESCE','NULLIF','IFNULL','IF','CASE','CAST','CONVERT',
  'ROW_NUMBER','RANK','DENSE_RANK','NTILE','LAG','LEAD',
  'FIRST_VALUE','LAST_VALUE','NTH_VALUE',
  'JSON_EXTRACT','JSON_OBJECT','JSON_ARRAY','JSON_SET','JSON_REMOVE',
  'JSON_CONTAINS','JSON_LENGTH','JSON_TYPE','JSON_VALID','JSON_UNQUOTE',
  'UUID','VERSION','DATABASE','SCHEMA','USER','CURRENT_USER','SESSION_USER',
  'LAST_INSERT_ID','ROW_COUNT','FOUND_ROWS',
])

interface Token {
  type: 'keyword' | 'function' | 'string' | 'number' | 'comment' | 'operator' | 'text' | 'newline'
  value: string
}

function tokenize(sql: string): Token[] {
  const tokens: Token[] = []
  let i = 0

  while (i < sql.length) {
    // Newlines (keep separate so <pre> renders them)
    if (sql[i] === '\n') {
      tokens.push({ type: 'newline', value: '\n' })
      i++
      continue
    }

    // Single-line comment: -- ...
    if (sql[i] === '-' && sql[i + 1] === '-') {
      let end = i + 2
      while (end < sql.length && sql[end] !== '\n') end++
      tokens.push({ type: 'comment', value: sql.slice(i, end) })
      i = end
      continue
    }

    // Block comment: /* ... */
    if (sql[i] === '/' && sql[i + 1] === '*') {
      let end = i + 2
      while (end < sql.length && !(sql[end] === '*' && sql[end + 1] === '/')) end++
      end += 2 // include */
      tokens.push({ type: 'comment', value: sql.slice(i, Math.min(end, sql.length)) })
      i = Math.min(end, sql.length)
      continue
    }

    // Single-quoted string
    if (sql[i] === "'") {
      let end = i + 1
      while (end < sql.length) {
        if (sql[end] === '\\') { end += 2; continue }
        if (sql[end] === "'") { end++; break }
        end++
      }
      tokens.push({ type: 'string', value: sql.slice(i, end) })
      i = end
      continue
    }

    // Double-quoted string
    if (sql[i] === '"') {
      let end = i + 1
      while (end < sql.length) {
        if (sql[end] === '\\') { end += 2; continue }
        if (sql[end] === '"') { end++; break }
        end++
      }
      tokens.push({ type: 'string', value: sql.slice(i, end) })
      i = end
      continue
    }

    // Backtick-quoted identifier
    if (sql[i] === '`') {
      let end = i + 1
      while (end < sql.length && sql[end] !== '`') end++
      end++ // include closing `
      tokens.push({ type: 'string', value: sql.slice(i, Math.min(end, sql.length)) })
      i = Math.min(end, sql.length)
      continue
    }

    // Numbers (including decimals)
    if (/\d/.test(sql[i]) || (sql[i] === '.' && i + 1 < sql.length && /\d/.test(sql[i + 1]))) {
      let end = i
      if (sql[end] === '.') end++
      while (end < sql.length && /[\d.]/.test(sql[end])) end++
      // Don't match if preceded by a word char (it's part of an identifier)
      if (i > 0 && /\w/.test(sql[i - 1])) {
        tokens.push({ type: 'text', value: sql.slice(i, end) })
      } else {
        tokens.push({ type: 'number', value: sql.slice(i, end) })
      }
      i = end
      continue
    }

    // Words (keywords, functions, identifiers)
    if (/[a-zA-Z_@]/.test(sql[i])) {
      let end = i
      while (end < sql.length && /[\w@]/.test(sql[end])) end++
      const word = sql.slice(i, end)
      const upper = word.toUpperCase()

      // Check if followed by ( to detect function calls
      let j = end
      while (j < sql.length && sql[j] === ' ') j++
      const isCall = j < sql.length && sql[j] === '('

      if (SQL_KEYWORDS.has(upper)) {
        tokens.push({ type: 'keyword', value: word })
      } else if (SQL_FUNCTIONS.has(upper) || (isCall && /^[A-Z_]+$/i.test(word))) {
        tokens.push({ type: 'function', value: word })
      } else {
        tokens.push({ type: 'text', value: word })
      }
      i = end
      continue
    }

    // Operators
    if (/[=<>!+\-*/%&|^~]/.test(sql[i])) {
      let end = i + 1
      // Handle multi-char operators like !=, <=, >=, <>, :=, <<, >>
      if (end < sql.length && /[=<>]/.test(sql[end])) end++
      tokens.push({ type: 'operator', value: sql.slice(i, end) })
      i = end
      continue
    }

    // Everything else (whitespace, punctuation, etc.)
    tokens.push({ type: 'text', value: sql[i] })
    i++
  }

  return tokens
}

// Colors for each token type
const TOKEN_COLORS: Record<Token['type'], string> = {
  keyword:  '#38bdf8',  // accent blue
  function: '#c084fc',  // purple
  string:   '#34d399',  // green
  number:   '#fbbf24',  // amber
  comment:  '#4a6080',  // dim gray
  operator: '#94a3b8',  // slate
  text:     '#dce8ff',  // default text
  newline:  '',
}

function renderHighlighted(sql: string): React.ReactNode[] {
  const tokens = tokenize(sql)
  return tokens.map((tok, i) => {
    if (tok.type === 'newline') return '\n'
    const color = TOKEN_COLORS[tok.type]
    if (tok.type === 'text' || tok.type === 'operator') {
      return <span key={i} style={{ color }}>{tok.value}</span>
    }
    return (
      <span key={i} style={{
        color,
        fontStyle: tok.type === 'comment' ? 'italic' : undefined,
        fontWeight: tok.type === 'keyword' ? 600 : undefined,
      }}>
        {tok.value}
      </span>
    )
  })
}

// ── Component ──────────────────────────────────────────────────────

export default function SqlEditor({ value, onChange, onRun, isLoading }: Props) {
  const textareaRef  = useRef<HTMLTextAreaElement>(null)
  const gutterRef    = useRef<HTMLDivElement>(null)
  const highlightRef = useRef<HTMLPreElement>(null)
  const [focused, setFocused] = useState(false)
  const [hasSelection, setHasSelection] = useState(false)

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        const ta = textareaRef.current
        if (ta && ta.selectionStart !== ta.selectionEnd) {
          // Run only the selected text
          const selected = ta.value.substring(ta.selectionStart, ta.selectionEnd).trim()
          if (selected) {
            onRun(selected)
            return
          }
        }
        onRun()
      }
    },
    [onRun]
  )

  const handleRunClick = useCallback(() => {
    const ta = textareaRef.current
    if (ta && ta.selectionStart !== ta.selectionEnd) {
      const selected = ta.value.substring(ta.selectionStart, ta.selectionEnd).trim()
      if (selected) {
        onRun(selected)
        return
      }
    }
    onRun()
  }, [onRun])

  const syncScroll = useCallback(() => {
    const ta = textareaRef.current
    if (!ta) return
    if (gutterRef.current) gutterRef.current.scrollTop = ta.scrollTop
    if (highlightRef.current) {
      highlightRef.current.scrollTop = ta.scrollTop
      highlightRef.current.scrollLeft = ta.scrollLeft
    }
  }, [])

  // Track selection state for button label
  const handleSelect = useCallback(() => {
    const ta = textareaRef.current
    if (ta) setHasSelection(ta.selectionStart !== ta.selectionEnd)
  }, [])

  // Sync scroll on mount and whenever value changes
  useEffect(() => { syncScroll() }, [value, syncScroll])

  const lineCount = Math.max(1, value.split('\n').length)
  const highlighted = useMemo(() => renderHighlighted(value), [value])

  const sharedFontStyle = {
    fontFamily: 'var(--font-mono)',
    fontSize: FONT_SIZE,
    lineHeight: `${LINE_HEIGHT_PX}px`,
  } as const

  const editorPadding = `${PAD_TOP}px 12px ${PAD_TOP}px 52px`

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 12px 8px' }}>
      <div style={{
        position: 'relative',
        border: `1px solid ${focused ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 6,
        transition: 'border-color 0.15s',
        overflow: 'hidden',
      }}>
        {/* Gutter background */}
        <div style={{
          position: 'absolute', top: 0, left: 0, bottom: 0, width: 44,
          background: 'var(--bg-panel)',
          borderRight: '1px solid var(--border)',
          pointerEvents: 'none',
          zIndex: 1,
        }} />

        {/* Line numbers */}
        <div ref={gutterRef} style={{
          position: 'absolute', top: 0, left: 0, bottom: 0, width: 44,
          overflow: 'hidden',
          paddingTop: PAD_TOP,
          textAlign: 'right',
          ...sharedFontStyle,
          color: 'var(--text-muted)',
          userSelect: 'none',
          pointerEvents: 'none',
          zIndex: 2,
        }}>
          {Array.from({ length: lineCount }, (_, i) => (
            <div key={i} style={{ paddingRight: 8, height: LINE_HEIGHT_PX }}>{i + 1}</div>
          ))}
        </div>

        {/* Syntax highlight overlay (behind textarea) */}
        <pre
          ref={highlightRef}
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, bottom: 0,
            margin: 0,
            padding: editorPadding,
            ...sharedFontStyle,
            background: 'transparent',
            color: 'var(--text)',
            overflow: 'hidden',
            pointerEvents: 'none',
            zIndex: 1,
            whiteSpace: 'pre',
            overflowWrap: undefined,
            wordBreak: 'keep-all',
            border: 'none',
          }}
        >{highlighted}{'\n'}</pre>

        {/* Textarea (transparent text, handles input) */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onScroll={syncScroll}
          onSelect={handleSelect}
          onMouseUp={handleSelect}
          onFocus={() => setFocused(true)}
          onBlur={() => { setFocused(false); setHasSelection(false) }}
          spellCheck={false}
          wrap="off"
          rows={8}
          style={{
            position: 'relative',
            display: 'block',
            width: '100%',
            margin: 0,
            background: 'var(--bg-input)',
            color: 'transparent',
            caretColor: 'var(--text)',
            border: 'none',
            padding: editorPadding,
            ...sharedFontStyle,
            resize: 'vertical',
            outline: 'none',
            minHeight: 148,
            zIndex: 2,
            whiteSpace: 'pre',
            overflowX: 'auto',
          }}
        />
      </div>
      <div className="sql-editor-toolbar" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <button
          className="btn-run"
          onClick={handleRunClick}
          disabled={isLoading}
          style={{
            background: isLoading ? 'var(--bg-hover)' : 'var(--accent)',
            color: isLoading ? 'var(--text-muted)' : '#0d1117',
            border: 'none',
            borderRadius: 6,
            padding: '10px 18px',
            fontWeight: 600,
            fontSize: 13,
            transition: 'background 0.15s',
          }}
        >
          {isLoading ? 'Running…' : hasSelection ? 'Run Selection' : 'Run Query'}
        </button>
        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
          {typeof window !== 'undefined' && navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}+Enter
          {hasSelection && <span style={{ color: 'var(--accent)', marginLeft: 6 }}>· selection</span>}
        </span>
      </div>
    </div>
  )
}
