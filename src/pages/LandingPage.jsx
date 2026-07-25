import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function LandingPage() {
  const [repoUrl, setRepoUrl] = useState('')
  const navigate = useNavigate()

  const handleAnalyze = (e) => {
    e.preventDefault()
    // For the hackathon demo, any URL (or empty) goes to the dashboard
    navigate('/dashboard')
  }

  const handleExampleClick = (example) => {
    setRepoUrl(`https://github.com/${example}`)
    // Auto-navigate after a brief moment
    setTimeout(() => navigate('/dashboard'), 300)
  }

  return (
    <div className="landing">
      <div className="landing__content">
        <h1 className="landing__logo">
          <span>Way</span>point
        </h1>
        <p className="landing__tagline">Every task starts with context.</p>

        <form onSubmit={handleAnalyze}>
          <div className="landing__input-group">
            <input
              type="text"
              className="landing__input"
              placeholder="Paste a repository URL..."
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              autoFocus
            />
            <button type="submit" className="landing__btn">
              Analyze
            </button>
          </div>
        </form>

        <div className="landing__examples">
          <span>Try:</span>
          <button
            className="landing__example-chip"
            onClick={() => handleExampleClick('acme/saas-platform')}
          >
            acme/saas-platform
          </button>
          <button
            className="landing__example-chip"
            onClick={() => handleExampleClick('pmndrs/zustand')}
          >
            zustand
          </button>
          <button
            className="landing__example-chip"
            onClick={() => handleExampleClick('expressjs/express')}
          >
            express
          </button>
        </div>

        <div className="landing__features">
          <div className="landing__feature">
            <div className="landing__feature-icon">🎯</div>
            <div className="landing__feature-title">Mission Brief</div>
            <div className="landing__feature-desc">Know exactly which files matter</div>
          </div>
          <div className="landing__feature">
            <div className="landing__feature-icon">⚠️</div>
            <div className="landing__feature-title">Known Traps</div>
            <div className="landing__feature-desc">Avoid production-breaking mistakes</div>
          </div>
          <div className="landing__feature">
            <div className="landing__feature-icon">🧭</div>
            <div className="landing__feature-title">Route</div>
            <div className="landing__feature-desc">GPS for your codebase</div>
          </div>
        </div>
      </div>
    </div>
  )
}
