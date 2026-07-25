import { useState } from 'react'

export default function MissionBrief({ task, data }) {
  if (!task || !task.mission) return null
  
  const { mission, evidence } = task

  return (
    <div className="mission-brief">
      {/* Header */}
      <div className="mission-brief__header">
        <div className="mission-brief__overline">Deep Mission Brief</div>
        <h2 className="mission-brief__title">{task.name}</h2>
      </div>

      {/* Evidence Panel (Replaces Confidence) */}
      {evidence && (
        <div className="mission-brief__evidence-panel">
          <div className="evidence-panel__header">
            <i className="bx bx-check-shield" /> Evidence
          </div>
          <div className="evidence-panel__grid">
            <div className="evidence-item">
              <i className="bx bx-check" style={{color: 'var(--color-success)'}} />
              <span><strong>{evidence.filesAnalyzed}</strong> files deeply analyzed</span>
            </div>
            <div className="evidence-item">
              <i className="bx bx-check" style={{color: 'var(--color-success)'}} />
              <span><strong>{evidence.functionsInspected}</strong> functions inspected</span>
            </div>
            <div className="evidence-item">
              <i className="bx bx-check" style={{color: 'var(--color-success)'}} />
              <span><strong>{evidence.candidatesRanked}</strong> candidate files ranked</span>
            </div>
            <div className="evidence-item">
              <i className="bx bx-check" style={{color: 'var(--color-success)'}} />
              <span>Source code extracted structurally</span>
            </div>
          </div>
        </div>
      )}
      
      {/* Why These Files (Detective Mode) */}
      {evidence && evidence.deepFiles && evidence.deepFiles.length > 0 && (
        <DetectiveMode files={evidence.deepFiles} />
      )}

      {/* Prerequisites */}
      {mission.prerequisites && mission.prerequisites.length > 0 && (
        <div className="mission-section">
          <div className="mission-section__header">
            <div className="mission-section__icon mission-section__icon--prereq">
              <i className="bx bx-list-check" />
            </div>
            <h3 className="mission-section__title">Prerequisites</h3>
            <span className="mission-section__count">Learn these first</span>
          </div>
          {mission.prerequisites.map((prereq, i) => (
            <div key={i} className="prereq-card">
              <div className="prereq-card__content">
                <div className="prereq-card__description">{prereq}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Files You'll Touch */}
      {mission.filesToTouch && mission.filesToTouch.length > 0 && (
        <div className="mission-section">
          <div className="mission-section__header">
            <div className="mission-section__icon">
              <i className="bx bx-folder-open" />
            </div>
            <h3 className="mission-section__title">Files You'll Touch</h3>
            <span className="mission-section__count">{mission.filesToTouch.length} files</span>
          </div>
          {mission.filesToTouch.map((file, i) => (
            <div key={i} className="file-card">
              <div className="file-card__indicator file-card__indicator--primary" />
              <div className="file-card__content">
                <div className="file-card__header">
                  <span className="file-card__path">
                    <i className="bx bx-file" /> {file.path}
                  </span>
                </div>
                <div className="file-card__reason">{file.reason}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Known Traps */}
      {mission.knownTraps && mission.knownTraps.length > 0 && (
        <div className="mission-section">
          <div className="mission-section__header">
            <div className="mission-section__icon mission-section__icon--warning">
              <i className="bx bx-shield-x" />
            </div>
            <h3 className="mission-section__title">Known Traps</h3>
            <span className="mission-section__count">{mission.knownTraps.length} warnings</span>
          </div>
          {mission.knownTraps.map((trap, i) => (
            <div key={i} className="trap-card trap-card--warning">
              <div className="trap-card__description">
                <i className="bx bx-error" /> {trap}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Route */}
      {mission.routeSteps && mission.routeSteps.length > 0 && (
        <div className="mission-section">
          <div className="mission-section__header">
            <div className="mission-section__icon mission-section__icon--route">
              <i className="bx bx-compass" />
            </div>
            <h3 className="mission-section__title">Route</h3>
            <span className="mission-section__count">Recommended execution order</span>
          </div>
          <div className="route-list">
            {mission.routeSteps.map((step, i) => (
              <div key={i} className="route-step">
                <div className="route-step__number">Step {i + 1}</div>
                <div className="route-step__action">{step}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function DetectiveMode({ files }) {
  const [expanded, setExpanded] = useState(false)
  
  return (
    <div className="mission-section">
      <div 
        className="detective-mode-trigger" 
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer',
          padding: '12px 16px', background: 'var(--color-surface)', border: '1px solid var(--color-border)',
          borderRadius: 'var(--radius-md)', fontWeight: 600, color: 'var(--color-text-primary)',
          transition: 'all 0.2s'
        }}
      >
        <i className={`bx ${expanded ? 'bx-chevron-up' : 'bx-chevron-down'}`} />
        WHY THESE FILES?
      </div>
      
      {expanded && (
        <div className="detective-mode-content" style={{
          marginTop: '12px', padding: '16px', background: 'var(--color-bg)', border: '1px dashed var(--color-border)',
          borderRadius: 'var(--radius-md)', fontFamily: 'var(--font-mono)', fontSize: '13px', color: 'var(--color-text-secondary)'
        }}>
          {files.map((file, i) => (
            <div key={file} style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="bx bx-file" style={{ color: 'var(--color-accent)' }} /> 
                <span style={{ color: 'var(--color-text-primary)' }}>{file}</span>
              </div>
              {i < files.length - 1 && (
                <div style={{ padding: '8px 0 8px 6px', color: 'var(--color-border-hover)' }}>
                  <i className="bx bx-down-arrow-alt" /> structural dependency
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
