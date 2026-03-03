'use client'

import { useState } from 'react'

export type ViewId = 'query' | 'tables' | 'erd' | 'saved'

interface Props {
  activeView: ViewId
  onViewChange: (v: ViewId) => void
  dbBackend?: string
  onRestore: () => Promise<void>
  onClear: () => Promise<void>
}

const TABS: { id: ViewId; label: string; icon: string }[] = [
  { id: 'query',  label: 'Query',  icon: '⌨' },
  { id: 'tables', label: 'Tables', icon: '⊞' },
  { id: 'erd',    label: 'ERD',    icon: '◈' },
  { id: 'saved',  label: 'Saved',  icon: '★' },
]

export default function NavBar({ activeView, onViewChange, dbBackend, onRestore, onClear }: Props) {
  const [restoring, setRestoring] = useState(false)
  const [status, setStatus] = useState<'idle' | 'ok' | 'err'>('idle')
  const [clearing, setClearing] = useState(false)
  const [clearStatus, setClearStatus] = useState<'idle' | 'ok' | 'err'>('idle')

  async function handleRestore() {
    if (!confirm('Load sample data? This will reset customers, products, orders, and order_items to the defaults. Your saved queries are kept.')) return
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

  async function handleClear() {
    if (!confirm('Drop all tables? This cannot be undone.\n\nSaved queries are kept. Sample data can be restored with "Restore data".')) return
    setClearing(true)
    setClearStatus('idle')
    try {
      await onClear()
      setClearStatus('ok')
      setTimeout(() => setClearStatus('idle'), 2000)
    } catch {
      setClearStatus('err')
      setTimeout(() => setClearStatus('idle'), 2000)
    } finally {
      setClearing(false)
    }
  }

  const restoreLabel = restoring ? 'Loading…' : status === 'ok' ? 'Loaded ✓' : status === 'err' ? 'Failed ✗' : 'Load sample data'
  const restoreColor = status === 'ok' ? 'var(--success)' : status === 'err' ? 'var(--error)' : 'var(--text-muted)'
  const clearLabel   = clearing ? 'Clearing…' : clearStatus === 'ok' ? 'Cleared ✓' : clearStatus === 'err' ? 'Failed ✗' : 'Clear DB'
  const clearColor   = clearStatus === 'ok' ? 'var(--success)' : clearStatus === 'err' ? 'var(--error)' : 'var(--text-muted)'

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
        <button
          onClick={handleClear}
          disabled={clearing}
          style={{
            marginLeft: 6,
            background: 'none',
            border: '1px solid var(--border)',
            borderRadius: 6,
            color: clearColor,
            fontSize: 12,
            padding: '5px 10px',
            cursor: clearing ? 'default' : 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          {clearLabel}
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
            aria-label="Load sample data"
            style={{ color: restoreColor }}
          >
            <span className="nav-tab-icon" aria-hidden="true">↺</span>
            <span>{status === 'ok' ? 'Done!' : status === 'err' ? 'Failed' : 'Sample'}</span>
          </button>
          <button
            className="nav-tab"
            onClick={handleClear}
            disabled={clearing}
            aria-label="Clear database"
            style={{ color: clearColor }}
          >
            <span className="nav-tab-icon" aria-hidden="true">⊘</span>
            <span>{clearStatus === 'ok' ? 'Done!' : clearStatus === 'err' ? 'Failed' : 'Clear'}</span>
          </button>
        </div>
      </nav>
    </>
  )
}
