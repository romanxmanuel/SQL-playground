'use client'

import { useEffect, useRef, useState } from 'react'
import type { SchemaTable } from '@/app/api/schema/route'

function generateErdSource(tables: SchemaTable[]): string {
  // Exclude internal tables from the domain diagram
  const domain = tables.filter((t) => t.name !== 'saved_queries')
  const lines: string[] = ['erDiagram']

  for (const table of domain) {
    const fkColumns = new Set(table.foreignKeys.map((fk) => fk.from))
    lines.push(`  ${table.name.toUpperCase()} {`)
    for (const col of table.columns) {
      const baseType = col.type.replace(/\(.*?\)/g, '').trim() || 'TEXT'
      const attrs: string[] = []
      if (col.pk) attrs.push('PK')
      if (fkColumns.has(col.name)) attrs.push('FK')
      const attrStr = attrs.length > 0 ? ` ${attrs.join(', ')}` : ''
      lines.push(`    ${baseType} ${col.name}${attrStr}`)
    }
    lines.push(`  }`)
  }

  // Relationship lines: referenced-table ||--o{ this-table : "fk_column"
  for (const table of domain) {
    for (const fk of table.foreignKeys) {
      lines.push(`  ${fk.table.toUpperCase()} ||--o{ ${table.name.toUpperCase()} : "${fk.from}"`)
    }
  }

  return lines.join('\n')
}

export default function ErdView() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [mermaidSrc, setMermaidSrc] = useState('')
  const [svgOutput, setSvgOutput] = useState('')
  const [copied, setCopied] = useState(false)

  // Step 1: fetch schema
  useEffect(() => {
    fetch('/api/schema')
      .then((r) => r.json())
      .then((d) => {
        const tables: SchemaTable[] = d.tables ?? []
        setMermaidSrc(generateErdSource(tables))
      })
      .catch((e) => {
        setError(String(e))
        setLoading(false)
      })
  }, [])

  // Step 2: render Mermaid when source is ready
  useEffect(() => {
    if (!mermaidSrc) return
    let cancelled = false

    async function render() {
      try {
        const mermaid = (await import('mermaid')).default
        mermaid.initialize({ startOnLoad: false, theme: 'dark', securityLevel: 'loose' })
        const { svg } = await mermaid.render('mermaid-erd', mermaidSrc)
        if (!cancelled) {
          setSvgOutput(svg)
          setLoading(false)
        }
      } catch (e) {
        if (!cancelled) {
          setError(String(e))
          setLoading(false)
        }
      }
    }

    render()
    return () => { cancelled = true }
  }, [mermaidSrc])

  function copySrc() {
    navigator.clipboard.writeText(mermaidSrc).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  function downloadSvg() {
    const blob = new Blob([svgOutput], { type: 'image/svg+xml' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'erd.svg'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Toolbar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px 16px',
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg-panel)',
        flexShrink: 0,
      }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          Entity Relationship Diagram
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
          <button
            onClick={copySrc}
            disabled={!mermaidSrc}
            style={{
              background: 'none',
              border: '1px solid var(--border)',
              borderRadius: 5,
              color: copied ? 'var(--success)' : 'var(--text-muted)',
              fontSize: 12,
              padding: '5px 10px',
              cursor: 'pointer',
            }}
          >
            {copied ? 'Copied!' : 'Copy source'}
          </button>
          <button
            onClick={downloadSvg}
            disabled={!svgOutput}
            style={{
              background: 'none',
              border: '1px solid var(--border)',
              borderRadius: 5,
              color: 'var(--text-muted)',
              fontSize: 12,
              padding: '5px 10px',
              cursor: 'pointer',
            }}
          >
            Download SVG
          </button>
        </div>
      </div>

      {/* Diagram area */}
      <div style={{ flex: 1, overflow: 'auto', padding: 24, display: 'flex', alignItems: 'flex-start', justifyContent: 'center' }}>
        {loading && !error && (
          <div style={{ color: 'var(--text-muted)', paddingTop: 40 }}>Rendering diagram…</div>
        )}
        {error && (
          <div style={{ maxWidth: 600, width: '100%' }}>
            <div style={{ color: 'var(--error)', marginBottom: 12 }}>Failed to render ERD: {error}</div>
            {mermaidSrc && (
              <pre style={{
                background: 'var(--bg-panel)',
                border: '1px solid var(--border)',
                borderRadius: 6,
                padding: 12,
                fontSize: 12,
                fontFamily: 'var(--font-mono)',
                overflowX: 'auto',
                color: 'var(--text)',
              }}>
                {mermaidSrc}
              </pre>
            )}
          </div>
        )}
        {svgOutput && !error && (
          <div
            ref={containerRef}
            dangerouslySetInnerHTML={{ __html: svgOutput }}
            style={{ maxWidth: '100%' }}
          />
        )}
      </div>
    </div>
  )
}
