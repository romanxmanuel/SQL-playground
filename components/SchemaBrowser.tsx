'use client'

import { useEffect, useState } from 'react'

interface Column {
  name: string
  type: string
}

interface Table {
  name: string
  columns: Column[]
}

export default function SchemaBrowser() {
  const [tables, setTables] = useState<Table[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function loadSchema() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/schema')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setTables(data.tables)
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadSchema() }, [])

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{
        padding: '10px 12px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Schema
        </span>
        <button
          onClick={loadSchema}
          title="Refresh schema"
          style={{
            background: 'none',
            border: 'none',
            color: 'var(--text-muted)',
            fontSize: 14,
            padding: '8px',
            minWidth: 36,
            minHeight: 36,
          }}
        >
          ↺
        </button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '6px 0' }}>
        {loading && (
          <div style={{ padding: '10px 12px', color: 'var(--text-muted)', fontSize: 12 }}>Loading…</div>
        )}
        {error && (
          <div style={{ padding: '10px 12px', color: 'var(--error)', fontSize: 12 }}>{error}</div>
        )}
        {!loading && !error && tables.map((table) => (
          <details key={table.name} style={{ marginBottom: 2 }}>
            <summary style={{
              padding: '10px 12px',
              cursor: 'pointer',
              fontSize: 13,
              color: 'var(--accent)',
              fontFamily: 'var(--font-mono)',
              userSelect: 'none',
              listStyle: 'none',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
            }}>
              <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>▶</span>
              {table.name}
            </summary>
            <div style={{ paddingLeft: 20 }}>
              {table.columns.map((col) => (
                <div
                  key={col.name}
                  style={{
                    padding: '3px 12px',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 12,
                    display: 'flex',
                    gap: 8,
                  }}
                >
                  <span style={{ color: 'var(--text)' }}>{col.name}</span>
                  <span style={{ color: 'var(--text-muted)' }}>{col.type}</span>
                </div>
              ))}
            </div>
          </details>
        ))}
        {!loading && !error && tables.length === 0 && (
          <div style={{ padding: '10px 12px', color: 'var(--text-muted)', fontSize: 12 }}>
            No tables found. Run <code>npm run db:migrate</code>.
          </div>
        )}
      </div>
    </div>
  )
}
