'use client'

import { useState } from 'react'

export type ViewId = 'query' | 'tables' | 'erd' | 'saved'

interface Props {
  activeView: ViewId
  onViewChange: (v: ViewId) => void
  dbBackend?: string
  onRestore: () => Promise<void>
}

const TABS: { id: ViewId; label: string; icon: string }[] = [
  { id: 'query',  label: 'Query',  icon: '⌨' },
  { id: 'tables', label: 'Tables', icon: '⊞' },
  { id: 'erd',    label: 'ERD',    icon: '◈' },
  { id: 'saved',  label: 'Saved',  icon: '★' },
]

export default function NavBar({ activeView, onViewChange, dbBackend, onRestore }: Props) {
  const [restoring, setRestoring] = useState(false)
  const [status, setStatus] = useState<'idle' | 'ok' | 'err'>('idle')

  async function handleRestore() {
    if (!confirm('Restore sample data? This will reset customers, products, orders, and order_items. Your saved queries are kept.')) return
    setRestoring(true)
    setStatus('idle')
    try {
      await onRestore()
      setStatus('ok')
      setTimeout(() => setStatus('idle'), 2000)
    } catch {
      setStatus('err')
      setTimeout(() => setStatus('idle'), 2000)
    } finally {
      setRestoring(false)
    }
  }

  const restoreLabel = restoring ? 'Restoring…' : status === 'ok' ? 'Restored ✓' : status === 'err' ? 'Failed ✗' : 'Restore data'
  const restoreColor = status === 'ok' ? 'var(--success)' : status === 'err' ? 'var(--error)' : 'var(--text-muted)'

  return (
    <>
      {/* Desktop: top bar */}
      <nav className="nav-top">
        <span className="nav-top-title">SQL Playground</span>
        {dbBackend && (
          <span className="nav-top-badge">{dbBackend}</span>
        )}
        <div className="nav-top-tabs">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={`nav-btn${activeView === tab.id ? ' active' : ''}`}
              onClick={() => onViewChange(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <button
          onClick={handleRestore}
          disabled={restoring}
          style={{
            marginLeft: 8,
            background: 'none',
            border: '1px solid var(--border)',
            borderRadius: 6,
            color: restoreColor,
            fontSize: 12,
            padding: '5px 10px',
            cursor: restoring ? 'default' : 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {restoreLabel}
        </button>
      </nav>

      {/* Mobile: bottom tab bar */}
      <nav className="nav-bottom" aria-label="Main navigation">
        <div className="nav-bottom-tabs">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              className={`nav-tab${activeView === tab.id ? ' active' : ''}`}
              onClick={() => onViewChange(tab.id)}
              aria-label={tab.label}
            >
              <span className="nav-tab-icon" aria-hidden="true">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
          <button
            className="nav-tab"
            onClick={handleRestore}
            disabled={restoring}
            aria-label="Restore sample data"
            style={{ color: restoreColor }}
          >
            <span className="nav-tab-icon" aria-hidden="true">↺</span>
            <span>{status === 'ok' ? 'Done!' : status === 'err' ? 'Failed' : 'Restore'}</span>
          </button>
        </div>
      </nav>
    </>
  )
}
