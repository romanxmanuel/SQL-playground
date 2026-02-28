'use client'

import { useEffect, useState } from 'react'

interface SavedQuery {
  id: number
  title: string
  sql: string
  created_at: string
}

interface Props {
  currentSql: string
  onLoad: (sql: string) => void
}

export default function SavedQueries({ currentSql, onLoad }: Props) {
  const [queries, setQueries] = useState<SavedQuery[]>([])
  const [title, setTitle] = useState('')
  const [saving, setSaving] = useState(false)
  const [showSaveForm, setShowSaveForm] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function loadQueries() {
    try {
      const res = await fetch('/api/saved')
      const data = await res.json()
      if (res.ok) setQueries(data.queries)
    } catch {
      // silently ignore on load
    }
  }

  useEffect(() => { loadQueries() }, [])

  async function saveQuery() {
    if (!title.trim()) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/saved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim(), sql: currentSql }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setQueries((prev) => [data, ...prev])
      setTitle('')
      setShowSaveForm(false)
    } catch (err) {
      setError(String(err))
    } finally {
      setSaving(false)
    }
  }

  async function deleteQuery(id: number) {
    try {
      await fetch(`/api/saved/${id}`, { method: 'DELETE' })
      setQueries((prev) => prev.filter((q) => q.id !== id))
    } catch {
      // silently ignore
    }
  }

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
          Saved
        </span>
        <button
          onClick={() => setShowSaveForm((v) => !v)}
          title="Save current query"
          style={{
            background: showSaveForm ? 'var(--accent-dim)' : 'none',
            border: '1px solid var(--border)',
            borderRadius: 4,
            color: 'var(--accent)',
            fontSize: 12,
            padding: '8px 10px',
            minHeight: 36,
          }}
        >
          + Save
        </button>
      </div>

      {showSaveForm && (
        <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <input
            type="text"
            placeholder="Query title…"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && saveQuery()}
            autoFocus
            style={{
              background: 'var(--bg-input)',
              border: '1px solid var(--border)',
              borderRadius: 4,
              color: 'var(--text)',
              padding: '10px 8px',
              fontSize: 16,
              outline: 'none',
            }}
          />
          <button
            onClick={saveQuery}
            disabled={saving || !title.trim()}
            style={{
              background: 'var(--accent)',
              border: 'none',
              borderRadius: 4,
              color: '#0d1117',
              fontWeight: 600,
              padding: '10px 0',
              fontSize: 12,
              opacity: saving || !title.trim() ? 0.5 : 1,
            }}
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          {error && <span style={{ color: 'var(--error)', fontSize: 11 }}>{error}</span>}
        </div>
      )}

      <div style={{ flex: 1, overflow: 'auto' }}>
        {queries.length === 0 && (
          <div style={{ padding: '12px', color: 'var(--text-muted)', fontSize: 12 }}>
            No saved queries yet.
          </div>
        )}
        {queries.map((q) => (
          <div
            key={q.id}
            style={{
              padding: '8px 12px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'flex-start',
              gap: 8,
            }}
          >
            <button
              onClick={() => onLoad(q.sql)}
              style={{
                flex: 1,
                background: 'none',
                border: 'none',
                textAlign: 'left',
                color: 'var(--text)',
                fontSize: 13,
                padding: 0,
                cursor: 'pointer',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
              title={q.sql}
            >
              {q.title}
            </button>
            <button
              onClick={() => deleteQuery(q.id)}
              title="Delete"
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                fontSize: 16,
                padding: '8px',
                flexShrink: 0,
                minWidth: 36,
                minHeight: 44,
              }}
            >
              ×
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
