'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import type { SchemaTable } from '@/app/api/schema/route'

// ─── Layout constants ─────────────────────────────────────────────
const TW      = 234   // table card width
const RH      = 26    // row height per column
const HH      = 40    // header height
const COL_GAP = 110   // horizontal gap between table columns
const ROW_GAP = 90    // vertical gap between table rows
const CF_LEN  = 14    // crow's foot prong length
const CF_SPREAD = 8   // crow's foot prong spread (half)
const BAR_H   = 10    // single bar half-height

// ─── FK color palette ─────────────────────────────────────────────
const PALETTE = [
  '#38bdf8', // cyan
  '#a78bfa', // violet
  '#fb923c', // orange
  '#4ade80', // green
  '#f472b6', // pink
  '#facc15', // yellow
  '#34d399', // emerald
  '#f87171', // red
  '#60a5fa', // blue
  '#e879f9', // fuchsia
]

interface FkDef {
  fromTable: string
  fromCol:  string
  toTable:  string
  toCol:    string
  color:    string
  idx:      number
}

interface TPos {
  id: string
  x:  number
  y:  number
  w:  number
  h:  number
  table: SchemaTable
}

function computeLayout(tables: SchemaTable[]): TPos[] {
  if (!tables.length) return []
  const nc = Math.max(2, Math.ceil(Math.sqrt(tables.length * 1.3)))
  const rows: SchemaTable[][] = []
  for (let i = 0; i < tables.length; i += nc) rows.push(tables.slice(i, i + nc))
  const rowH = rows.map(r => Math.max(...r.map(t => HH + t.columns.length * RH + 12)))
  const rowY: number[] = [50]
  for (let i = 1; i < rows.length; i++) rowY.push(rowY[i - 1] + rowH[i - 1] + ROW_GAP)

  return tables.map((t, i) => ({
    id:    t.name,
    x:     (i % nc) * (TW + COL_GAP) + 50,
    y:     rowY[Math.floor(i / nc)],
    w:     TW,
    h:     HH + t.columns.length * RH + 12,
    table: t,
  }))
}

function buildFks(domain: SchemaTable[]): FkDef[] {
  const out: FkDef[] = []
  for (const t of domain) {
    for (const fk of t.foreignKeys) {
      out.push({
        fromTable: t.name,
        fromCol:   fk.from,
        toTable:   fk.table,
        toCol:     fk.to,
        color:     PALETTE[out.length % PALETTE.length],
        idx:       out.length,
      })
    }
  }
  return out
}

export default function ErdView({ schema }: { schema: string }) {
  const [tables, setTables]   = useState<SchemaTable[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)
  const [zoom, setZoom]       = useState(1)
  const [pan, setPan]         = useState({ x: 0, y: 0 })
  const [hovered, setHovered] = useState<number | null>(null)

  const dragging  = useRef(false)
  const lastPos   = useRef({ x: 0, y: 0 })
  const outerRef  = useRef<HTMLDivElement>(null)
  const dimsRef   = useRef({ w: 800, h: 600 })

  useEffect(() => {
    setLoading(true); setError(null); setZoom(1); setPan({ x: 0, y: 0 })
    fetch(`/api/schema?schema=${encodeURIComponent(schema)}`)
      .then(r => r.json())
      .then(d => { setTables((d.tables ?? []) as SchemaTable[]); setLoading(false) })
      .catch(e => { setError(String(e)); setLoading(false) })
  }, [schema])

  const domain = tables.filter(t => t.name !== 'saved_queries')
  const pos    = computeLayout(domain)
  const posMap = new Map(pos.map(p => [p.id, p]))
  const fks    = buildFks(domain)
  const fkMap  = new Map(fks.map(f => [`${f.fromTable}.${f.fromCol}`, f]))

  const svgW = Math.max(800, pos.reduce((m, p) => Math.max(m, p.x + p.w + 60), 0))
  const svgH = Math.max(500, pos.reduce((m, p) => Math.max(m, p.y + p.h + 60), 0))
  dimsRef.current = { w: svgW, h: svgH }

  const fitToScreen = useCallback(() => {
    if (!outerRef.current) return
    const { clientWidth: ow, clientHeight: oh } = outerRef.current
    const { w, h } = dimsRef.current
    const scale = Math.min(0.95, Math.min(ow / w, oh / h))
    setZoom(scale)
    setPan({ x: (ow - w * scale) / 2, y: (oh - h * scale) / 2 })
  }, [])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!loading && !error) requestAnimationFrame(fitToScreen)
  }, [loading, error])

  const onWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    setZoom(z => Math.min(5, Math.max(0.1, z * (e.deltaY > 0 ? 0.9 : 1.1))))
  }, [])
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    dragging.current = true; lastPos.current = { x: e.clientX, y: e.clientY }
  }, [])
  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging.current) return
    setPan(p => ({ x: p.x + e.clientX - lastPos.current.x, y: p.y + e.clientY - lastPos.current.y }))
    lastPos.current = { x: e.clientX, y: e.clientY }
  }, [])
  const stopDrag = useCallback(() => { dragging.current = false }, [])

  const btnStyle: React.CSSProperties = {
    background: 'none', border: '1px solid var(--border)', borderRadius: 5,
    color: 'var(--text-muted)', fontSize: 12, padding: '4px 10px', cursor: 'pointer',
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* ── Toolbar ───────────────────────────────────────── */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px',
        borderBottom: '1px solid var(--border)', background: 'var(--bg-panel)',
        flexShrink: 0, flexWrap: 'wrap', minHeight: 44,
      }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', whiteSpace: 'nowrap' }}>
          ERD — {schema}
        </span>

        {fks.map((f, i) => (
          <span key={i}
            onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11,
              padding: '2px 8px 2px 6px', borderRadius: 20,
              border: `1px solid ${f.color}55`, background: `${f.color}14`,
              cursor: 'default', whiteSpace: 'nowrap',
              opacity: hovered == null || hovered === i ? 1 : 0.35,
              transition: 'opacity 0.15s', fontFamily: 'var(--font-mono)',
            }}>
            <span style={{ width: 18, height: 2, background: f.color, borderRadius: 1, flexShrink: 0 }} />
            <span style={{ color: f.color }}>{f.fromTable}</span>
            <span style={{ color: 'var(--text-muted)', opacity: 0.6 }}>·{f.fromCol}</span>
            <span style={{ color: 'var(--text-muted)' }}>→</span>
            <span style={{ color: f.color }}>{f.toTable}</span>
            <span style={{ color: 'var(--text-muted)', opacity: 0.6 }}>·{f.toCol}</span>
          </span>
        ))}

        <div style={{ marginLeft: 'auto', display: 'flex', gap: 5, flexShrink: 0 }}>
          <button style={btnStyle} onClick={() => setZoom(z => Math.min(5, z * 1.2))}>+</button>
          <button style={btnStyle} onClick={() => setZoom(z => Math.max(0.1, z * 0.8))}>−</button>
          <button style={btnStyle} onClick={fitToScreen}>Fit</button>
          <button style={btnStyle} onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }) }}>1:1</button>
        </div>
      </div>

      {/* ── Canvas ────────────────────────────────────────── */}
      <div
        ref={outerRef}
        style={{
          flex: 1, overflow: 'hidden', position: 'relative',
          background: 'var(--bg-base)',
          cursor: dragging.current ? 'grabbing' : 'grab',
        }}
        onWheel={onWheel} onMouseDown={onMouseDown} onMouseMove={onMouseMove}
        onMouseUp={stopDrag} onMouseLeave={stopDrag}
      >
        {loading && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
            Loading schema…
          </div>
        )}
        {error && (
          <div style={{ position: 'absolute', inset: 0, padding: 24, color: 'var(--error)' }}>
            Failed to load schema: {error}
          </div>
        )}

        {!loading && !error && (
          <svg
            width={svgW} height={svgH}
            style={{ display: 'block', transform: `translate(${pan.x}px,${pan.y}px) scale(${zoom})`, transformOrigin: '0 0', userSelect: 'none' }}
          >
            <defs>
              {/* Clip paths per table card */}
              {pos.map(p => (
                <clipPath key={p.id} id={`clip-${p.id}`}>
                  <rect x={p.x} y={p.y} width={p.w} height={p.h} rx={8} ry={8} />
                </clipPath>
              ))}
            </defs>

            {/* ── FK connection lines (behind tables) ── */}
            {fks.map((fk, i) => {
              const fp = posMap.get(fk.fromTable)
              const tp = posMap.get(fk.toTable)
              if (!fp || !tp || fp === tp) return null

              const colIdx = fp.table.columns.findIndex(c => c.name === fk.fromCol)
              const fy = fp.y + HH + Math.max(0, colIdx) * RH + RH / 2

              // Route left or right based on relative centers
              const goRight = tp.x + tp.w / 2 >= fp.x + fp.w / 2
              const dir = goRight ? 1 : -1

              // Crow's foot at source end (FK/many): prongs extend outward from table edge
              const fxEdge = goRight ? fp.x + fp.w : fp.x          // table edge
              const fxLine = fxEdge + CF_LEN * dir                  // bezier start (past crow's foot)

              // Single bar at target end (PK/one): bezier ends here
              const txEdge = goRight ? tp.x : tp.x + tp.w           // table edge

              const dx  = Math.abs(txEdge - fxLine)
              const cp  = Math.max(55, dx * 0.55)
              const cx1 = goRight ? fxLine + cp : fxLine - cp
              const cx2 = goRight ? txEdge - cp : txEdge + cp
              const ty  = tp.y + HH / 2

              const d = `M ${fxLine} ${fy} C ${cx1} ${fy} ${cx2} ${ty} ${txEdge} ${ty}`

              const isHov = hovered === i
              const dim   = hovered != null && !isHov
              const alpha = dim ? 0.15 : 1
              const sw    = isHov ? 2.5 : 1.8

              return (
                <g key={i} style={{ cursor: 'crosshair' }}
                  onMouseEnter={() => setHovered(i)}
                  onMouseLeave={() => setHovered(null)}>
                  {/* Wide invisible hit area */}
                  <path d={d} fill="none" stroke="transparent" strokeWidth={18} />

                  {/* Glow halo */}
                  <path d={d} fill="none" stroke={fk.color}
                    strokeWidth={isHov ? 18 : 8}
                    strokeOpacity={isHov ? 0.22 : 0.07}
                    style={{ transition: 'stroke-width 0.15s, stroke-opacity 0.15s' }} />

                  {/* Main line */}
                  <path d={d} fill="none" stroke={fk.color}
                    strokeWidth={sw} strokeOpacity={alpha}
                    style={{ transition: 'stroke-opacity 0.15s, stroke-width 0.15s' }} />

                  {/* ── Crow's foot (many/FK end) ── */}
                  {/* Center prong */}
                  <line x1={fxEdge} y1={fy} x2={fxLine} y2={fy}
                    stroke={fk.color} strokeWidth={sw} strokeOpacity={alpha}
                    style={{ transition: 'stroke-opacity 0.15s' }} />
                  {/* Top prong */}
                  <line x1={fxEdge} y1={fy} x2={fxLine} y2={fy - CF_SPREAD}
                    stroke={fk.color} strokeWidth={sw} strokeOpacity={alpha}
                    style={{ transition: 'stroke-opacity 0.15s' }} />
                  {/* Bottom prong */}
                  <line x1={fxEdge} y1={fy} x2={fxLine} y2={fy + CF_SPREAD}
                    stroke={fk.color} strokeWidth={sw} strokeOpacity={alpha}
                    style={{ transition: 'stroke-opacity 0.15s' }} />

                  {/* ── Single bar (one/PK end) ── */}
                  <line x1={txEdge} y1={ty - BAR_H} x2={txEdge} y2={ty + BAR_H}
                    stroke={fk.color} strokeWidth={isHov ? 2.5 : 2} strokeOpacity={alpha}
                    style={{ transition: 'stroke-opacity 0.15s' }} />
                </g>
              )
            })}

            {/* ── Table cards ── */}
            {pos.map(p => {
              const isSrc    = hovered != null && fks[hovered]?.fromTable === p.id
              const isDst    = hovered != null && fks[hovered]?.toTable   === p.id
              const lit      = isSrc || isDst
              const litColor = lit ? fks[hovered!].color : ''

              return (
                <g key={p.id}>
                  {/* Glow ring when this table is part of hovered FK */}
                  {lit && (
                    <rect x={p.x - 5} y={p.y - 5} width={p.w + 10} height={p.h + 10}
                      rx={12} ry={12} fill="none"
                      stroke={litColor} strokeWidth={2} strokeOpacity={0.55} />
                  )}

                  {/* Card background (clipped to rounded rect) */}
                  <g clipPath={`url(#clip-${p.id})`}>
                    {/* Body fill */}
                    <rect x={p.x} y={p.y} width={p.w} height={p.h} fill="var(--bg-panel)" />

                    {/* Header */}
                    <rect x={p.x} y={p.y} width={p.w} height={HH} fill="#1a2340" />

                    {/* Column rows */}
                    {p.table.columns.map((col, j) => {
                      const ry = p.y + HH + j * RH
                      const cy = ry + RH / 2
                      const fk = fkMap.get(`${p.id}.${col.name}`)
                      const typeStr = col.type.replace(/\(.*?\)/g, '').split(/\s+/)[0].toLowerCase()

                      return (
                        <g key={col.name}
                          onMouseEnter={() => fk && setHovered(fk.idx)}
                          onMouseLeave={() => fk && setHovered(null)}
                          style={{ cursor: fk ? 'crosshair' : 'default' }}>

                          {/* Row tint */}
                          <rect x={p.x} y={ry} width={p.w} height={RH}
                            fill={j % 2 === 0 ? 'rgba(255,255,255,0.018)' : 'transparent'} />

                          {/* FK left accent bar */}
                          {fk && (
                            <rect x={p.x} y={ry} width={3} height={RH}
                              fill={fk.color}
                              opacity={hovered == null || hovered === fk.idx ? 1 : 0.2}
                              style={{ transition: 'opacity 0.15s' }} />
                          )}

                          {/* PK badge */}
                          {col.pk && (
                            <text x={p.x + 10} y={cy} dominantBaseline="central"
                              fill="#f59e0b" fontSize={9} fontWeight="800" fontFamily="var(--font-mono)">
                              PK
                            </text>
                          )}

                          {/* Type */}
                          <text x={p.x + (col.pk ? 30 : 11)} y={cy} dominantBaseline="central"
                            fill="var(--text-muted)" fontSize={10} fontFamily="var(--font-mono)" opacity={0.6}>
                            {typeStr.length > 9 ? typeStr.slice(0, 8) + '…' : typeStr}
                          </text>

                          {/* Column name */}
                          <text x={p.x + 90} y={cy} dominantBaseline="central"
                            fill={fk ? fk.color : col.pk ? 'var(--accent)' : 'var(--text)'}
                            fontSize={12} fontWeight={fk || col.pk ? '600' : '400'}
                            fontFamily="var(--font-mono)"
                            opacity={fk && hovered != null && hovered !== fk.idx ? 0.25 : 1}
                            style={{ transition: 'opacity 0.15s' }}>
                            {col.name.length > 13 ? col.name.slice(0, 12) + '…' : col.name}
                          </text>

                          {/* FK badge pill: shows → refTable */}
                          {fk && (
                            <>
                              <rect x={p.x + p.w - 68} y={ry + 4} width={62} height={RH - 8}
                                rx={3} fill={`${fk.color}18`}
                                stroke={fk.color} strokeWidth={hovered === fk.idx ? 1.5 : 0.7}
                                strokeOpacity={hovered == null || hovered === fk.idx ? 1 : 0.2}
                                style={{ transition: 'stroke-width 0.1s' }} />
                              <text x={p.x + p.w - 37} y={cy} textAnchor="middle" dominantBaseline="central"
                                fill={fk.color} fontSize={9} fontWeight="700" fontFamily="var(--font-mono)"
                                opacity={hovered == null || hovered === fk.idx ? 1 : 0.2}
                                style={{ transition: 'opacity 0.15s' }}>
                                →{fk.toTable.length > 6 ? fk.toTable.slice(0, 5) + '…' : fk.toTable}
                              </text>
                            </>
                          )}

                          {/* Row divider */}
                          {j < p.table.columns.length - 1 && (
                            <line x1={p.x + 6} y1={ry + RH} x2={p.x + p.w - 6} y2={ry + RH}
                              stroke="var(--border)" strokeWidth={0.5} strokeOpacity={0.4} />
                          )}
                        </g>
                      )
                    })}
                  </g>

                  {/* Header text (above clip so it's always visible) */}
                  <text x={p.x + 12} y={p.y + HH / 2} dominantBaseline="central"
                    fill={lit ? litColor : 'var(--accent)'}
                    fontSize={13} fontWeight="700" fontFamily="var(--font-mono)"
                    style={{ transition: 'fill 0.15s' }}>
                    {p.table.name}
                  </text>

                  {/* Row count */}
                  {p.table.rowCount > 0 && (
                    <text x={p.x + p.w - 10} y={p.y + HH / 2} textAnchor="end" dominantBaseline="central"
                      fill="var(--text-muted)" fontSize={10} opacity={0.5}>
                      {p.table.rowCount}r
                    </text>
                  )}

                  {/* Header / body separator */}
                  <line x1={p.x} y1={p.y + HH} x2={p.x + p.w} y2={p.y + HH}
                    stroke="var(--border)" strokeWidth={1} />

                  {/* Outer border */}
                  <rect x={p.x} y={p.y} width={p.w} height={p.h}
                    rx={8} ry={8} fill="none"
                    stroke={lit ? litColor : 'var(--border)'}
                    strokeWidth={lit ? 1.5 : 1}
                    strokeOpacity={lit ? 0.7 : 1}
                    style={{ transition: 'stroke 0.15s' }} />
                </g>
              )
            })}

            {/* Empty state */}
            {domain.length === 0 && (
              <text x={svgW / 2} y={svgH / 2} textAnchor="middle" dominantBaseline="central"
                fill="var(--text-muted)" fontSize={14}>
                No tables in schema &quot;{schema}&quot;
              </text>
            )}
          </svg>
        )}

        {/* Zoom indicator */}
        {!loading && !error && (
          <div style={{
            position: 'absolute', bottom: 12, right: 16, fontSize: 11,
            color: 'var(--text-muted)', background: 'var(--bg-panel)',
            border: '1px solid var(--border)', borderRadius: 4, padding: '2px 8px',
            pointerEvents: 'none',
          }}>
            {Math.round(zoom * 100)}%
          </div>
        )}
      </div>
    </div>
  )
}
