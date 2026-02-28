'use client'

export type ViewId = 'query' | 'tables' | 'erd' | 'saved'

interface Props {
  activeView: ViewId
  onViewChange: (v: ViewId) => void
  dbBackend?: string
}

const TABS: { id: ViewId; label: string; icon: string }[] = [
  { id: 'query',  label: 'Query',  icon: '⌨' },
  { id: 'tables', label: 'Tables', icon: '⊞' },
  { id: 'erd',    label: 'ERD',    icon: '◈' },
  { id: 'saved',  label: 'Saved',  icon: '★' },
]

export default function NavBar({ activeView, onViewChange, dbBackend }: Props) {
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
        </div>
      </nav>
    </>
  )
}
