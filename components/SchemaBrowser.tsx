'use client'

import { useEffect, useState } from 'react'
import type { SchemaTable } from '@/app/api/schema/route'

interface Props {
  schema: string
}

export default function SchemaBrowser({ schema }: Props) {
  const [tables, setTables] = useState<SchemaTable[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  async function loadSchema() {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/schema?schema=${encodeURIComponent(schema)}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setTables(data.tables)
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadSchema() }, [schema])

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{
        padding: '10px 12px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexShrink: 0,
      }}>
        <span style={{ fontWeight: 600, fontSize: 12, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
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
            padding: '4px 8px',
            cursor: 'pointer',
          }}
        >
          ↺
        </button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '4px 0' }}>
        {loading && (
          <div style={{ padding: '10px 12px', color: 'var(--text-muted)', fontSize: 12 }}>Loading…</div>
        )}
        {error && (
          <div style={{ padding: '10px 12px', color: 'var(--error)', fontSize: 12 }}>{error}</div>
        )}
        {!loading && !error && tables.map((table) => {
          const fkColumns = new Set(table.foreignKeys?.map((fk) => fk.from) ?? [])
          return (
            <details key={table.name} style={{ marginBottom: 1 }}>
              <summary style={{
                padding: '8px 12px',
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
                <span style={{ color: 'var(--text-muted)', fontSize: 9 }}>▶</span>
                {table.name}
                <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: 10, fontFamily: 'var(--font-ui)' }}>
                  {table.columns.length} col{table.columns.length !== 1 ? 's' : ''}
                </span>
              </summary>
              <div style={{ paddingLeft: 20, paddingBottom: 4 }}>
                {table.columns.map((col) => {
                  const isPk = col.pk
                  const isFk = fkColumns.has(col.name)
                  const fkInfo = table.foreignKeys?.find((fk) => fk.from === col.name)
                  return (
                    <div
                      key={col.name}
                      style={{
                        padding: '2px 12px',
                        fontFamily: 'var(--font-mono)',
                        fontSize: 11,
                        display: 'flex',
                        gap: 6,
                        alignItems: 'center',
                      }}
                    >
                      {isPk && (
                        <span title="Primary key" style={{ color: 'var(--warning)', fontSize: 9 }}>PK</span>
                      )}
                      {isFk && (
                        <span title={fkInfo ? `→ ${fkInfo.table}.${fkInfo.to}` : 'Foreign key'} style={{ color: 'var(--accent-2)', fontSize: 9 }}>FK</span>
                      )}
                      {!isPk && !isFk && (
                        <span style={{ width: 18 }} />
                      )}
                      <span style={{ color: isFk ? 'var(--accent-2)' : isPk ? 'var(--warning)' : 'var(--text)' }}>
                        {col.name}
                      </span>
                      <span style={{ color: 'var(--text-muted)', marginLeft: 'auto' }}>{col.type}</span>
                    </div>
                  )
                })}
                {/* FK relationships */}
                {(table.foreignKeys?.length ?? 0) > 0 && (
                  <div style={{ padding: '4px 12px 2px', borderTop: '1px solid var(--border)', marginTop: 2 }}>
                    {table.foreignKeys!.map((fk, i) => (
                      <div key={i} style={{ fontSize: 10, color: 'var(--accent-2)', fontFamily: 'var(--font-mono)', padding: '1px 0' }}>
                        {fk.from} → {fk.table}.{fk.to}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </details>
          )
        })}
        {!loading && !error && tables.length === 0 && (
          <div style={{ padding: '10px 12px', color: 'var(--text-muted)', fontSize: 12 }}>
            No tables found in <code>{schema}</code>.
          </div>
        )}
      </div>
    </div>
  )
}
