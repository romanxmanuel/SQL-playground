'use client'

import { useCallback, useRef, useState, useEffect } from 'react'

interface Props {
  value: string
  onChange: (sql: string) => void
  onRun: () => void
  isLoading: boolean
}

const FONT_SIZE = 16
const LINE_HEIGHT_PX = Math.round(FONT_SIZE * 1.6) // 26px
const PAD_TOP = 8

export default function SqlEditor({ value, onChange, onRun, isLoading }: Props) {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const gutterRef   = useRef<HTMLDivElement>(null)
  const [focused, setFocused] = useState(false)

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
        e.preventDefault()
        onRun()
      }
    },
    [onRun]
  )

  const syncScroll = useCallback(() => {
    if (gutterRef.current && textareaRef.current) {
      gutterRef.current.scrollTop = textareaRef.current.scrollTop
    }
  }, [])

  // Sync scroll on mount and whenever value changes
  useEffect(() => { syncScroll() }, [value, syncScroll])

  const lineCount = Math.max(1, value.split('\n').length)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '12px 12px 8px' }}>
      <div style={{
        position: 'relative',
        border: `1px solid ${focused ? 'var(--accent)' : 'var(--border)'}`,
        borderRadius: 6,
        transition: 'border-color 0.15s',
        overflow: 'hidden',
      }}>
        {/* Gutter background */}
        <div style={{
          position: 'absolute', top: 0, left: 0, bottom: 0, width: 44,
          background: 'var(--bg-panel)',
          borderRight: '1px solid var(--border)',
          pointerEvents: 'none',
          zIndex: 1,
        }} />

        {/* Line numbers */}
        <div ref={gutterRef} style={{
          position: 'absolute', top: 0, left: 0, bottom: 0, width: 44,
          overflow: 'hidden',
          paddingTop: PAD_TOP,
          textAlign: 'right',
          fontFamily: 'var(--font-mono)',
          fontSize: FONT_SIZE,
          lineHeight: `${LINE_HEIGHT_PX}px`,
          color: 'var(--text-muted)',
          userSelect: 'none',
          pointerEvents: 'none',
          zIndex: 2,
        }}>
          {Array.from({ length: lineCount }, (_, i) => (
            <div key={i} style={{ paddingRight: 8, height: LINE_HEIGHT_PX }}>{i + 1}</div>
          ))}
        </div>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          onScroll={syncScroll}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          spellCheck={false}
          rows={8}
          style={{
            display: 'block',
            width: '100%',
            margin: 0,
            background: 'var(--bg-input)',
            color: 'var(--text)',
            border: 'none',
            padding: `${PAD_TOP}px 12px ${PAD_TOP}px 52px`,
            fontFamily: 'var(--font-mono)',
            fontSize: FONT_SIZE,
            lineHeight: `${LINE_HEIGHT_PX}px`,
            resize: 'vertical',
            outline: 'none',
            minHeight: 148,
          }}
        />
      </div>
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
          {typeof window !== 'undefined' && navigator.platform.includes('Mac') ? '⌘' : 'Ctrl'}+Enter
        </span>
      </div>
    </div>
  )
}
