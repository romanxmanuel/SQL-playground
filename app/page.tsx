'use client'

import { useState, useCallback, useRef } from 'react'
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
  schemaChange?: string
  messages?: string[]   // DDL/DML summaries from multi-statement execution
}

const DEFAULT_SCHEMA = process.env.NEXT_PUBLIC_TIDB_DB ?? 'playground'
const LS_KEY = 'sql-playground-last-schema'

const INITIAL_SQL = ``

export default function Page() {
  const [activeView, setActiveView] = useState<ViewId>('query')
  const [schema, setSchema]         = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(LS_KEY) ?? DEFAULT_SCHEMA
    }
    return DEFAULT_SCHEMA
  })
  const [sql, setSql]               = useState(INITIAL_SQL)
  const [result, setResult]         = useState<QueryResult | null>(null)
  const [error, setError]           = useState<string | null>(null)
  const [errorLine, setErrorLine]   = useState<number | null>(null)
  const [isLoading, setIsLoading]   = useState(false)
  // Schema browser / ERD refresh key — increment to force remount on upload
  const [schemaKey, setSchemaKey]   = useState(0)

  const handleSchemaChange = useCallback((s: string) => {
    setSchema(s)
    setSchemaKey((k) => k + 1)
    setResult(null)
    setError(null)
    localStorage.setItem(LS_KEY, s)
  }, [])

  const restoreData = useCallback(async () => {
    const res = await fetch('/api/restore', { method: 'POST' })
    if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? 'Restore failed') }
    setResult(null); setError(null)
    setSchemaKey((k) => k + 1)
  }, [])

  const clearDb = useCallback(async () => {
    const res = await fetch('/api/clear', { method: 'POST' })
    if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? 'Clear failed') }
    setResult(null); setError(null)
    setSchemaKey((k) => k + 1)
  }, [])

  const deleteSchema = useCallback(async (name: string) => {
    const res = await fetch(`/api/databases/${encodeURIComponent(name)}`, { method: 'DELETE' })
    const d = await res.json()
    if (!res.ok) throw new Error(d.error ?? 'Delete failed')
    // Switch back to default schema
    handleSchemaChange(DEFAULT_SCHEMA)
  }, [handleSchemaChange])

  const handleUpload = useCallback(async (file: File) => {
    const text = await file.text()
    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql: text, filename: file.name }),
    })
    const data = await res.json()
    if (!res.ok) throw new Error(data.error ?? 'Upload failed')
    // Switch to the newly loaded schema
    if (data.schema) {
      handleSchemaChange(data.schema)
    }
    // Refresh the databases list in NavBar by bumping schemaKey
    setSchemaKey((k) => k + 1)
  }, [handleSchemaChange])

  const runQuery = useCallback(async (sqlOverride?: string) => {
    const queryToRun = sqlOverride ?? sql
    if (!queryToRun.trim() || isLoading) return
    setIsLoading(true)
    setError(null)
    setErrorLine(null)
    setResult(null)
    try {
      const res  = await fetch('/api/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql: queryToRun, schema }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Unknown error')
        setErrorLine(data.errorLine ?? null)
      } else {
        setResult(data)
        // If query had a USE statement, switch schema automatically
        if (data.schemaChange) {
          handleSchemaChange(data.schemaChange)
        }
      }
    } catch (err) {
      setError(String(err))
    } finally {
      setIsLoading(false)
    }
  }, [sql, schema, isLoading, handleSchemaChange])

  const handleLoadSaved = useCallback((savedSql: string) => {
    setSql(savedSql)
    setActiveView('query')
  }, [])

  return (
    <div className="app-shell">
      <NavBar
        activeView={activeView}
        onViewChange={setActiveView}
        schema={schema}
        onSchemaChange={handleSchemaChange}
        onUpload={handleUpload}
        onRestore={restoreData}
        onClear={clearDb}
        onDeleteSchema={deleteSchema}
      />

      <main className="view-container">

        {/* ── Query view ── */}
        {activeView === 'query' && (
          <div className="query-layout">
            <div className="panel-left">
              <SchemaBrowser key={schemaKey} schema={schema} />
            </div>

            <div className="panel-center">
              <SqlEditor value={sql} onChange={setSql} onRun={runQuery} isLoading={isLoading} />
              <div style={{ flex: 1, minHeight: 0, overflow: 'hidden', borderTop: '1px solid var(--border)' }}>
                <ResultsTable
                  columns={result?.columns ?? []}
                  rows={result?.rows ?? []}
                  error={error}
                  errorLine={errorLine}
                  truncated={result?.truncated}
                  messages={result?.messages}
                />
              </div>
            </div>

            <div className="panel-right">
              <SavedQueries currentSql={sql} onLoad={handleLoadSaved} />
            </div>
          </div>
        )}

        {/* ── Tables view ── */}
        {activeView === 'tables' && (
          <div className="full-view">
            <TablesView key={schemaKey} schema={schema} />
          </div>
        )}

        {/* ── ERD view ── */}
        {activeView === 'erd' && (
          <div className="full-view">
            <ErdView key={schemaKey} schema={schema} />
          </div>
        )}

        {/* ── Saved view (mobile tab) ── */}
        {activeView === 'saved' && (
          <div className="full-view" style={{ overflowY: 'auto' }}>
            <SavedQueries currentSql={sql} onLoad={handleLoadSaved} />
          </div>
        )}

      </main>
    </div>
  )
}
