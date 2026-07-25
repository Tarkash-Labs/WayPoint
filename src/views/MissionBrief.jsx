export default function MissionBrief({ task, data }) {
  if (!task) return null

  const riskClass = task.risk === 'High' ? 'risk-high' : task.risk === 'Medium' ? 'risk-medium' : 'risk-low'

  return (
    <div className="mission-brief">
      {/* Header */}
      <div className="mission-brief__header">
        <div className="mission-brief__overline">Mission Brief</div>
        <h2 className="mission-brief__title">{task.name}</h2>
        <p className="mission-brief__summary">{task.summary}</p>
      </div>

      {/* Meta Cards */}
      <div className="mission-brief__meta">
        <div className="meta-card">
          <div className="meta-card__label"><i className="bx bx-check-shield" /> Confidence</div>
          <div className="meta-card__value meta-card__value--confidence">{task.confidence}%</div>
          <div className="meta-card__detail">{task.confidenceReason}</div>
        </div>
        <div className="meta-card">
          <div className="meta-card__label"><i className="bx bx-shield-quarter" /> Risk</div>
          <div className={`meta-card__value meta-card__value--${riskClass}`}>{task.risk}</div>
          <div className="meta-card__detail">Based on file complexity & incident history</div>
        </div>
        <div className="meta-card">
          <div className="meta-card__label"><i className="bx bx-time-five" /> Est. Effort</div>
          <div className="meta-card__value">{task.estimatedEffort}</div>
          <div className="meta-card__detail">Including testing & review</div>
        </div>
        <div className="meta-card">
          <div className="meta-card__label"><i className="bx bx-file" /> Files You'll Touch</div>
          <div className="meta-card__value">{task.relevantFiles?.length}</div>
          <div className="meta-card__detail">{task.ignoredCount} files safely ignored</div>
        </div>
      </div>

      {/* Prerequisites */}
      {task.prerequisites && task.prerequisites.length > 0 && (
        <div className="mission-section">
          <div className="mission-section__header">
            <div className="mission-section__icon mission-section__icon--prereq">
              <i className="bx bx-list-check" />
            </div>
            <h3 className="mission-section__title">Prerequisites</h3>
            <span className="mission-section__count">Learn these first</span>
          </div>
          {task.prerequisites.map((prereq, i) => (
            <div key={i} className="prereq-card">
              <div className="prereq-card__content">
                <div className="prereq-card__title">{prereq.concept}</div>
                <div className="prereq-card__description">{prereq.description}</div>
                <div className="prereq-card__files">
                  {prereq.files?.map((f) => (
                    <span key={f} className="prereq-card__file-tag">
                      <i className="bx bx-file" /> {f}
                    </span>
                  ))}
                </div>
              </div>
              <div className="prereq-card__time">
                <i className="bx bx-time-five" /> {prereq.estimatedTime}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Files You'll Touch */}
      <div className="mission-section">
        <div className="mission-section__header">
          <div className="mission-section__icon">
            <i className="bx bx-folder-open" />
          </div>
          <h3 className="mission-section__title">Files You'll Touch</h3>
          <span className="mission-section__count">{task.relevantFiles?.length} files</span>
        </div>
        {task.relevantFiles?.map((file, i) => (
          <div key={i} className={`file-card ${file.warning ? 'file-card--has-warning' : ''}`}>
            <div className={`file-card__indicator file-card__indicator--${file.priority}`} />
            <div className="file-card__content">
              <div className="file-card__header">
                <span className="file-card__path">
                  <i className="bx bx-file" /> {file.path}
                </span>
                <span className={`file-card__badge file-card__badge--${file.priority}`}>
                  {file.priority === 'primary' ? '★ Primary' : 'Secondary'}
                </span>
              </div>
              <div className="file-card__reason">{file.reason}</div>
              <div className="file-card__meta">
                <span className="file-card__meta-item">
                  <i className="bx bx-code-alt" /> {file.linesOfCode} LOC
                </span>
                {file.lines && (
                  <span className="file-card__meta-item">
                    <i className="bx bx-map-pin" /> Lines {file.lines}
                  </span>
                )}
                <span className="file-card__meta-item" style={{ color: file.riskScore >= 7 ? 'var(--color-danger)' : file.riskScore >= 4 ? 'var(--color-warning)' : 'var(--color-success)' }}>
                  <i className="bx bx-bolt-circle" /> Risk {file.riskScore}
                </span>
              </div>
              {file.warning && (
                <div className="file-card__warning">
                  <i className="bx bx-error" />
                  <span>{file.warning}</span>
                </div>
              )}
            </div>
          </div>
        ))}
        <div className="mission-section__ignored">
          <i className="bx bx-hide" /> <strong>{task.ignoredCount} files</strong> in this repository are not relevant to this task
        </div>
      </div>

      {/* Known Traps */}
      {task.knownTraps && task.knownTraps.length > 0 && (
        <div className="mission-section">
          <div className="mission-section__header">
            <div className="mission-section__icon mission-section__icon--warning">
              <i className="bx bx-shield-x" />
            </div>
            <h3 className="mission-section__title">Known Traps</h3>
            <span className="mission-section__count">{task.knownTraps.length} warnings</span>
          </div>
          {task.knownTraps.map((trap, i) => (
            <div key={i} className={`trap-card trap-card--${trap.severity}`}>
              <div className="trap-card__header">
                <span className={`trap-card__severity trap-card__severity--${trap.severity}`}>
                  {trap.severity}
                </span>
                <span className="trap-card__title">{trap.title}</span>
              </div>
              <div className="trap-card__file"><i className="bx bx-file" /> {trap.file}</div>
              <div className="trap-card__description">{trap.description}</div>
              <div className="trap-card__recommendation">
                <i className="bx bx-bulb" />
                <span>{trap.recommendation}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Route */}
      {task.route && task.route.length > 0 && (
        <div className="mission-section">
          <div className="mission-section__header">
            <div className="mission-section__icon mission-section__icon--route">
              <i className="bx bx-compass" />
            </div>
            <h3 className="mission-section__title">Route</h3>
            <span className="mission-section__count">Recommended order</span>
          </div>
          <div className="route-list">
            {task.route.map((step, i) => (
              <div key={i} className="route-step">
                <div className="route-step__number">Step {step.order}</div>
                <div className="route-step__file"><i className="bx bx-file" /> {step.file}</div>
                <div className="route-step__action">{step.action}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
