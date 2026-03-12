'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import type { SchemaTable } from '@/app/api/schema/route'

// ─── Layout constants ─────────────────────────────────────────────
const TW      = 234   // table card width
const RH      = 26    // row height per column
const HH      = 40    // header height
const COL_GAP = 120   // horizontal gap between tier columns
const ROW_GAP = 60    // vertical gap within a column
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

// ─── Hierarchical DAG layout ──────────────────────────────────────
// Parent tables (only referenced, never reference others) go left (tier 0).
// Child tables (have FK columns) go right based on depth.
function computeLayout(tables: SchemaTable[]): TPos[] {
  if (!tables.length) return []

  // Build parent/child sets from FK definitions in table data
  const childOf  = new Map<string, Set<string>>() // table → set of tables it references
  const parentOf = new Map<string, Set<string>>() // table → set of tables that reference it
  for (const t of tables) {
    childOf.set(t.name, new Set())
    parentOf.set(t.name, new Set())
  }
  for (const t of tables) {
    for (const fk of t.foreignKeys) {
      childOf.get(t.name)?.add(fk.table)
      if (parentOf.has(fk.table)) parentOf.get(fk.table)!.add(t.name)
    }
  }

  // Assign tiers via BFS — start from root tables (those that reference nothing)
  const tier = new Map<string, number>()
  const roots = tables.map(t => t.name).filter(n => childOf.get(n)!.size === 0)
  const queue = [...roots]
  for (const r of roots) tier.set(r, 0)

  while (queue.length) {
    const cur = queue.shift()!
    const curTier = tier.get(cur) ?? 0
    for (const child of parentOf.get(cur) ?? []) {
      const newTier = curTier + 1
      if (!tier.has(child) || tier.get(child)! < newTier) {
        tier.set(child, newTier)
        queue.push(child)
      }
    }
  }

  // Tables not reached (no FKs at all) get tier 0
  for (const t of tables) {
    if (!tier.has(t.name)) tier.set(t.name, 0)
  }

  // Group by tier
  const tiers = new Map<number, string[]>()
  for (const [name, t] of tier) {
    if (!tiers.has(t)) tiers.set(t, [])
    tiers.get(t)!.push(name)
  }

  const tableMap = new Map(tables.map(t => [t.name, t]))
  const maxTier  = Math.max(...tier.values(), 0)
  const result: TPos[] = []

  for (let col = 0; col <= maxTier; col++) {
    const names = tiers.get(col) ?? []
    let y = 50
    for (const name of names) {
      const t = tableMap.get(name)!
      const h = HH + t.columns.length * RH + 12
      result.push({ id: name, x: 50 + col * (TW + COL_GAP), y, w: TW, h, table: t })
      y += h + ROW_GAP
    }
  }

  return result
}

function guessVerb(fk: FkDef): string {
  const col = fk.fromCol.toLowerCase()
  const to  = fk.toTable.toLowerCase()
  if (col.includes('owner'))                              return 'owns'
  if (col.includes('vendor') || col.includes('supplier')) return 'supplied by'
  if (to.includes('tech')   || col.includes('tech'))      return 'assigned to'
  if (to.includes('mode')   || to.includes('type') || to.includes('status')) return 'categorized by'
  if (to.includes('customer') || to.includes('client'))   return 'placed by'
  if (col.includes('manager') || col.includes('supervisor')) return 'managed by'
  if (to.includes('repair') || col.includes('repair'))    return 'has'
  if (to.includes('order')  || col.includes('order'))     return 'contains'
  return 'has'
}

function buildFks(domain: SchemaTable[]): FkDef[] {
  const out: FkDef[] = []
  for (const t of domain) {
    for (const fk of t.foreignKeys) {
      out.push({
        fromTable: t.name, fromCol: fk.from,
        toTable:   fk.table, toCol: fk.to,
        color: PALETTE[out.length % PALETTE.length],
        idx:   out.length,
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
  const [selected, setSelected] = useState<number | null>(null)

  const dragging  = useRef(false)
  const didDrag   = useRef(false)
  const lastPos   = useRef({ x: 0, y: 0 })
  const outerRef  = useRef<HTMLDivElement>(null)
  const dimsRef   = useRef({ w: 800, h: 600 })

  useEffect(() => {
    setLoading(true); setError(null); setZoom(1); setPan({ x: 0, y: 0 }); setSelected(null)
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
    dragging.current = true
    didDrag.current  = false
    lastPos.current  = { x: e.clientX, y: e.clientY }
  }, [])

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging.current) return
    const dx = e.clientX - lastPos.current.x
    const dy = e.clientY - lastPos.current.y
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) didDrag.current = true
    setPan(p => ({ x: p.x + dx, y: p.y + dy }))
    lastPos.current = { x: e.clientX, y: e.clientY }
  }, [])

  const onCanvasClick = useCallback(() => {
    if (!didDrag.current) setSelected(null)
    dragging.current = false
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

        {fks.map((f, i) => {
          const isSelected = selected === i
          return (
            <span key={i}
              onClick={() => setSelected(isSelected ? null : i)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 11,
                padding: '2px 8px 2px 6px', borderRadius: 20,
                border: `1px solid ${isSelected ? f.color : f.color + '55'}`,
                background: isSelected ? `${f.color}28` : `${f.color}14`,
                cursor: 'pointer', whiteSpace: 'nowrap',
                opacity: selected == null || isSelected ? 1 : 0.4,
                transition: 'opacity 0.15s, border-color 0.15s, background 0.15s',
                fontFamily: 'var(--font-mono)',
                boxShadow: isSelected ? `0 0 0 1px ${f.color}55` : 'none',
              }}>
              <span style={{ width: 18, height: 2, background: f.color, borderRadius: 1, flexShrink: 0 }} />
              <span style={{ color: f.color }}>{f.fromTable}</span>
              <span style={{ color: 'var(--text-muted)', opacity: 0.6 }}>·{f.fromCol}</span>
              <span style={{ color: 'var(--text-muted)' }}>→</span>
              <span style={{ color: f.color }}>{f.toTable}</span>
              <span style={{ color: 'var(--text-muted)', opacity: 0.6 }}>·{f.toCol}</span>
            </span>
          )
        })}

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
        onMouseUp={onCanvasClick} onMouseLeave={stopDrag}
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

              const isActive  = selected === i
              const isNeutral = selected === null
              if (!isNeutral && !isActive) return null

              // Y positions: FK column row when selected, table center when neutral
              const colIdx = fp.table.columns.findIndex(c => c.name === fk.fromCol)
              const fy = isActive
                ? fp.y + HH + Math.max(0, colIdx) * RH + RH / 2
                : fp.y + fp.h / 2

              const ty = isActive
                ? tp.y + HH / 2
                : tp.y + tp.h / 2

              const goRight = tp.x + tp.w / 2 >= fp.x + fp.w / 2
              const dir = goRight ? 1 : -1

              const fxEdge = goRight ? fp.x + fp.w : fp.x
              const fxLine = fxEdge + CF_LEN * dir
              const txEdge = goRight ? tp.x : tp.x + tp.w

              // Default: straight orthogonal lines — Selected: curved bezier
              let d: string
              let verbX: number
              let verbY: number

              if (isActive) {
                const dx  = Math.abs(txEdge - fxLine)
                const cp  = Math.max(55, dx * 0.55)
                const cx1 = goRight ? fxLine + cp : fxLine - cp
                const cx2 = goRight ? txEdge - cp : txEdge + cp
                d     = `M ${fxLine} ${fy} C ${cx1} ${fy} ${cx2} ${ty} ${txEdge} ${ty}`
                verbX = (fxLine + txEdge) / 2
                verbY = (fy + ty) / 2
              } else {
                const midX = (fxLine + txEdge) / 2
                d     = `M ${fxLine} ${fy} L ${midX} ${fy} L ${midX} ${ty} L ${txEdge} ${ty}`
                verbX = midX
                verbY = (fy + ty) / 2
              }

              const verb   = guessVerb(fk)
              const vw     = verb.length * 5.5 + 12
              const stroke = fk.color
              const sw     = isActive ? 2.5 : 2
              const alpha  = isNeutral ? 0.45 : 1

              return (
                <g key={i}>
                  {/* Glow halo — only when selected */}
                  {isActive && (
                    <path d={d} fill="none" stroke={fk.color}
                      strokeWidth={18} strokeOpacity={0.18} />
                  )}

                  {/* Main line */}
                  <path d={d} fill="none" stroke={stroke}
                    strokeWidth={sw} strokeOpacity={alpha} />

                  {/* ── Crow's foot at child/many end ── */}
                  <line x1={fxEdge} y1={fy} x2={fxLine} y2={fy}
                    stroke={stroke} strokeWidth={sw} strokeOpacity={alpha} />
                  <line x1={fxEdge} y1={fy} x2={fxLine} y2={fy - CF_SPREAD}
                    stroke={stroke} strokeWidth={sw} strokeOpacity={alpha} />
                  <line x1={fxEdge} y1={fy} x2={fxLine} y2={fy + CF_SPREAD}
                    stroke={stroke} strokeWidth={sw} strokeOpacity={alpha} />

                  {/* ── Single bar at parent/one end ── */}
                  <line x1={txEdge} y1={ty - BAR_H} x2={txEdge} y2={ty + BAR_H}
                    stroke={stroke} strokeWidth={isActive ? 2.5 : 2} strokeOpacity={alpha} />

                  {/* ── Verb label on default overview lines ── */}
                  {isNeutral && (
                    <g>
                      <rect
                        x={verbX - vw / 2} y={verbY - 8} width={vw} height={16}
                        rx={3} fill="var(--bg-base)"
                        stroke={stroke} strokeWidth={0.5} strokeOpacity={0.35} />
                      <text
                        x={verbX} y={verbY} textAnchor="middle" dominantBaseline="central"
                        fill={stroke} fontSize={9} fontWeight="600"
                        fontFamily="var(--font-mono)" opacity={0.8}>
                        {verb}
                      </text>
                    </g>
                  )}
                </g>
              )
            })}

            {/* ── Table cards ── */}
            {pos.map(p => {
              const lit      = selected != null && (fks[selected]?.fromTable === p.id || fks[selected]?.toTable === p.id)
              const litColor = lit ? fks[selected!].color : ''

              return (
                <g key={p.id}>
                  {lit && (
                    <rect x={p.x - 5} y={p.y - 5} width={p.w + 10} height={p.h + 10}
                      rx={12} ry={12} fill="none"
                      stroke={litColor} strokeWidth={2} strokeOpacity={0.55} />
                  )}

                  <g clipPath={`url(#clip-${p.id})`}>
                    <rect x={p.x} y={p.y} width={p.w} height={p.h} fill="var(--bg-panel)" />
                    <rect x={p.x} y={p.y} width={p.w} height={HH} fill="#1a2340" />

                    {p.table.columns.map((col, j) => {
                      const ry = p.y + HH + j * RH
                      const cy = ry + RH / 2
                      const fk = fkMap.get(`${p.id}.${col.name}`)
                      const typeStr = col.type.replace(/\(.*?\)/g, '').split(/\s+/)[0].toLowerCase()
                      const fkSelected = fk != null && selected === fk.idx
                      const fkDimmed  = fk != null && selected !== null && selected !== fk.idx

                      return (
                        <g key={col.name} style={{ cursor: fk ? 'pointer' : 'default' }}
                          onClick={fk ? (e) => { e.stopPropagation(); setSelected(fkSelected ? null : fk.idx) } : undefined}>

                          <rect x={p.x} y={ry} width={p.w} height={RH}
                            fill={j % 2 === 0 ? 'rgba(255,255,255,0.018)' : 'transparent'} />

                          {fk && (
                            <rect x={p.x} y={ry} width={3} height={RH}
                              fill={fk.color}
                              opacity={fkDimmed ? 0.15 : 1} />
                          )}

                          {col.pk && (
                            <text x={p.x + 10} y={cy} dominantBaseline="central"
                              fill="#f59e0b" fontSize={9} fontWeight="800" fontFamily="var(--font-mono)">
                              PK
                            </text>
                          )}

                          <text x={p.x + (col.pk ? 30 : 11)} y={cy} dominantBaseline="central"
                            fill="var(--text-muted)" fontSize={10} fontFamily="var(--font-mono)" opacity={0.6}>
                            {typeStr.length > 9 ? typeStr.slice(0, 8) + '…' : typeStr}
                          </text>

                          <text x={p.x + 90} y={cy} dominantBaseline="central"
                            fill={fk ? (fkDimmed ? 'var(--text-muted)' : fk.color) : col.pk ? 'var(--accent)' : 'var(--text)'}
                            fontSize={12} fontWeight={fk || col.pk ? '600' : '400'}
                            fontFamily="var(--font-mono)"
                            opacity={fkDimmed ? 0.3 : 1}>
                            {col.name.length > 13 ? col.name.slice(0, 12) + '…' : col.name}
                          </text>

                          {fk && (
                            <>
                              <rect x={p.x + p.w - 68} y={ry + 4} width={62} height={RH - 8}
                                rx={3} fill={`${fk.color}18`}
                                stroke={fk.color} strokeWidth={fkSelected ? 1.5 : 0.7}
                                strokeOpacity={fkDimmed ? 0.15 : 1} />
                              <text x={p.x + p.w - 37} y={cy} textAnchor="middle" dominantBaseline="central"
                                fill={fk.color} fontSize={9} fontWeight="700" fontFamily="var(--font-mono)"
                                opacity={fkDimmed ? 0.2 : 1}>
                                →{fk.toTable.length > 6 ? fk.toTable.slice(0, 5) + '…' : fk.toTable}
                              </text>
                            </>
                          )}

                          {j < p.table.columns.length - 1 && (
                            <line x1={p.x + 6} y1={ry + RH} x2={p.x + p.w - 6} y2={ry + RH}
                              stroke="var(--border)" strokeWidth={0.5} strokeOpacity={0.4} />
                          )}
                        </g>
                      )
                    })}
                  </g>

                  <text x={p.x + 12} y={p.y + HH / 2} dominantBaseline="central"
                    fill={lit ? litColor : 'var(--accent)'}
                    fontSize={13} fontWeight="700" fontFamily="var(--font-mono)"
                    style={{ transition: 'fill 0.15s' }}>
                    {p.table.name}
                  </text>

                  {p.table.rowCount > 0 && (
                    <text x={p.x + p.w - 10} y={p.y + HH / 2} textAnchor="end" dominantBaseline="central"
                      fill="var(--text-muted)" fontSize={10} opacity={0.5}>
                      {p.table.rowCount}r
                    </text>
                  )}

                  <line x1={p.x} y1={p.y + HH} x2={p.x + p.w} y2={p.y + HH}
                    stroke="var(--border)" strokeWidth={1} />

                  <rect x={p.x} y={p.y} width={p.w} height={p.h}
                    rx={8} ry={8} fill="none"
                    stroke={lit ? litColor : 'var(--border)'}
                    strokeWidth={lit ? 1.5 : 1}
                    strokeOpacity={lit ? 0.7 : 1}
                    style={{ transition: 'stroke 0.15s' }} />
                </g>
              )
            })}

            {domain.length === 0 && (
              <text x={svgW / 2} y={svgH / 2} textAnchor="middle" dominantBaseline="central"
                fill="var(--text-muted)" fontSize={14}>
                No tables in schema &quot;{schema}&quot;
              </text>
            )}
          </svg>
        )}

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

        {!loading && !error && selected === null && fks.length > 0 && (
          <div style={{
            position: 'absolute', bottom: 12, left: 16, fontSize: 11,
            color: 'var(--text-muted)', background: 'var(--bg-panel)',
            border: '1px solid var(--border)', borderRadius: 4, padding: '2px 8px',
            pointerEvents: 'none',
          }}>
            Click a badge to see the specific FK column link
          </div>
        )}
      </div>
    </div>
  )
}
