'use client'

interface ResultSet {
  label: string
  columns: string[]
  rows: Record<string, unknown>[]
  truncated: boolean
}

interface Props {
  columns: string[]
  rows: Record<string, unknown>[]
  error: string | null
  errorLine?: number | null
  truncated?: boolean
  messages?: string[]
  resultSets?: ResultSet[]
}

export default function ResultsTable({ columns, rows, error, errorLine, truncated, messages, resultSets }: Props) {
  if (error) {
    let lineNum = errorLine ?? null
    if (lineNum == null) {
      const lineMatch = error.match(/(?:at line|line)\s+(\d+)/i)
      lineNum = lineMatch ? parseInt(lineMatch[1]) : null
    }

    return (
      <div style={{
        padding: '12px 16px',
        fontFamily: 'var(--font-mono)',
        fontSize: 13,
        borderLeft: '3px solid var(--error)',
        margin: 8,
        borderRadius: '0 6px 6px 0',
        background: 'rgba(251, 113, 133, 0.06)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <span style={{
            color: 'var(--error)',
            fontWeight: 700,
            fontSize: 12,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
          }}>
            Error
          </span>
          {lineNum != null && (
            <span style={{
              background: 'var(--error)', color: '#0d1117',
              borderRadius: 4, padding: '1px 7px',
              fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
            }}>
              Line {lineNum}
            </span>
          )}
        </div>
        <div style={{ color: 'var(--text)', lineHeight: 1.5 }}>{error}</div>
      </div>
    )
  }

  // Multi-statement: render all result sets stacked
  if (resultSets && resultSets.length > 0) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, overflowY: 'auto' }}>
        {resultSets.map((rs, idx) => (
          <div key={idx} style={{ borderBottom: idx < resultSets.length - 1 ? '2px solid var(--accent-dim)' : undefined }}>
            {/* Result set header */}
            <div style={{
              padding: '6px 12px',
              borderBottom: '1px solid var(--border)',
              color: 'var(--text-muted)',
              fontSize: 12,
              display: 'flex',
              gap: 8,
              alignItems: 'center',
              background: 'var(--bg-panel)',
              position: 'sticky',
              top: 0,
              zIndex: 2,
            }}>
              <span style={{
                color: 'var(--accent)',
                fontWeight: 600,
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
              }}>
                {rs.label}
              </span>
              <span style={{ color: 'var(--success)' }}>
                {rs.rows.length} row{rs.rows.length !== 1 ? 's' : ''}
              </span>
              {rs.truncated && (
                <span style={{ color: 'var(--warning)' }}>· truncated to 200</span>
              )}
            </div>
            <ResultTable columns={rs.columns} rows={rs.rows} />
          </div>
        ))}
      </div>
    )
  }

  if (columns.length === 0) {
    return (
      <div style={{ padding: '12px', color: 'var(--text-muted)', fontSize: 13 }}>
        Run a query to see results.
      </div>
    )
  }

  // Single result set
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {messages && messages.length > 0 && (
        <div style={{
          padding: '6px 12px',
          borderBottom: '1px solid var(--border)',
          fontSize: 12,
          fontFamily: 'var(--font-mono)',
        }}>
          {messages.map((msg, i) => (
            <div key={i} style={{ color: 'var(--success)', padding: '1px 0' }}>{msg}</div>
          ))}
        </div>
      )}
      <div style={{
        padding: '6px 12px',
        borderBottom: '1px solid var(--border)',
        color: 'var(--text-muted)',
        fontSize: 12,
        display: 'flex',
        gap: 8,
        alignItems: 'center',
      }}>
        <span style={{ color: 'var(--success)' }}>{rows.length} row{rows.length !== 1 ? 's' : ''}</span>
        {truncated && (
          <span style={{ color: 'var(--warning)' }}>· truncated to 200</span>
        )}
      </div>
      <div className="table-scroll-wrapper">
        <ResultTable columns={columns} rows={rows} />
      </div>
    </div>
  )
}

/** Shared table renderer used by both single and multi-result views */
function ResultTable({ columns, rows }: { columns: string[]; rows: Record<string, unknown>[] }) {
  return (
    <table style={{
      width: '100%',
      borderCollapse: 'collapse',
      fontFamily: 'var(--font-mono)',
      fontSize: 12,
      whiteSpace: 'nowrap',
    }}>
      <thead>
        <tr>
          {columns.map((col) => (
            <th
              key={col}
              style={{
                padding: '6px 10px',
                textAlign: 'left',
                background: 'var(--bg-panel)',
                color: 'var(--accent)',
                fontWeight: 600,
                borderBottom: '1px solid var(--border)',
                position: 'sticky',
                top: 0,
                zIndex: 1,
              }}
            >
              {col}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((row, i) => (
          <tr
            key={i}
            style={{ background: i % 2 === 0 ? 'transparent' : 'var(--bg-panel)' }}
          >
            {columns.map((col) => (
              <td
                key={col}
                style={{
                  padding: '5px 10px',
                  borderBottom: '1px solid var(--border)',
                  color: row[col] === null ? 'var(--text-muted)' : 'var(--text)',
                  maxWidth: 300,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
                title={String(row[col] ?? 'NULL')}
              >
                {row[col] === null ? 'NULL' : String(row[col])}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  )
}
