'use client'

interface Props {
  columns: string[]
  rows: Record<string, unknown>[]
  error: string | null
  truncated?: boolean
}

export default function ResultsTable({ columns, rows, error, truncated }: Props) {
  if (error) {
    return (
      <div style={{ padding: '12px', color: 'var(--error)', fontFamily: 'var(--font-mono)', fontSize: 13 }}>
        {error}
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
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
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
