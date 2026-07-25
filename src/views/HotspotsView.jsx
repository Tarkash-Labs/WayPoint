import { useState } from 'react'

/* ── Helpers ──────────────────────────────────────────── */
const getRiskLevel = (score) => {
  if (score >= 8) return 'critical'
  if (score >= 6) return 'high'
  if (score >= 4) return 'medium'
  return 'low'
}
const getRiskLabel = (score) => {
  if (score >= 8) return 'Critical Risk'
  if (score >= 6) return 'High Risk'
  if (score >= 4) return 'Medium Risk'
  return 'Low Risk'
}
const getPurpose = (file) => {
  if (file.semanticPurpose) return file.semanticPurpose
  const p = file.path.toLowerCase()
  if (/auth|login|session|token|oauth/i.test(p)) return 'Authentication & session management'
  if (/route|router|controller/i.test(p)) return 'Route handler or controller logic'
  if (/middleware/i.test(p)) return 'Middleware processing layer'
  if (/model|schema|entity|migration/i.test(p)) return 'Database schema or model'
  if (/config|setup|env/i.test(p)) return 'Configuration & environment setup'
  if (/component|view|page/i.test(p)) return 'UI component or page view'
  if (/service|provider/i.test(p)) return 'Service or provider module'
  if (/util|helper|lib/i.test(p)) return 'Shared utility functions'
  return `Source file (${file.linesOfCode || '?'} LOC)`
}
const getAnalysis = (file) => {
  if (file.riskAnalysis) return file.riskAnalysis
  const r = []
  if (file.linesOfCode > 300) r.push(`Large file (${file.linesOfCode} LOC)`)
  if (/auth|login|payment|billing|token|session/i.test(file.path)) r.push('Security-sensitive path')
  if (/middleware/i.test(file.path)) r.push('Middleware — affects all requests')
  if (/database|migration|schema/i.test(file.path)) r.push('Database layer — hard to reverse')
  if (/config|env|secret/i.test(file.path)) r.push('Config — misconfiguration breaks everything')
  if (!r.length) r.push(`Risk score ${file.riskScore}/10`)
  return r.join('. ') + '.'
}
const getSuggestion = (file) => {
  if (file.refactoringSuggestion) return file.refactoringSuggestion
  if (file.linesOfCode > 500) return 'Consider splitting into smaller, focused modules to reduce coupling and improve testability.'
  if (/auth|login/i.test(file.path)) return 'Ensure proper input validation, rate limiting, and a thorough security review before touching this file.'
  if (/config/i.test(file.path)) return 'Extract custom plugins and environment-specific configurations into separate helper files within a `build/` directory to keep the main configuration clean and maintainable.'
  return 'Review carefully before making changes — this is a high-impact file.'
}

/* Mock code preview generator */
const getCodePreview = (file) => {
  const ext = file.path.split('.').pop()
  const name = file.path.split('/').pop()
  if (/config/i.test(file.path)) {
    return `import { defineConfig } from 'vite';\n\n...\n\nexport default defineConfig({\n  // ... complex config\n  ...\n})`
  }
  if (/auth|login/i.test(file.path)) {
    return `import { verifyToken } from './utils';\n\nexport async function authenticate(req, res) {\n  const token = req.headers.authorization;\n  // ... validation logic\n  const user = await verifyToken(token);\n  return user;\n}`
  }
  if (/database|connect/i.test(file.path)) {
    return `import { createPool } from 'pg';\n\nconst pool = createPool({\n  connectionString: process.env.DATABASE_URL,\n  // ... pool config\n  max: 20,\n  idleTimeoutMillis: 30000,\n})`
  }
  return `// ${name}\n\nexport default class ${name.replace(/\.[^.]+$/, '')} {\n  constructor(options = {}) {\n    // ... initialization\n    this.config = options;\n  }\n\n  // ... methods\n}`
}

/* ── Deep Dive Panel ──────────────────────────────────── */
function DeepDivePanel({ file, onClose, getPurpose, getAnalysis, getSuggestion }) {
  if (!file) return null
  const fileName = file.path.split('/').pop()
  const level = getRiskLevel(file.riskScore)
  const suggestion = getSuggestion(file)

  return (
    <div className="hs-deep-dive">
      {/* Header */}
      <div className="hs-deep-dive__header">
        <div className="hs-deep-dive__title">
          Deep Dive: <span className="hs-deep-dive__filename">{fileName}</span>
        </div>
        <button className="hs-deep-dive__close" onClick={onClose} aria-label="Close">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      {/* Code block */}
      <div className="hs-code-block">
        <div className="hs-code-block__bar">
          <span className="hs-code-block__dot" style={{ background: '#ff5f57' }} />
          <span className="hs-code-block__dot" style={{ background: '#febc2e' }} />
          <span className="hs-code-block__dot" style={{ background: '#28c840' }} />
          <span className="hs-code-block__lang">{file.path.split('.').pop()}</span>
        </div>
        <pre className="hs-code-block__code">
          <code dangerouslySetInnerHTML={{ __html: syntaxHighlight(getCodePreview(file)) }} />
        </pre>
      </div>

      {/* AI Suggestion */}
      <div className="hs-deep-dive__section">
        <div className="hs-deep-dive__section-title">AI Suggestion:</div>
        <p className="hs-deep-dive__suggestion">{suggestion}</p>
      </div>

      {/* Risk Analysis */}
      <div className="hs-deep-dive__section">
        <div className="hs-deep-dive__section-title">Risk Analysis</div>
        <p className="hs-deep-dive__analysis">{getAnalysis(file)}</p>
      </div>

      {/* Metadata chips */}
      <div className="hs-deep-dive__meta">
        <span className={`hs-risk-badge hs-risk-badge--${level}`}>{getRiskLabel(file.riskScore)}</span>
        <span className="hs-deep-dive__loc">{file.linesOfCode || '?'} lines</span>
        {(file.prodIncidents || 0) > 0 && (
          <span className="hs-deep-dive__incidents">
            ⚠ {file.prodIncidents} incident{file.prodIncidents > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Action buttons */}
      <div className="hs-deep-dive__actions">
        <button className="hs-btn hs-btn--primary">Apply Refactor</button>
        <button className="hs-btn hs-btn--ghost">View Diff</button>
      </div>
    </div>
  )
}

/* Very basic syntax highlighter */
function syntaxHighlight(code) {
  return code
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/('.*?'|".*?")/g, '<span style="color:#98c379">$1</span>')
    .replace(/\b(import|export|default|from|const|let|var|function|class|async|await|return|new|if|else)\b/g,
      '<span style="color:#c678dd">$1</span>')
    .replace(/\b(defineConfig|createPool)\b/g, '<span style="color:#61afef">$1</span>')
    .replace(/(\/\/.*$)/gm, '<span style="color:#5c6370;font-style:italic">$1</span>')
    .replace(/\.\.\./g, '<span style="color:#56b6c2">...</span>')
}

/* ── Main HotspotsView ───────────────────────────────── */
export default function HotspotsView({ data }) {
  const [selectedFile, setSelectedFile] = useState(null)

  if (!data?.files) return null

  const hotspots = [...data.files]
    .filter((f) => f.riskScore >= 3)
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 20)

  if (!hotspots.length) {
    return (
      <div className="hs-view hs-view--empty">
        <div style={{ fontSize: '2.5rem' }}>✅</div>
        <div className="hs-empty-title">All Clear</div>
        <div className="hs-empty-desc">
          {data.files.length} files analyzed — no critical hotspots found.
        </div>
      </div>
    )
  }

  const high   = hotspots.filter(f => f.riskScore >= 6).length
  const medium = hotspots.filter(f => f.riskScore >= 4 && f.riskScore < 6).length

  return (
    <div className="hs-view">
      {/* Left: List panel */}
      <div className={`hs-list-panel ${selectedFile ? 'hs-list-panel--narrowed' : ''}`}>
        {/* Summary header */}
        <div className="hs-summary">
          <div className="hs-summary__label">Risk Hotspots:</div>
          <div className="hs-summary__counts">
            {high > 0 && <span className="hs-summary__count hs-summary__count--high">{high} High,</span>}
            {medium > 0 && <span className="hs-summary__count hs-summary__count--medium">&nbsp;{medium} Medium</span>}
          </div>
        </div>

        {/* File cards */}
        <div className="hs-cards">
          {hotspots.map((file, i) => {
            const level = getRiskLevel(file.riskScore)
            const isSelected = selectedFile?.path === file.path
            return (
              <button
                key={file.path}
                className={`hs-card hs-card--${level} ${isSelected ? 'hs-card--selected' : ''}`}
                onClick={() => setSelectedFile(isSelected ? null : file)}
              >
                {/* Top row */}
                <div className="hs-card__top">
                  <span className="hs-card__rank">#{i + 1}</span>
                  <span className="hs-card__path">{file.path}</span>
                  <span className="hs-card__loc">{file.linesOfCode || '?'} lines</span>
                  <span className={`hs-risk-badge hs-risk-badge--${level}`}>
                    {file.riskScore} {getRiskLabel(file.riskScore)}
                  </span>
                </div>

                {/* Incident row */}
                {(file.prodIncidents || 0) > 0 && (
                  <div className="hs-card__incident">
                    <span className="hs-card__incident-num">{file.prodIncidents}</span>
                    <div className="hs-card__incident-info">
                      <span className="hs-card__incident-label">
                        production incident{file.prodIncidents > 1 ? 's' : ''}
                      </span>
                      <span className="hs-card__incident-desc">{getPurpose(file)}</span>
                    </div>
                  </div>
                )}

                {/* Purpose row (if no incidents) */}
                {(file.prodIncidents || 0) === 0 && (
                  <div className="hs-card__purpose">{getPurpose(file)}</div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Right: Deep dive panel */}
      {selectedFile && (
        <DeepDivePanel
          file={selectedFile}
          onClose={() => setSelectedFile(null)}
          getPurpose={getPurpose}
          getAnalysis={getAnalysis}
          getSuggestion={getSuggestion}
        />
      )}
    </div>
  )
}
