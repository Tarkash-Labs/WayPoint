export default function HotspotsView({ data }) {
  if (!data?.files) return null

  // Sort files by risk score descending
  const hotspots = [...data.files]
    .filter((f) => f.riskScore >= 5)
    .sort((a, b) => b.riskScore - a.riskScore)

  const getRiskColor = (score) => {
    if (score >= 8) return 'var(--color-risk-critical)'
    if (score >= 6) return 'var(--color-risk-high)'
    if (score >= 4) return 'var(--color-risk-medium)'
    return 'var(--color-risk-low)'
  }

  return (
    <div className="hotspots">
      <h2 className="hotspots__heading">🔥 Risk Hotspots</h2>
      <p className="hotspots__subheading">
        Files ranked by risk score. These are the most dangerous files in the codebase — know them before you touch anything.
      </p>

      {hotspots.map((file, i) => (
        <div key={file.path} className="hotspot-card">
          <div className="hotspot-card__rank">#{i + 1}</div>
          <div className="hotspot-card__risk-bar" style={{ background: getRiskColor(file.riskScore) }} />
          <div className="hotspot-card__content">
            <div className="hotspot-card__path">{file.path}</div>
            <div className="hotspot-card__purpose">{file.semanticPurpose}</div>
            <div className="hotspot-card__analysis">
              {file.riskAnalysis}
              {file.prodIncidents > 0 && (
                <span style={{ color: 'var(--color-danger)', fontWeight: 600 }}>
                  {' '}— {file.prodIncidents} production incident{file.prodIncidents > 1 ? 's' : ''}
                </span>
              )}
            </div>
            <div className="hotspot-card__suggestion">
              💡 {file.refactoringSuggestion}
            </div>
          </div>
          <div className="hotspot-card__score">
            <div className="hotspot-card__score-value" style={{ color: getRiskColor(file.riskScore) }}>
              {file.riskScore}
            </div>
            <div className="hotspot-card__score-label">Risk</div>
          </div>
        </div>
      ))}
    </div>
  )
}
