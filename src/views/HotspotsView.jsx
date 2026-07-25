export default function HotspotsView({ data }) {
  if (!data?.files) return null

  const hotspots = [...data.files]
    .filter((f) => f.riskScore >= 3)
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 25)

  const getRiskColor = (score) => {
    if (score >= 8) return 'var(--color-risk-critical)'
    if (score >= 6) return 'var(--color-risk-high)'
    if (score >= 4) return 'var(--color-risk-medium)'
    return 'var(--color-risk-low)'
  }

  const getRiskLabel = (score) => {
    if (score >= 8) return 'Critical'
    if (score >= 6) return 'High'
    if (score >= 4) return 'Medium'
    return 'Low'
  }

  // Generate a heuristic purpose if AI didn't provide one
  const getPurpose = (file) => {
    if (file.semanticPurpose) return file.semanticPurpose
    const p = file.path.toLowerCase()
    if (/auth|login|session|token|oauth/i.test(p)) return 'Authentication and session management'
    if (/route|router|controller/i.test(p)) return 'Route handler or controller logic'
    if (/middleware/i.test(p)) return 'Middleware processing layer'
    if (/model|schema|entity|migration/i.test(p)) return 'Database schema or model definition'
    if (/config|setup|env/i.test(p)) return 'Configuration and environment setup'
    if (/component|view|page/i.test(p)) return 'UI component or page view'
    if (/service|provider/i.test(p)) return 'Service or provider module'
    if (/util|helper|lib/i.test(p)) return 'Shared utility functions'
    if (/test|spec/i.test(p)) return 'Test or specification file'
    return `Source file (${file.linesOfCode || '?'} LOC)`
  }

  const getAnalysis = (file) => {
    if (file.riskAnalysis) return file.riskAnalysis
    const reasons = []
    if (file.linesOfCode > 500) reasons.push(`Large file (${file.linesOfCode} LOC)`)
    if (/auth|login|payment|billing|token|session/i.test(file.path)) reasons.push('Security-sensitive path')
    if (/middleware/i.test(file.path)) reasons.push('Middleware — affects all requests')
    if (/database|migration|schema/i.test(file.path)) reasons.push('Database layer — changes are hard to reverse')
    if (/config|env|secret/i.test(file.path)) reasons.push('Configuration — misconfiguration can break everything')
    if (reasons.length === 0) reasons.push(`Risk score ${file.riskScore}/10 based on path and file size`)
    return reasons.join('. ') + '.'
  }

  const getSuggestion = (file) => {
    if (file.refactoringSuggestion) return file.refactoringSuggestion
    if (file.linesOfCode > 500) return 'Consider splitting into smaller, focused modules'
    if (/auth|login/i.test(file.path)) return 'Ensure proper input validation and security review'
    if (/config/i.test(file.path)) return 'Validate all config values at startup and add schema checking'
    return 'Review before making changes — high-impact file'
  }

  if (hotspots.length === 0) {
    return (
      <div className="hotspots">
        <h2 className="hotspots__heading"><i className="bx bxs-flame" /> Risk Hotspots</h2>
        <p className="hotspots__subheading">
          No high-risk files detected in this codebase. This is a good sign — the repository appears to be well-structured.
        </p>
        <div style={{ 
          display: 'flex', flexDirection: 'column', alignItems: 'center', 
          padding: '48px 24px', color: 'var(--color-text-secondary)' 
        }}>
          <i className="bx bx-check-shield" style={{ fontSize: '48px', color: 'var(--color-success)', marginBottom: '12px' }} />
          <div style={{ fontSize: 'var(--text-lg)', fontWeight: 600, color: 'var(--color-text-primary)' }}>
            All Clear
          </div>
          <div style={{ fontSize: 'var(--text-sm)', marginTop: '4px' }}>
            {data.files.length} files analyzed — no critical hotspots found.
          </div>
        </div>
      </div>
    )
  }

  // Summary stats
  const critical = hotspots.filter(f => f.riskScore >= 8).length
  const high = hotspots.filter(f => f.riskScore >= 6 && f.riskScore < 8).length
  const medium = hotspots.filter(f => f.riskScore >= 4 && f.riskScore < 6).length

  return (
    <div className="hotspots">
      <h2 className="hotspots__heading"><i className="bx bxs-flame" /> Risk Hotspots</h2>
      <p className="hotspots__subheading">
        Files ranked by risk score. These are the most dangerous files in the codebase — know them before you touch anything.
      </p>

      {/* Risk summary bar */}
      <div style={{ 
        display: 'flex', gap: '16px', marginBottom: '20px', padding: '12px 16px',
        background: 'var(--color-surface)', border: '1px solid var(--color-border)',
        borderRadius: 'var(--radius-md)', fontSize: 'var(--text-sm)'
      }}>
        {critical > 0 && (
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--color-risk-critical)' }} />
            <strong>{critical}</strong> Critical
          </span>
        )}
        {high > 0 && (
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--color-risk-high)' }} />
            <strong>{high}</strong> High
          </span>
        )}
        {medium > 0 && (
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--color-risk-medium)' }} />
            <strong>{medium}</strong> Medium
          </span>
        )}
        <span style={{ marginLeft: 'auto', color: 'var(--color-text-secondary)' }}>
          {hotspots.length} of {data.files.length} files flagged
        </span>
      </div>

      {hotspots.map((file, i) => (
        <div key={file.path} className="hotspot-card">
          <div className="hotspot-card__rank">#{i + 1}</div>
          <div className="hotspot-card__risk-bar" style={{ background: getRiskColor(file.riskScore) }} />
          <div className="hotspot-card__content">
            <div className="hotspot-card__path"><i className="bx bx-file" /> {file.path}</div>
            <div className="hotspot-card__purpose">{getPurpose(file)}</div>
            <div className="hotspot-card__analysis">
              {getAnalysis(file)}
              {(file.prodIncidents || 0) > 0 && (
                <span style={{ color: 'var(--color-danger)', fontWeight: 600 }}>
                  {' '}— <i className="bx bx-error-circle" /> {file.prodIncidents} production incident{file.prodIncidents > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <div className="hotspot-card__suggestion">
              <i className="bx bx-bulb" /> {getSuggestion(file)}
            </div>
          </div>
          <div className="hotspot-card__score">
            <div className="hotspot-card__score-value" style={{ color: getRiskColor(file.riskScore) }}>
              {file.riskScore}
            </div>
            <div className="hotspot-card__score-label">{getRiskLabel(file.riskScore)}</div>
          </div>
        </div>
      ))}
    </div>
  )
}
