'use client'

import { useEffect, useState } from 'react'
import type { SchemaTable } from '@/app/api/schema/route'

export default function TablesView() {
  const [tables, setTables] = useState<SchemaTable[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [expandedTable, setExpandedTable] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/schema')
      .then((r) => r.json())
      .then((d) => setTables(d.tables ?? []))
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false))
  }, [])

  function copyText(text: string, key: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key)
      setTimeout(() => setCopied(null), 1500)
    })
  }

  const filtered = tables.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase())
  )

  const s: Record<string, React.CSSProperties> = {
    root:     { padding: 16, flex: 1, overflowY: 'auto' },
    search:   { width: '100%', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text)', padding: '8px 12px', fontSize: 16, outline: 'none', marginBottom: 16 },
    grid:     { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 10 },
    card:     { background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 8, padding: '12px 14px', cursor: 'pointer', transition: 'border-color 0.15s' },
    cardName: { fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--accent)', fontWeight: 600 },
    cardMeta: { fontSize: 12, color: 'var(--text-muted)', marginTop: 4 },
    detail:   { marginTop: 12, padding: '12px 14px', background: 'var(--bg-input)', border: '1px solid var(--border)', borderRadius: 8 },
    th:       { textAlign: 'left' as const, padding: '4px 10px', color: 'var(--text-muted)', fontSize: 11, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.05em', borderBottom: '1px solid var(--border)' },
    td:       { padding: '5px 10px', borderBottom: '1px solid var(--border)', fontFamily: 'var(--font-mono)', fontSize: 12 },
    badge:    { display: 'inline-block', fontSize: 10, padding: '1px 5px', borderRadius: 3, marginLeft: 4, fontFamily: 'var(--font-ui)', fontWeight: 600 },
    pre:      { background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 6, padding: '8px 10px', fontFamily: 'var(--font-mono)', fontSize: 12, marginTop: 4, overflowX: 'auto' as const },
    section:  { marginTop: 12 },
    sectionH: { fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.05em', marginBottom: 6 },
  }

  if (loading) return <div style={{ padding: 20, color: 'var(--text-muted)' }}>Loading schema…</div>
  if (error)   return <div style={{ padding: 20, color: 'var(--error)' }}>{error}</div>

  return (
    <div style={s.root}>
      <input
        style={s.search}
        placeholder="Search tables…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      {filtered.length === 0 && (
        <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>No tables match.</div>
      )}

      <div style={s.grid}>
        {filtered.map((table) => {
          const isOpen = expandedTable === table.name
          return (
            <div key={table.name}>
              <div
                style={{ ...s.card, borderColor: isOpen ? 'var(--accent)' : 'var(--border)' }}
                onClick={() => setExpandedTable(isOpen ? null : table.name)}
              >
                <div style={s.cardName}>{table.name}</div>
                <div style={s.cardMeta}>
                  {table.columns.length} col{table.columns.length !== 1 ? 's' : ''} · {table.rowCount.toLocaleString()} row{table.rowCount !== 1 ? 's' : ''}
                </div>
              </div>

              {isOpen && (
                <div style={s.detail}>
                  {/* Columns */}
                  <div style={s.sectionH}>Columns</div>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr>
                          <th style={s.th}>Name</th>
                          <th style={s.th}>Type</th>
                          <th style={s.th}>Flags</th>
                        </tr>
                      </thead>
                      <tbody>
                        {table.columns.map((col) => (
                          <tr key={col.name}>
                            <td style={s.td}>{col.name}</td>
                            <td style={{ ...s.td, color: 'var(--text-muted)' }}>{col.type || 'TEXT'}</td>
                            <td style={s.td}>
                              {col.pk && <span style={{ ...s.badge, background: 'var(--accent-dim)', color: 'var(--accent)' }}>PK</span>}
                              {table.foreignKeys.some((fk) => fk.from === col.name) && (
                                <span style={{ ...s.badge, background: '#2d1f3f', color: '#b39ddb' }}>FK</span>
                              )}
                              {col.notNull && !col.pk && (
                                <span style={{ ...s.badge, background: 'var(--bg-hover)', color: 'var(--text-muted)' }}>NOT NULL</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Foreign keys */}
                  {table.foreignKeys.length > 0 && (
                    <div style={s.section}>
                      <div style={s.sectionH}>Foreign Keys</div>
                      {table.foreignKeys.map((fk, i) => (
                        <div key={i} style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginBottom: 3 }}>
                          <span style={{ color: 'var(--text)' }}>{fk.from}</span>
                          {' → '}
                          <span style={{ color: 'var(--accent)' }}>{fk.table}</span>
                          ({fk.to})
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Indexes */}
                  {table.indexes.length > 0 && (
                    <div style={s.section}>
                      <div style={s.sectionH}>Indexes</div>
                      {table.indexes.map((idx) => (
                        <div key={idx.name} style={{ fontSize: 12, fontFamily: 'var(--font-mono)', color: 'var(--text-muted)', marginBottom: 3 }}>
                          <span style={{ color: 'var(--text)' }}>{idx.name}</span>
                          {' ('}
                          <span style={{ color: 'var(--accent)' }}>{idx.columns.join(', ')}</span>
                          {')'}
                          {idx.unique && <span style={{ ...s.badge, background: 'var(--bg-hover)', color: 'var(--text-muted)' }}>UNIQUE</span>}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Example SELECT */}
                  <div style={s.section}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                      <div style={s.sectionH}>Example</div>
                      <button
                        onClick={() => copyText(`SELECT * FROM ${table.name} LIMIT 10;`, table.name)}
                        style={{ background: 'none', border: 'none', color: 'var(--accent)', fontSize: 11, cursor: 'pointer', padding: '2px 6px' }}
                      >
                        {copied === table.name ? 'Copied!' : 'Copy'}
                      </button>
                    </div>
                    <pre style={s.pre}>{`SELECT * FROM ${table.name} LIMIT 10;`}</pre>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
