export default function Sidebar({ data, activeView, onViewChange, selectedTask }) {
  const views = [
    { id: 'task', icon: 'bx-message-square-dots', label: 'New Task', section: 'navigate' },
    { id: 'mission', icon: 'bx-target-lock', label: 'Mission Brief', section: 'navigate', disabled: !selectedTask },
    { id: 'onboarding', icon: 'bx-book-reader', label: 'AI Onboarding', section: 'learn' },
    { id: 'hotspots', icon: 'bxs-flame', label: 'Risk Hotspots', section: 'learn', badge: data ? '3' : null },
    { id: 'map', icon: 'bx-map-alt', label: 'Architecture Map', section: 'visualize' },
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
            <i className="bx bx-git-repo-forked" />
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
                  <i className={`bx ${view.icon} sidebar__item-icon`} />
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
            <span className="sidebar__stat-label">
              <i className="bx bx-file" /> Files
            </span>
            <span className="sidebar__stat-value">{data.repo.totalFiles}</span>
          </div>
          <div className="sidebar__stat-row">
            <span className="sidebar__stat-label">
              <i className="bx bx-code-alt" /> Lines of Code
            </span>
            <span className="sidebar__stat-value">{data.repo.totalLOC?.toLocaleString()}</span>
          </div>
          <div className="sidebar__stat-row">
            <span className="sidebar__stat-label">
              <i className="bx bx-shield-quarter" /> Difficulty
            </span>
            <span className="sidebar__stat-value" style={{ color: data.repo.difficulty === 'High' ? 'var(--color-danger)' : data.repo.difficulty === 'Medium' ? 'var(--color-warning)' : 'var(--color-success)' }}>
              {data.repo.difficulty}
            </span>
          </div>
        </div>
      )}
    </aside>
  )
}
