'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import type { SchemaTable } from '@/app/api/schema/route'

interface Props {
  schema: string
}

function generateErdSource(tables: SchemaTable[]): string {
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

  for (const table of domain) {
    for (const fk of table.foreignKeys) {
      lines.push(`  ${fk.table.toUpperCase()} ||--o{ ${table.name.toUpperCase()} : "${fk.from}"`)
    }
  }

  return lines.join('\n')
}

// Post-process the Mermaid SVG to highlight FK elements in pink
function applyFkColors(svgEl: SVGSVGElement) {
  // Relationship connecting lines
  svgEl.querySelectorAll<SVGElement>('.er.relationshipLine, [class*="relationship"]').forEach((el) => {
    el.setAttribute('style', 'stroke:#ff6b9d;stroke-width:2')
  })
  // Arrowhead markers
  svgEl.querySelectorAll<SVGElement>('marker path, marker circle').forEach((el) => {
    if ((el.parentElement as Element | null)?.id) {
      el.setAttribute('style', 'stroke:#ff6b9d;fill:#ff6b9d')
    }
  })
  // Relationship edge labels
  svgEl.querySelectorAll<SVGElement>('.er.label text').forEach((el) => {
    el.setAttribute('style', 'fill:#ff6b9d')
  })
  // Attribute rows that contain FK
  svgEl.querySelectorAll<SVGElement>('.er.attributeBoxEven, .er.attributeBoxOdd').forEach((box) => {
    if ((box.querySelector('text')?.textContent ?? '').includes('FK')) {
      const rect = box.querySelector('rect')
      if (rect) rect.setAttribute('style', 'fill:rgba(255,107,157,0.1);stroke:rgba(255,107,157,0.3)')
    }
  })
}

export default function ErdView({ schema }: Props) {
  const containerRef                = useRef<HTMLDivElement>(null)
  const dragging                    = useRef(false)
  const lastPos                     = useRef({ x: 0, y: 0 })
  const [loading, setLoading]       = useState(true)
  const [error, setError]           = useState<string | null>(null)
  const [mermaidSrc, setMermaidSrc] = useState('')
  const [svgOutput, setSvgOutput]   = useState('')
  const [copied, setCopied]         = useState(false)
  const [zoom, setZoom]             = useState(1)
  const [pan, setPan]               = useState({ x: 0, y: 0 })

  // Fetch schema when prop changes
  useEffect(() => {
    setLoading(true)
    setError(null)
    setSvgOutput('')
    setMermaidSrc('')
    setZoom(1)
    setPan({ x: 0, y: 0 })

    fetch(`/api/schema?schema=${encodeURIComponent(schema)}`)
      .then((r) => r.json())
      .then((d) => {
        setMermaidSrc(generateErdSource((d.tables ?? []) as SchemaTable[]))
      })
      .catch((e) => { setError(String(e)); setLoading(false) })
  }, [schema])

  // Render Mermaid SVG
  useEffect(() => {
    if (!mermaidSrc) return
    let cancelled = false

    async function render() {
      try {
        const mermaid = (await import('mermaid')).default
        mermaid.initialize({ startOnLoad: false, theme: 'dark', securityLevel: 'loose' })
        const { svg } = await mermaid.render(`erd-${Date.now()}`, mermaidSrc)
        if (!cancelled) { setSvgOutput(svg); setLoading(false) }
      } catch (e) {
        if (!cancelled) { setError(String(e)); setLoading(false) }
      }
    }
    render()
    return () => { cancelled = true }
  }, [mermaidSrc])

  // Apply FK colors after SVG renders into DOM
  useEffect(() => {
    if (!svgOutput || !containerRef.current) return
    const svgEl = containerRef.current.querySelector<SVGSVGElement>('svg')
    if (svgEl) applyFkColors(svgEl)
  }, [svgOutput])

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    setZoom((z) => Math.min(4, Math.max(0.15, z * (e.deltaY > 0 ? 0.9 : 1.1))))
  }, [])

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    dragging.current = true
    lastPos.current = { x: e.clientX, y: e.clientY }
  }, [])

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging.current) return
    setPan((p) => ({ x: p.x + e.clientX - lastPos.current.x, y: p.y + e.clientY - lastPos.current.y }))
    lastPos.current = { x: e.clientX, y: e.clientY }
  }, [])

  const stopDrag = useCallback(() => { dragging.current = false }, [])

  const btn: React.CSSProperties = {
    background: 'none', border: '1px solid var(--border)', borderRadius: 5,
    color: 'var(--text-muted)', fontSize: 12, padding: '4px 10px', cursor: 'pointer',
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 16px', borderBottom: '1px solid var(--border)', background: 'var(--bg-panel)', flexShrink: 0 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
          ERD — {schema}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 8, fontSize: 11, color: 'var(--accent-2)' }}>
          <span style={{ width: 14, height: 2, background: 'var(--accent-2)', display: 'inline-block', borderRadius: 1 }} />
          FK
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 5 }}>
          <button style={btn} onClick={() => setZoom((z) => Math.min(4, z * 1.2))}>+</button>
          <button style={btn} onClick={() => setZoom((z) => Math.max(0.15, z * 0.8))}>−</button>
          <button style={btn} onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }) }}>Reset</button>
          <button style={{ ...btn, color: copied ? 'var(--success)' : 'var(--text-muted)' }} disabled={!mermaidSrc}
            onClick={() => navigator.clipboard.writeText(mermaidSrc).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500) })}>
            {copied ? 'Copied!' : 'Copy src'}
          </button>
          <button style={btn} disabled={!svgOutput}
            onClick={() => { const b = new Blob([svgOutput], { type: 'image/svg+xml' }); const u = URL.createObjectURL(b); const a = document.createElement('a'); a.href = u; a.download = `${schema}-erd.svg`; a.click(); URL.revokeObjectURL(u) }}>
            SVG ↓
          </button>
        </div>
      </div>

      {/* Canvas */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative', cursor: 'grab' }}
        onWheel={onWheel} onMouseDown={onMouseDown} onMouseMove={onMouseMove}
        onMouseUp={stopDrag} onMouseLeave={stopDrag}>

        {loading && !error && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
            Rendering diagram…
          </div>
        )}

        {error && (
          <div style={{ position: 'absolute', inset: 0, padding: 24, overflow: 'auto' }}>
            <div style={{ color: 'var(--error)', marginBottom: 12 }}>Failed to render ERD: {error}</div>
            {mermaidSrc && (
              <pre style={{ background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 6, padding: 12, fontSize: 12, fontFamily: 'var(--font-mono)', overflowX: 'auto', color: 'var(--text)', maxWidth: 600 }}>
                {mermaidSrc}
              </pre>
            )}
          </div>
        )}

        {svgOutput && !error && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div
              ref={containerRef}
              dangerouslySetInnerHTML={{ __html: svgOutput }}
              style={{ transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})`, transformOrigin: 'center center', userSelect: 'none', pointerEvents: 'none' }}
            />
          </div>
        )}

        {svgOutput && !error && (
          <div style={{ position: 'absolute', bottom: 12, right: 16, fontSize: 11, color: 'var(--text-muted)', background: 'var(--bg-panel)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 8px', pointerEvents: 'none' }}>
            {Math.round(zoom * 100)}%
          </div>
        )}
      </div>
    </div>
  )
}
