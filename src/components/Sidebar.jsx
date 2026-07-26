export default function Sidebar({ data, activeView, onViewChange, selectedTask }) {
  const views = [
    {
      id: 'task',
      label: 'New Task',
      section: 'navigate',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
      ),
    },
    {
      id: 'mission',
      label: 'Mission Brief',
      section: 'navigate',
      disabled: !selectedTask,
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>
        </svg>
      ),
    },
    {
      id: 'onboarding',
      label: 'AI Onboarding',
      section: 'understand',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 010 14.14M4.93 4.93a10 10 0 000 14.14"/>
        </svg>
      ),
    },
    {
      id: 'hotspots',
      label: 'Risk Hotspots',
      section: 'understand',
      badge: data ? '3' : null,
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
          <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
        </svg>
      ),
    },
    {
      id: 'map',
      label: 'Architecture Map',
      section: 'visualize',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
          <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
        </svg>
      ),
    },
    {
      id: 'galaxy',
      label: 'Dependency Galaxy',
      section: 'visualize',
      icon: (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="12" r="3" />
          <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.93 4.93l2.12 2.12M16.95 16.95l2.12 2.12M4.93 19.07l2.12-2.12M16.95 7.05l2.12-2.12" />
        </svg>
      ),
    },
  ]

  const sections = [
    { id: 'navigate',   label: 'NAVIGATE' },
    { id: 'understand', label: 'UNDERSTAND' },
    { id: 'visualize',  label: 'VISUALIZE' },
  ]

  return (
    <aside className="hud-sidebar">
      {/* Logo */}
      <div className="hud-sidebar__logo">
        <img src="/favicon.png" alt="Waypoint Logo" style={{ width: '28px', height: '28px', borderRadius: '6px' }} />
        <span className="hud-sidebar__logo-text" style={{ marginLeft: '10px' }}>Waypoint</span>
      </div>

      {/* Repo name if available */}
      {data && (
        <div className="hud-sidebar__repo">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 00-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0020 4.77 5.07 5.07 0 0019.91 1S18.73.65 16 2.48a13.38 13.38 0 00-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 005 4.77a5.44 5.44 0 00-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 009 18.13V22"/></svg>
          {data.repo.name}
        </div>
      )}

      {/* Navigation */}
      <nav className="hud-sidebar__nav">
        {sections.map((section) => {
          const sectionViews = views.filter((v) => v.section === section.id)
          if (!sectionViews.length) return null
          return (
            <div key={section.id} className="hud-sidebar__section">
              <div className="hud-sidebar__section-label">{section.label}</div>
              {sectionViews.map((view) => (
                <button
                  key={view.id}
                  className={`hud-sidebar__item ${activeView === view.id ? 'hud-sidebar__item--active' : ''} ${view.disabled ? 'hud-sidebar__item--disabled' : ''}`}
                  onClick={() => !view.disabled && onViewChange(view.id)}
                >
                  <span className="hud-sidebar__item-icon">{view.icon}</span>
                  <span className="hud-sidebar__item-label">{view.label}</span>
                  {view.badge && (
                    <span className="hud-sidebar__badge">{view.badge}</span>
                  )}
                </button>
              ))}
            </div>
          )
        })}
      </nav>

      {/* Stats */}
      {data && (
        <div className="hud-sidebar__stats">
          <div className="hud-sidebar__stat">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            <span className="hud-sidebar__stat-label">Files</span>
            <span className="hud-sidebar__stat-value">{data.repo.totalFiles}</span>
          </div>
          <div className="hud-sidebar__stat">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
            <span className="hud-sidebar__stat-label">Lines of Code</span>
            <span className="hud-sidebar__stat-value">{data.repo.totalLOC?.toLocaleString()}</span>
          </div>
          <div className="hud-sidebar__stat">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
            <span className="hud-sidebar__stat-label">Difficulty</span>
            <span
              className="hud-sidebar__stat-value"
              style={{
                color: data.repo.difficulty === 'High'
                  ? '#f87171'
                  : data.repo.difficulty === 'Medium'
                  ? '#fbbf24'
                  : '#34d399',
              }}
            >
              {data.repo.difficulty || 'Low'}
            </span>
          </div>
        </div>
      )}
    </aside>
  )
}
