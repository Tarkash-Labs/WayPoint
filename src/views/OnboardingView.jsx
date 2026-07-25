import { useState } from 'react'

const ROLE_EMOJIS = {
  Frontend: '🎨',
  Backend: '🖥️',
  'Bug Fixes': '🐛',
  Architecture: '🏗️',
}

/**
 * Build a heuristic onboarding structure from raw file data.
 */
function buildFallbackOnboarding(data) {
  const files = data?.files || []
  
  const frontendFiles = files.filter(f => /\.(jsx|tsx|css|html|vue|svelte)$/.test(f.path) || /component|page|view|layout|style/i.test(f.path))
  const backendFiles = files.filter(f => /route|controller|api|server|middleware|model|schema|database|migration/i.test(f.path) || /\.(go|py|java|rb|rs|php)$/.test(f.path))
  const configFiles = files.filter(f => /config|setup|env|\.json$|\.yaml$|\.yml$|\.toml$/i.test(f.path))
  const riskyFiles = files.filter(f => (f.riskScore || 0) >= 5)

  const makeLessons = (fileList, category) => {
    if (fileList.length === 0) return []
    const topFiles = [...fileList].sort((a, b) => (b.linesOfCode || 0) - (a.linesOfCode || 0)).slice(0, 5)
    return topFiles.map((f, i) => ({
      title: `Understand ${f.path.split('/').pop()}`,
      description: `Read through ${f.path} (${f.linesOfCode || '?'} LOC).`,
      estimatedTime: `${Math.max(5, Math.round((f.linesOfCode || 50) / 20))} min`,
      keyFiles: [f.path],
      insight: f.riskAnalysis || `${category} file ranked #${i + 1} by size.`
    }))
  }

  return {
    roles: {
      Frontend: { estimatedTime: `${Math.max(1, Math.round(frontendFiles.length * 5 / 60))} hours`, lessons: makeLessons(frontendFiles, 'frontend') },
      Backend: { estimatedTime: `${Math.max(1, Math.round(backendFiles.length * 5 / 60))} hours`, lessons: makeLessons(backendFiles, 'backend') },
      'Bug Fixes': { estimatedTime: `${Math.max(1, Math.round(riskyFiles.length * 5 / 60))} hours`, lessons: makeLessons(riskyFiles, 'high-risk') },
      Architecture: { estimatedTime: `${Math.max(1, Math.round(configFiles.length * 3 / 60))} hours`, lessons: makeLessons(configFiles, 'architecture') }
    }
  }
}

function PathPreview({ lessons }) {
  if (!lessons || !lessons.length) return null
  return (
    <div className="ob-path">
      <div className="ob-path__title">Personalized Path Preview</div>
      <div className="ob-path__content">
        <div className="ob-path__label">Your Path:</div>
        <div className="ob-path__steps">
          {lessons.slice(0, 3).map((l, i) => (
            <div key={i} className="ob-path__step">
              <span className="ob-path__dot" />
              <span className="ob-path__text">{l.title.replace('Understand ', '')}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default function OnboardingView({ data }) {
  const [selectedRole, setSelectedRole] = useState(null)
  const [hoveredRole, setHoveredRole] = useState(null)

  if (!data) return null

  const onboarding = (data.onboarding?.roles) ? data.onboarding : buildFallbackOnboarding(data)
  const roles = onboarding.roles
  const availableRoles = Object.entries(roles).filter(([, role]) => role.lessons && role.lessons.length > 0)

  if (availableRoles.length === 0) {
    return (
      <div className="ob-view">
        <h2 className="ob-view__title">I'm new here.</h2>
        <p className="ob-view__subtitle">No onboarding data available yet. Try analyzing a repository with more files.</p>
      </div>
    )
  }

  // State 1: Role Selection
  if (!selectedRole) {
    return (
      <div className="ob-view">
        {/* Background ambient orbs */}
        <div className="ob-ambient ob-ambient--1" />
        <div className="ob-ambient ob-ambient--2" />
        <div className="ob-ambient ob-ambient--3" />

        <div className="ob-header">
          <h2 className="ob-title">I'm new here.</h2>
          <p className="ob-subtitle">What's your role? Waypoint will create a personalized learning path through this codebase.</p>
        </div>

        <div className="ob-roles">
          {availableRoles.map(([name, role]) => {
            const isHovered = hoveredRole === name
            return (
              <div 
                key={name}
                className={`ob-card ${isHovered ? 'ob-card--hovered' : ''}`}
                onMouseEnter={() => setHoveredRole(name)}
                onMouseLeave={() => setHoveredRole(null)}
                onClick={() => setSelectedRole(name)}
              >
                <div className="ob-card__inner">
                  <div className="ob-card__icon">{ROLE_EMOJIS[name] || '📦'}</div>
                  <h3 className="ob-card__name">{name}</h3>
                  <div className="ob-card__meta">
                    <span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg> {role.lessons.length} lessons</span>
                  </div>
                  <div className="ob-card__meta">
                    <span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> {role.estimatedTime}</span>
                  </div>
                  
                  {isHovered && <PathPreview lessons={role.lessons} />}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  // State 2: Active Onboarding Path
  const roleData = roles[selectedRole]
  if (!roleData || !roleData.lessons.length) {
    setSelectedRole(null)
    return null
  }

  return (
    <div className="ob-view ob-view--path">
      <button className="ob-back" onClick={() => setSelectedRole(null)}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
        Back to roles
      </button>

      <div className="ob-path-header">
        <h2 className="ob-title">{ROLE_EMOJIS[selectedRole]} {selectedRole} Onboarding</h2>
        <p className="ob-subtitle">Estimated time: {roleData.estimatedTime} · {roleData.lessons.length} lessons</p>
      </div>

      <div className="ob-lessons">
        {roleData.lessons.map((lesson, idx) => (
          <div key={idx} className="ob-lesson">
            <div className="ob-lesson__num">{idx + 1}</div>
            <div className="ob-lesson__content">
              <div className="ob-lesson__title">{lesson.title}</div>
              <div className="ob-lesson__desc">{lesson.description}</div>
              {lesson.keyFiles && (
                <div className="ob-lesson__files">
                  {lesson.keyFiles.map(f => (
                    <span key={f} className="ob-lesson__file">{f.split('/').pop()}</span>
                  ))}
                </div>
              )}
            </div>
            <div className="ob-lesson__time">{lesson.estimatedTime}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
