import { useState, useEffect } from 'react'

const STAGES = [
  { id: 'fetch', label: 'Understanding repository...', icon: 'bx-cloud-download' },
  { id: 'tree', label: 'Framework detected', icon: 'bx-git-branch' },
  { id: 'analyze', label: 'Dependency graph built', icon: 'bx-search-alt' },
  { id: 'dirs', label: 'Candidate files ranked', icon: 'bx-folder-open' },
  { id: 'ai', label: 'Reading source code', icon: 'bx-brain' },
  { id: 'hotspots', icon: 'bxs-flame',         label: 'Generating mission plan' },
  { id: 'done',     icon: 'bx-check-circle',   label: 'Ready' },
]

export default function AnalysisLoader({ currentStage, repoName, error }) {
  const [visibleStages, setVisibleStages] = useState([])
  const currentIdx = STAGES.findIndex((s) => s.id === currentStage)

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
              <i className="bx bx-git-repo-forked analysis-loader__repo-icon" />
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
          <i className="bx bx-error-circle analysis-loader__error-icon" />
          <div className="analysis-loader__error-text">{error}</div>
        </div>
      ) : (
        <div className="analysis-loader__stages">
          {STAGES.map((stage, idx) => {
            const isComplete = idx < currentIdx
            const isActive = idx === currentIdx
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
                    <span className="analysis-stage__check"><i className="bx bx-check" /></span>
                  ) : isActive ? (
                    <span className="analysis-stage__spinner" />
                  ) : (
                    <span className="analysis-stage__dot" />
                  )}
                </div>
                <i className={`bx ${stage.icon} analysis-stage__icon`} />
                <span className="analysis-stage__label">{stage.label}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
