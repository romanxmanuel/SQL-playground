'use client'

interface Props {
  columns: string[]
  rows: Record<string, unknown>[]
  error: string | null
  truncated?: boolean
  messages?: string[]   // DDL/DML summaries from multi-statement execution
}

export default function ResultsTable({ columns, rows, error, truncated, messages }: Props) {
  if (error) {
    const lineMatch = error.match(/(?:at line|line)\s+(\d+)/i)
    const lineNum = lineMatch ? parseInt(lineMatch[1]) : null
    return (
      <div style={{ padding: '12px', fontFamily: 'var(--font-mono)', fontSize: 13, display: 'flex', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
        {lineNum != null && (
          <span style={{
            background: 'var(--error)', color: '#0d1117',
            borderRadius: 4, padding: '2px 7px',
            fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0,
          }}>
            Line {lineNum}
          </span>
        )}
        <span style={{ color: 'var(--error)' }}>{error}</span>
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      {/* Multi-statement DDL/DML summaries */}
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
      </div>
    </div>
  )
}
