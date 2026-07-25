import { useState } from 'react'

const ROLE_ICONS = {
  Frontend: 'bx-palette',
  Backend: 'bx-server',
  'Bug Fixes': 'bx-bug',
  Architecture: 'bx-building-house',
}

export default function OnboardingView({ data }) {
  const [selectedRole, setSelectedRole] = useState(null)
  const [completedLessons, setCompletedLessons] = useState(new Set())
  const [activeLesson, setActiveLesson] = useState(0)

  if (!data?.onboarding) return null

  const roles = data.onboarding.roles

  if (!selectedRole) {
    return (
      <div className="onboarding">
        <h2 className="onboarding__heading">I'm new here.</h2>
        <p className="onboarding__subheading">
          What's your role? Waypoint will create a personalized learning path through this codebase.
        </p>
        <div className="onboarding__roles">
          {Object.entries(roles).map(([name, role]) => (
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
