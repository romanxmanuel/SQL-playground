'use client'

import { useEffect, useRef, useState } from 'react'

export type ViewId = 'query' | 'tables' | 'erd' | 'saved'

interface Props {
  activeView: ViewId
  onViewChange: (v: ViewId) => void
  schema: string
  onSchemaChange: (s: string) => void
  onUpload: (file: File) => Promise<void>
  onRestore: () => Promise<void>
  onClear: () => Promise<void>
}

const TABS: { id: ViewId; label: string; icon: string }[] = [
  { id: 'query',  label: 'Query',  icon: '⌨' },
  { id: 'tables', label: 'Tables', icon: '⊞' },
  { id: 'erd',    label: 'ERD',    icon: '◈' },
  { id: 'saved',  label: 'Saved',  icon: '★' },
]

export default function NavBar({ activeView, onViewChange, schema, onSchemaChange, onUpload, onRestore, onClear }: Props) {
  const [databases, setDatabases]   = useState<string[]>([])
  const [restoring, setRestoring]   = useState(false)
  const [restoreStatus, setRStatus] = useState<'idle'|'ok'|'err'>('idle')
  const [clearing, setClearing]     = useState(false)
  const [clearStatus, setCStatus]   = useState<'idle'|'ok'|'err'>('idle')
  const [uploading, setUploading]   = useState(false)
  const [uploadStatus, setUStatus]  = useState<'idle'|'ok'|'err'>('idle')
  const fileRef = useRef<HTMLInputElement>(null)

  // Fetch available databases
  useEffect(() => {
    fetch('/api/databases')
      .then((r) => r.json())
      .then((d) => setDatabases(d.databases ?? []))
      .catch(() => {/* ignore */})
  }, [])

  async function handleRestore() {
    if (!confirm('Load sample data? Resets customers/products/orders/order_items to defaults. Saved queries kept.')) return
    setRestoring(true); setRStatus('idle')
    try { await onRestore(); setRStatus('ok'); setTimeout(() => setRStatus('idle'), 2000) }
    catch { setRStatus('err'); setTimeout(() => setRStatus('idle'), 2000) }
    finally { setRestoring(false) }
  }

  async function handleClear() {
    if (!confirm('Drop all tables in playground? Saved queries are kept. Sample data can be restored after.')) return
    setClearing(true); setCStatus('idle')
    try { await onClear(); setCStatus('ok'); setTimeout(() => setCStatus('idle'), 2000) }
    catch { setCStatus('err'); setTimeout(() => setCStatus('idle'), 2000) }
    finally { setClearing(false) }
  }

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setUploading(true); setUStatus('idle')
    try {
      await onUpload(file)
      setUStatus('ok'); setTimeout(() => setUStatus('idle'), 2000)
    } catch {
      setUStatus('err'); setTimeout(() => setUStatus('idle'), 2000)
    } finally {
      setUploading(false)
    }
  }

  const uploadLabel = uploading ? 'Uploading…' : uploadStatus === 'ok' ? 'Loaded ✓' : uploadStatus === 'err' ? 'Failed ✗' : 'Upload SQL'
  const uploadColor = uploadStatus === 'ok' ? 'var(--success)' : uploadStatus === 'err' ? 'var(--error)' : 'var(--accent)'
  const restoreLabel = restoring ? 'Loading…' : restoreStatus === 'ok' ? 'Done ✓' : restoreStatus === 'err' ? 'Failed ✗' : 'Sample data'
  const clearLabel   = clearing ? 'Clearing…' : clearStatus === 'ok' ? 'Cleared ✓' : clearStatus === 'err' ? 'Failed ✗' : 'Clear DB'

  const actionBtn: React.CSSProperties = {
    background: 'none', border: '1px solid var(--border)', borderRadius: 6,
    fontSize: 12, padding: '5px 10px', cursor: 'pointer', whiteSpace: 'nowrap',
  }

  return (
    <>
      {/* Hidden file input */}
      <input
        ref={fileRef}
        type="file"
        accept=".sql"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {/* Desktop top bar */}
      <nav className="nav-top">
        <span className="nav-top-title">SQL Playground</span>

        {/* Schema selector */}
        <select
          value={schema}
          onChange={(e) => onSchemaChange(e.target.value)}
          style={{
            marginLeft: 10,
            background: 'var(--bg-input)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            color: 'var(--accent)',
            fontSize: 12,
            padding: '4px 8px',
            cursor: 'pointer',
            fontFamily: 'var(--font-mono)',
            maxWidth: 160,
          }}
        >
          {databases.includes(schema) ? null : <option value={schema}>{schema}</option>}
          {databases.map((db) => (
            <option key={db} value={db}>{db}</option>
          ))}
        </select>

        <div className="nav-top-tabs">
          {TABS.map((tab) => (
            <button key={tab.id} className={`nav-btn${activeView === tab.id ? ' active' : ''}`} onClick={() => onViewChange(tab.id)}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Upload SQL */}
        <button onClick={() => fileRef.current?.click()} disabled={uploading} style={{ ...actionBtn, color: uploadColor, borderColor: uploadStatus === 'idle' ? 'var(--accent-dim)' : 'var(--border)', marginLeft: 8 }}>
          {uploadLabel}
        </button>

        {/* Load sample data */}
        <button onClick={handleRestore} disabled={restoring} style={{ ...actionBtn, color: restoreStatus === 'ok' ? 'var(--success)' : restoreStatus === 'err' ? 'var(--error)' : 'var(--text-muted)', marginLeft: 4 }}>
          {restoreLabel}
        </button>

        {/* Clear playground */}
        <button onClick={handleClear} disabled={clearing} style={{ ...actionBtn, color: clearStatus === 'ok' ? 'var(--success)' : clearStatus === 'err' ? 'var(--error)' : 'var(--text-muted)', marginLeft: 4 }}>
          {clearLabel}
        </button>
      </nav>

      {/* Mobile bottom tab bar */}
      <nav className="nav-bottom" aria-label="Main navigation">
        <div className="nav-bottom-tabs">
          {TABS.map((tab) => (
            <button key={tab.id} className={`nav-tab${activeView === tab.id ? ' active' : ''}`} onClick={() => onViewChange(tab.id)} aria-label={tab.label}>
              <span className="nav-tab-icon" aria-hidden="true">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          ))}
          <button className="nav-tab" onClick={() => fileRef.current?.click()} disabled={uploading} aria-label="Upload SQL" style={{ color: uploadColor }}>
            <span className="nav-tab-icon" aria-hidden="true">↑</span>
            <span>{uploadStatus === 'ok' ? 'Done!' : uploadStatus === 'err' ? 'Err' : 'Upload'}</span>
          </button>
          <button className="nav-tab" onClick={handleRestore} disabled={restoring} aria-label="Load sample data" style={{ color: restoreStatus === 'ok' ? 'var(--success)' : restoreStatus === 'err' ? 'var(--error)' : 'var(--text-muted)' }}>
            <span className="nav-tab-icon" aria-hidden="true">↺</span>
            <span>{restoreStatus === 'ok' ? 'Done!' : restoreStatus === 'err' ? 'Fail' : 'Sample'}</span>
          </button>
        </div>
      </nav>
    </>
  )
}
