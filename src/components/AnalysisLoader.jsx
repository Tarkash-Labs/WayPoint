import { useState, useEffect } from 'react'

const STAGES = [
  { id: 'fetch',    icon: '📡', label: 'Fetching repository...' },
  { id: 'tree',     icon: '🌲', label: 'Mapping file structure' },
  { id: 'analyze',  icon: '🔍', label: 'Running static analysis' },
  { id: 'dirs',     icon: '🗂️',  label: 'Understanding architecture' },
  { id: 'ai',       icon: '🧠', label: 'AI enrichment with Gemini' },
  { id: 'hotspots', icon: '🔥', label: 'Detecting risk hotspots' },
  { id: 'done',     icon: '✅', label: 'Building context engine' },
]

export default function AnalysisLoader({ currentStage, repoName, error }) {
  const [visibleStages, setVisibleStages] = useState([])
  const currentIdx = STAGES.findIndex((s) => s.id === currentStage)

  // Progressively reveal stages as they complete
  useEffect(() => {
    const timer = setTimeout(() => {
      setVisibleStages(STAGES.slice(0, currentIdx + 1))
    }, 50)
    return () => clearTimeout(timer)
  }, [currentIdx])

  return (
    <div className="analysis-loader">
      <div className="analysis-loader__header">
        <div className="analysis-loader__repo">
          {repoName ? (
            <>
              <span className="analysis-loader__repo-icon">📦</span>
              <span className="analysis-loader__repo-name">{repoName}</span>
            </>
          ) : (
            <span className="analysis-loader__repo-name">Connecting to GitHub...</span>
          )}
        </div>
        <h2 className="analysis-loader__title">
          {error ? 'Analysis failed' : 'Analyzing Repository'}
        </h2>
      </div>

      {error ? (
        <div className="analysis-loader__error">
          <div className="analysis-loader__error-icon">⚠️</div>
          <div className="analysis-loader__error-text">{error}</div>
        </div>
      ) : (
        <div className="analysis-loader__stages">
          {STAGES.map((stage, idx) => {
            const isComplete = idx < currentIdx
            const isActive = idx === currentIdx
            const isPending = idx > currentIdx
            const isVisible = visibleStages.some((s) => s.id === stage.id) || isActive

            return (
              <div
                key={stage.id}
                className={`analysis-stage ${
                  isComplete
                    ? 'analysis-stage--complete'
                    : isActive
                    ? 'analysis-stage--active'
                    : 'analysis-stage--pending'
                } ${isVisible ? 'analysis-stage--visible' : ''}`}
              >
                <div className="analysis-stage__indicator">
                  {isComplete ? (
                    <span className="analysis-stage__check">✓</span>
                  ) : isActive ? (
                    <span className="analysis-stage__spinner" />
                  ) : (
                    <span className="analysis-stage__dot" />
                  )}
                </div>
                <span className="analysis-stage__icon">{stage.icon}</span>
                <span className="analysis-stage__label">{stage.label}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
