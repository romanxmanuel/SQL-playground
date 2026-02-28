'use client'

import { useCallback } from 'react'

interface Props {
  value: string
  onChange: (sql: string) => void
  onRun: () => void
  isLoading: boolean
}

export default function SqlEditor({ value, onChange, onRun, isLoading }: Props) {
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        onRun()
      }
    },
    [onRun]
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 12px 8px' }}>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={handleKeyDown}
        spellCheck={false}
        rows={8}
        style={{
          width: '100%',
          background: 'var(--bg-input)',
          color: 'var(--text)',
          border: '1px solid var(--border)',
          borderRadius: 6,
          padding: '10px 12px',
          fontFamily: 'var(--font-mono)',
          fontSize: 16,  /* 16px min prevents iOS Safari zoom on focus */
          lineHeight: 1.6,
          resize: 'vertical',
          outline: 'none',
        }}
        onFocus={(e) => (e.currentTarget.style.borderColor = 'var(--accent)')}
        onBlur={(e) => (e.currentTarget.style.borderColor = 'var(--border)')}
      />
      <div className="sql-editor-toolbar" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <button
          className="btn-run"
          onClick={onRun}
          disabled={isLoading}
          style={{
            background: isLoading ? 'var(--bg-hover)' : 'var(--accent)',
            color: isLoading ? 'var(--text-muted)' : '#0d1117',
            border: 'none',
            borderRadius: 6,
            padding: '10px 18px',
            fontWeight: 600,
            fontSize: 13,
            transition: 'background 0.15s',
          }}
        >
          {isLoading ? 'Running…' : 'Run Query'}
        </button>
        <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>
          {typeof window !== 'undefined' && navigator.platform.includes('Mac')
            ? '⌘'
            : 'Ctrl'}+Enter
        </span>
      </div>
    </div>
  )
}
