import { useState } from 'react'

const ROLE_ICONS = {
  Frontend: 'bx-palette',
  Backend: 'bx-server',
  'Bug Fixes': 'bx-bug',
  Architecture: 'bx-building-house',
}

/**
 * Build a heuristic onboarding structure from raw file data.
 * Used when AI enrichment fails or when the data shape doesn't match.
 */
function buildFallbackOnboarding(data) {
  const files = data?.files || []
  
  // Classify files by type
  const frontendFiles = files.filter(f => 
    /\.(jsx|tsx|css|html|vue|svelte)$/.test(f.path) || 
    /component|page|view|layout|style/i.test(f.path)
  )
  const backendFiles = files.filter(f => 
    /route|controller|api|server|middleware|model|schema|database|migration/i.test(f.path) ||
    /\.(go|py|java|rb|rs|php)$/.test(f.path)
  )
  const configFiles = files.filter(f => 
    /config|setup|env|\.json$|\.yaml$|\.yml$|\.toml$/i.test(f.path)
  )
  const riskyFiles = files.filter(f => (f.riskScore || 0) >= 5)

  const makeLessons = (fileList, category) => {
    if (fileList.length === 0) return []
    
    const topFiles = [...fileList]
      .sort((a, b) => (b.linesOfCode || 0) - (a.linesOfCode || 0))
      .slice(0, 5)

    return topFiles.map((f, i) => ({
      title: `Understand ${f.path.split('/').pop()}`,
      description: `Read through ${f.path} (${f.linesOfCode || '?'} LOC). ${f.semanticPurpose || `This is a key ${category} file in the codebase.`}`,
      estimatedTime: `${Math.max(5, Math.round((f.linesOfCode || 50) / 20))} min`,
      keyFiles: [f.path],
      insight: f.riskAnalysis || `${category} file ranked #${i + 1} by size in its category.`
    }))
  }

  return {
    roles: {
      Frontend: {
        estimatedTime: `${Math.max(1, Math.round(frontendFiles.length * 5 / 60))} hours`,
        lessons: makeLessons(frontendFiles, 'frontend')
      },
      Backend: {
        estimatedTime: `${Math.max(1, Math.round(backendFiles.length * 5 / 60))} hours`,
        lessons: makeLessons(backendFiles, 'backend')
      },
      'Bug Fixes': {
        estimatedTime: `${Math.max(1, Math.round(riskyFiles.length * 5 / 60))} hours`,
        lessons: makeLessons(riskyFiles, 'high-risk')
      },
      Architecture: {
        estimatedTime: `${Math.max(1, Math.round(configFiles.length * 3 / 60))} hours`,
        lessons: makeLessons(configFiles, 'architecture')
      }
    }
  }
}

export default function OnboardingView({ data }) {
  const [selectedRole, setSelectedRole] = useState(null)
  const [completedLessons, setCompletedLessons] = useState(new Set())
  const [activeLesson, setActiveLesson] = useState(0)

  if (!data) return null

  // Use AI-generated onboarding if it has the correct shape, otherwise build from file data
  const onboarding = (data.onboarding?.roles) 
    ? data.onboarding 
    : buildFallbackOnboarding(data)

  const roles = onboarding.roles

  // Filter out roles with no lessons
  const availableRoles = Object.entries(roles).filter(([, role]) => role.lessons && role.lessons.length > 0)

  if (availableRoles.length === 0) {
    return (
      <div className="onboarding">
        <h2 className="onboarding__heading">I'm new here.</h2>
        <p className="onboarding__subheading">
          No onboarding data available yet. Try analyzing a repository with more files, or submit a task to generate a Mission Brief.
        </p>
      </div>
    )
  }

  if (!selectedRole) {
    return (
      <div className="onboarding">
        <h2 className="onboarding__heading">I'm new here.</h2>
        <p className="onboarding__subheading">
          What's your role? Waypoint will create a personalized learning path through this codebase.
        </p>
        <div className="onboarding__roles">
          {availableRoles.map(([name, role]) => (
            <div key={name} className="role-card" onClick={() => setSelectedRole(name)}>
              <div className="role-card__icon">
                <i className={`bx ${ROLE_ICONS[name] || 'bx-package'}`} />
              </div>
              <div className="role-card__name">{name}</div>
              <div className="role-card__lessons">
                <i className="bx bx-book-open" /> {role.lessons.length} lessons
              </div>
              <div className="role-card__time">
                <i className="bx bx-time-five" /> {role.estimatedTime}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  const roleData = roles[selectedRole]
  
  // Safety check — if the role was removed or has no lessons
  if (!roleData || !roleData.lessons || roleData.lessons.length === 0) {
    setSelectedRole(null)
    return null
  }

  const lessons = roleData.lessons
  const progress = (completedLessons.size / lessons.length) * 100

  const handleCompleteLesson = (idx) => {
    const updated = new Set(completedLessons)
    updated.add(idx)
    setCompletedLessons(updated)
    if (idx < lessons.length - 1) {
      setActiveLesson(idx + 1)
    }
  }

  return (
    <div className="lesson-view">
      <button className="lesson-view__back" onClick={() => { setSelectedRole(null); setCompletedLessons(new Set()); setActiveLesson(0) }}>
        <i className="bx bx-arrow-back" /> Back to roles
      </button>

      <h2 className="onboarding__heading" style={{ marginTop: '16px' }}>
        <i className={`bx ${ROLE_ICONS[selectedRole] || 'bx-package'}`} /> {selectedRole} Onboarding
      </h2>
      <p className="onboarding__subheading">
        Estimated time: {roleData.estimatedTime} · {lessons.length} lessons
      </p>

      <div className="lesson-view__progress">
        <div className="lesson-view__progress-bar-bg">
          <div className="lesson-view__progress-bar" style={{ width: `${progress}%` }} />
        </div>
        <div className="lesson-view__progress-text">
          <span>{completedLessons.size} of {lessons.length} completed</span>
          <span>{Math.round(progress)}%</span>
        </div>
      </div>

      <div className="lesson-list">
        {lessons.map((lesson, idx) => {
          const isCompleted = completedLessons.has(idx)
          const isActive = idx === activeLesson && !isCompleted

          return (
            <div
              key={idx}
              className={`lesson-item ${isActive ? 'lesson-item--active' : ''} ${isCompleted ? 'lesson-item--completed' : ''}`}
              onClick={() => !isCompleted && setActiveLesson(idx)}
            >
              <div className={`lesson-item__status lesson-item__status--${isCompleted ? 'completed' : isActive ? 'active' : 'pending'}`}>
                {isCompleted ? <i className="bx bx-check" /> : idx + 1}
              </div>
              <div className="lesson-item__content">
                <div className="lesson-item__title">{lesson.title}</div>
                <div className="lesson-item__description">{lesson.description}</div>
                {lesson.insight && (
                  <div className="lesson-item__insight">
                    <i className="bx bx-bulb" />
                    <span>{lesson.insight}</span>
                  </div>
                )}
                {lesson.keyFiles && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '8px' }}>
                    {lesson.keyFiles.map((f) => (
                      <span key={f} className="prereq-card__file-tag">
                        <i className="bx bx-file" /> {f.split('/').pop()}
                      </span>
                    ))}
                  </div>
                )}
                {isActive && !isCompleted && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleCompleteLesson(idx) }}
                    style={{
                      marginTop: '12px',
                      padding: '6px 16px',
                      background: 'var(--color-accent)',
                      color: 'white',
                      border: 'none',
                      borderRadius: 'var(--radius-md)',
                      fontSize: 'var(--text-sm)',
                      fontWeight: '600',
                      cursor: 'pointer',
                      fontFamily: 'var(--font-sans)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    Complete & Continue <i className="bx bx-right-arrow-alt" />
                  </button>
                )}
              </div>
              <div className="lesson-item__time">
                <i className="bx bx-time-five" /> {lesson.estimatedTime}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
