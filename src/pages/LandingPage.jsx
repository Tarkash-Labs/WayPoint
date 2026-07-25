import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const EXAMPLES = [
  { label: 'expressjs/express', url: 'https://github.com/expressjs/express' },
  { label: 'pmndrs/zustand', url: 'https://github.com/pmndrs/zustand' },
  { label: 'vitejs/vite', url: 'https://github.com/vitejs/vite' },
]

export default function LandingPage() {
  const [repoUrl, setRepoUrl] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const handleAnalyze = (e) => {
    e.preventDefault()
    const url = repoUrl.trim()

    if (!url) {
      setError('Paste a GitHub repository URL to get started.')
      return
    }

    setError('')
    navigate('/dashboard', { state: { repoUrl: url } })
  }

  const handleExampleClick = (url) => {
    setRepoUrl(url)
    navigate('/dashboard', { state: { repoUrl: url } })
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
              className={`landing__input ${error ? 'landing__input--error' : ''}`}
              placeholder="github.com/owner/repo"
              value={repoUrl}
              onChange={(e) => { setRepoUrl(e.target.value); setError('') }}
              autoFocus
              spellCheck={false}
            />
            <button type="submit" className="landing__btn">
              Analyze <i className="bx bx-right-arrow-alt" />
            </button>
          </div>
          {error && <div className="landing__error"><i className="bx bx-error-circle" /> {error}</div>}
        </form>

        <div className="landing__examples">
          <span>Try a real repo:</span>
          {EXAMPLES.map((ex) => (
            <button
              key={ex.url}
              className="landing__example-chip"
              onClick={() => handleExampleClick(ex.url)}
            >
              <i className="bx bx-git-repo-forked" /> {ex.label}
            </button>
          ))}
        </div>

        <div className="landing__features">
          <div className="landing__feature">
            <div className="landing__feature-icon"><i className="bx bx-target-lock" /></div>
            <div className="landing__feature-title">Mission Brief</div>
            <div className="landing__feature-desc">Know exactly which files matter</div>
          </div>
          <div className="landing__feature">
            <div className="landing__feature-icon"><i className="bx bx-shield-x" /></div>
            <div className="landing__feature-title">Known Traps</div>
            <div className="landing__feature-desc">Avoid production-breaking mistakes</div>
          </div>
          <div className="landing__feature">
            <div className="landing__feature-icon"><i className="bx bx-compass" /></div>
            <div className="landing__feature-title">Route</div>
            <div className="landing__feature-desc">GPS for your codebase</div>
          </div>
        </div>
      </div>
    </div>
  )
}
