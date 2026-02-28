'use client'

import { useState, useCallback } from 'react'
import dynamic from 'next/dynamic'
import NavBar, { type ViewId } from '@/components/NavBar'

const SqlEditor    = dynamic(() => import('@/components/SqlEditor'),    { ssr: false })
const ResultsTable = dynamic(() => import('@/components/ResultsTable'), { ssr: false })
const SchemaBrowser = dynamic(() => import('@/components/SchemaBrowser'), { ssr: false })
const SavedQueries = dynamic(() => import('@/components/SavedQueries'), { ssr: false })
const TablesView   = dynamic(() => import('@/components/TablesView'),   { ssr: false })
const ErdView      = dynamic(() => import('@/components/ErdView'),      { ssr: false })

interface QueryResult {
  columns: string[]
  rows: Record<string, unknown>[]
  truncated?: boolean
}

const INITIAL_SQL = `-- Welcome to SQL Playground
-- Try a query below, or explore Tables and ERD via the top nav.

SELECT
  c.name          AS customer,
  COUNT(o.id)     AS total_orders,
  ROUND(SUM(oi.quantity * oi.unit_price), 2) AS total_spent
FROM customers c
JOIN orders o  ON o.customer_id = c.id
JOIN order_items oi ON oi.order_id = o.id
WHERE o.status = 'completed'
GROUP BY c.id, c.name
ORDER BY total_spent DESC`

export default function Page() {
  const [activeView, setActiveView] = useState<ViewId>('query')
  const [sql, setSql]               = useState(INITIAL_SQL)
  const [result, setResult]         = useState<QueryResult | null>(null)
  const [error, setError]           = useState<string | null>(null)
  const [isLoading, setIsLoading]   = useState(false)

  const restoreData = useCallback(async () => {
    const res = await fetch('/api/restore', { method: 'POST' })
    if (!res.ok) {
      const d = await res.json()
      throw new Error(d.error ?? 'Restore failed')
    }
    // Clear current results so stale data from dropped tables isn't shown
    setResult(null)
    setError(null)
  }, [])

  const runQuery = useCallback(async () => {
    if (!sql.trim() || isLoading) return
    setIsLoading(true)
    setError(null)
    setResult(null)
    try {
      const res  = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql }),
      })
      const data = await res.json()
      if (!res.ok) setError(data.error ?? 'Unknown error')
      else         setResult(data)
    } catch (err) {
      setError(String(err))
    } finally {
      setIsLoading(false)
    }
  }, [sql, isLoading])

  // When a saved query is loaded from any view, switch to query tab
  const handleLoadSaved = useCallback((savedSql: string) => {
    setSql(savedSql)
    setActiveView('query')
  }, [])

  return (
    <div className="app-shell">
      <NavBar
        activeView={activeView}
        onViewChange={setActiveView}
        dbBackend={process.env.NEXT_PUBLIC_DB_BACKEND ?? 'sqlite'}
        onRestore={restoreData}
      />

      <main className="view-container">

        {/* ── Query view: 3-panel (desktop) / editor only (mobile) ── */}
        {activeView === 'query' && (
          <div className="query-layout">
            <div className="panel-left">
              <SchemaBrowser />
            </div>

            <div className="panel-center">
              <SqlEditor
                value={sql}
                onChange={setSql}
                onRun={runQuery}
                isLoading={isLoading}
              />
              <ResultsTable
                columns={result?.columns ?? []}
                rows={result?.rows ?? []}
                error={error}
                truncated={result?.truncated}
              />
            </div>

            <div className="panel-right">
              <SavedQueries currentSql={sql} onLoad={handleLoadSaved} />
            </div>
          </div>
        )}

        {/* ── Tables view ── */}
        {activeView === 'tables' && (
          <div className="full-view">
            <TablesView />
          </div>
        )}

        {/* ── ERD view ── */}
        {activeView === 'erd' && (
          <div className="full-view">
            <ErdView />
          </div>
        )}

        {/* ── Saved view (mobile uses this tab; desktop has the right panel) ── */}
        {activeView === 'saved' && (
          <div className="full-view" style={{ overflowY: 'auto' }}>
            <SavedQueries currentSql={sql} onLoad={handleLoadSaved} />
          </div>
        )}

      </main>
    </div>
  )
}
