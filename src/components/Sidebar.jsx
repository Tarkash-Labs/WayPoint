export default function Sidebar({ data, activeView, onViewChange, selectedTask }) {
  const views = [
    { id: 'task', icon: '💬', label: 'New Task', section: 'navigate' },
    { id: 'mission', icon: '🎯', label: 'Mission Brief', section: 'navigate', disabled: !selectedTask },
    { id: 'onboarding', icon: '📚', label: 'AI Onboarding', section: 'learn' },
    { id: 'hotspots', icon: '🔥', label: 'Risk Hotspots', section: 'learn', badge: data ? '3' : null },
    { id: 'map', icon: '🗺️', label: 'Architecture Map', section: 'visualize' },
  ]

  const sections = {
    navigate: 'Navigate',
    learn: 'Understand',
    visualize: 'Visualize',
  }

  const sectionOrder = ['navigate', 'learn', 'visualize']

  return (
    <aside className="sidebar">
      <div className="sidebar__header">
        <div className="sidebar__brand">
          <span>Way</span>point
        </div>
        {data && (
          <div className="sidebar__repo">
            <span>📦</span>
            {data.repo.name}
          </div>
        )}
      </div>

      <nav className="sidebar__nav">
        {sectionOrder.map((section) => (
          <div key={section}>
            <div className="sidebar__section-title">{sections[section]}</div>
            {views
              .filter((v) => v.section === section)
              .map((view) => (
                <button
                  key={view.id}
                  className={`sidebar__item ${activeView === view.id ? 'sidebar__item--active' : ''}`}
                  onClick={() => !view.disabled && onViewChange(view.id)}
                  style={{ opacity: view.disabled ? 0.4 : 1, cursor: view.disabled ? 'default' : 'pointer' }}
                >
                  <span className="sidebar__item-icon">{view.icon}</span>
                  {view.label}
                  {view.badge && <span className="sidebar__item-badge">{view.badge}</span>}
                </button>
              ))}
          </div>
        ))}
      </nav>

      {data && (
        <div className="sidebar__stats">
          <div className="sidebar__stat-row">
            <span className="sidebar__stat-label">Files</span>
            <span className="sidebar__stat-value">{data.repo.totalFiles}</span>
          </div>
          <div className="sidebar__stat-row">
            <span className="sidebar__stat-label">Lines of Code</span>
            <span className="sidebar__stat-value">{data.repo.totalLOC.toLocaleString()}</span>
          </div>
          <div className="sidebar__stat-row">
            <span className="sidebar__stat-label">Difficulty</span>
            <span className="sidebar__stat-value" style={{ color: data.repo.difficulty === 'High' ? 'var(--color-danger)' : data.repo.difficulty === 'Medium' ? 'var(--color-warning)' : 'var(--color-success)' }}>
              {data.repo.difficulty}
            </span>
          </div>
        </div>
      )}
    </aside>
  )
}
