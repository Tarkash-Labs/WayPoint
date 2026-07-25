import { useState } from 'react'

export default function MissionBrief({ task, data }) {
  if (!task || !task.mission) return null
  
  const { mission, evidence, provider } = task

  return (
    <div className="hud-mission-brief">
      {/* Header Panel */}
      <div className="hud-mission-header">
        <div className="hud-mission-header__content">
          <div className="hud-overline"><i className="bx bx-target-lock" /> MISSION BRIEFING</div>
          <h2 className="hud-mission-title">{task.name}</h2>
        </div>
        {provider && (
          <div className="hud-mission-provider">
            <i className="bx bx-chip" /> {provider}
          </div>
        )}
      </div>

      {/* Evidence Panel (Replaces Confidence) */}
      {evidence && (
        <div className="hud-mission-panel hud-mission-panel--cyan">
          <div className="hud-panel-header">
            <i className="bx bx-radar" /> Intelligence Gathering
          </div>
          <div className="hud-evidence-grid">
            <div className="hud-evidence-item">
              <i className="bx bx-check-circle" />
              <span><strong className="hud-glow-text">{evidence.filesAnalyzed}</strong> files analyzed</span>
            </div>
            <div className="hud-evidence-item">
              <i className="bx bx-check-circle" />
              <span><strong className="hud-glow-text">{evidence.functionsInspected}</strong> functions inspected</span>
            </div>
            <div className="hud-evidence-item">
              <i className="bx bx-check-circle" />
              <span><strong className="hud-glow-text">{evidence.candidatesRanked}</strong> candidate files ranked</span>
            </div>
            <div className="hud-evidence-item">
              <i className="bx bx-check-circle" />
              <span>Source code extracted structurally</span>
            </div>
          </div>
        </div>
      )}
      
      {/* Why These Files (Detective Mode) */}
      {evidence && evidence.deepFiles && evidence.deepFiles.length > 0 && (
        <DetectiveMode 
          deepFiles={evidence.deepFiles} 
          relatedFiles={evidence.relatedFiles} 
        />
      )}

      {/* Prerequisites */}
      {mission.prerequisites && mission.prerequisites.length > 0 && (
        <div className="hud-mission-section">
          <div className="hud-section-header hud-section-header--yellow">
            <i className="bx bx-list-check" />
            <h3>Prerequisites</h3>
            <span className="hud-section-count">Learn these first</span>
          </div>
          <div className="hud-list-container">
            {mission.prerequisites.map((prereq, i) => (
              <div key={i} className="hud-list-item hud-list-item--yellow">
                <i className="bx bx-right-arrow-alt" />
                <div className="hud-list-item__text">{prereq}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Files You'll Touch */}
      {mission.filesToTouch && mission.filesToTouch.length > 0 && (
        <div className="hud-mission-section">
          <div className="hud-section-header hud-section-header--blue">
            <i className="bx bx-folder-open" />
            <h3>Files You'll Touch</h3>
            <span className="hud-section-count">{mission.filesToTouch.length} files</span>
          </div>
          <div className="hud-cards-grid">
            {mission.filesToTouch.map((file, i) => (
              <div key={i} className="hud-file-card">
                <div className="hud-file-card__path">
                  <i className="bx bx-file" /> {file.path}
                </div>
                <div className="hud-file-card__reason">{file.reason}</div>
                <div className="hud-file-card__scanline" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Known Traps */}
      {mission.knownTraps && mission.knownTraps.length > 0 && (
        <div className="hud-mission-section">
          <div className="hud-section-header hud-section-header--red">
            <i className="bx bx-shield-x" />
            <h3>Known Traps</h3>
            <span className="hud-section-count">{mission.knownTraps.length} warnings</span>
          </div>
          <div className="hud-list-container">
            {mission.knownTraps.map((trap, i) => (
              <div key={i} className="hud-list-item hud-list-item--red">
                <i className="bx bx-error" />
                <div className="hud-list-item__text">{trap}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Route */}
      {mission.routeSteps && mission.routeSteps.length > 0 && (
        <div className="hud-mission-section">
          <div className="hud-section-header hud-section-header--purple">
            <i className="bx bx-compass" />
            <h3>Execution Route</h3>
            <span className="hud-section-count">Recommended execution order</span>
          </div>
          <div className="hud-route-container">
            {mission.routeSteps.map((step, i) => (
              <div key={i} className="hud-route-step">
                <div className="hud-route-step__number">{i + 1}</div>
                <div className="hud-route-step__content">
                  <div className="hud-route-step__label">STEP 0{i + 1}</div>
                  <div className="hud-route-step__action">{step}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function DetectiveMode({ deepFiles, relatedFiles }) {
  const [expanded, setExpanded] = useState(false)
  
  return (
    <div className="hud-mission-section">
      <div 
        className={`hud-detective-trigger ${expanded ? 'hud-detective-trigger--active' : ''}`} 
        onClick={() => setExpanded(!expanded)}
      >
        <i className={`bx ${expanded ? 'bx-chevron-up' : 'bx-chevron-down'}`} />
        EVIDENCE LOG (SEMANTIC RETRIEVAL)
      </div>
      
      {expanded && (
        <div className="hud-detective-content">
          <div className="hud-detective-header">DEEP READ (Target Files)</div>
          <div className="hud-detective-list">
            {deepFiles.map((file, i) => (
              <div key={file} className="hud-detective-item">
                <div className="hud-detective-file">
                  <i className="bx bx-file" /> 
                  <span>{file}</span>
                </div>
                {i < deepFiles.length - 1 && (
                  <div className="hud-detective-link">
                    <i className="bx bx-link" /> semantic dependency
                  </div>
                )}
              </div>
            ))}
          </div>
          
          {relatedFiles && relatedFiles.length > 0 && (
            <>
              <div className="hud-detective-header" style={{ marginTop: '24px' }}>ALSO CONSIDER (Context Files)</div>
              <div className="hud-detective-list">
                {relatedFiles.map((file) => (
                  <div key={file} className="hud-detective-file hud-detective-file--context">
                    <i className="bx bx-folder-open" /> 
                    <span>{file}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}
