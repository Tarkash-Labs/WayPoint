import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { selectLocalDirectory } from '../services/localFs'

const EXAMPLES = [
  { label: 'expressjs/express', url: 'https://github.com/expressjs/express', icon: '⬡' },
  { label: 'pmndrs/zustand', url: 'https://github.com/pmndrs/zustand', icon: '◈' },
  { label: 'vitejs/vite', url: 'https://github.com/vitejs/vite', icon: '⚡', arrow: true },
]

/* ── Floating 3D Cube Component ─────────────────── */
function Cube({ style, size = 48, opacity = 0.7 }) {
  return (
    <div className="lp-cube" style={{ ...style, '--cube-size': `${size}px`, opacity }}>
      <div className="lp-cube__face lp-cube__face--front" />
      <div className="lp-cube__face lp-cube__face--back" />
      <div className="lp-cube__face lp-cube__face--left" />
      <div className="lp-cube__face lp-cube__face--right" />
      <div className="lp-cube__face lp-cube__face--top" />
      <div className="lp-cube__face lp-cube__face--bottom" />
    </div>
  )
}

/* ── Floating Code Window ─────────────────────── */
function CodeWindow({ style, lines = [] }) {
  return (
    <div className="lp-code-window" style={style}>
      <div className="lp-code-window__dots">
        <span style={{ background: '#ff5f57' }} />
        <span style={{ background: '#febc2e' }} />
        <span style={{ background: '#28c840' }} />
      </div>
      <div className="lp-code-window__body">
        {lines.map((line, i) => (
          <div key={i} className="lp-code-window__line" style={{ '--line-color': line.color, '--line-width': line.width }}>
            {line.indent && <span style={{ opacity: 0.3, marginRight: 8 }}>{'  '.repeat(line.indent)}</span>}
          </div>
        ))}
      </div>
    </div>
  )
}

/* ── Stars Background Canvas ─────────────────── */
function StarsCanvas() {
  const canvasRef = useRef(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let animFrame
    const stars = Array.from({ length: 120 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.4 + 0.3,
      alpha: Math.random() * 0.6 + 0.1,
      speed: Math.random() * 0.003 + 0.001,
      phase: Math.random() * Math.PI * 2,
    }))

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    const draw = (t) => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      stars.forEach(s => {
        const twinkle = Math.sin(t * s.speed + s.phase) * 0.3 + 0.7
        ctx.beginPath()
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(255,255,255,${s.alpha * twinkle})`
        ctx.fill()
      })
      animFrame = requestAnimationFrame(draw)
    }
    animFrame = requestAnimationFrame(draw)
    return () => {
      cancelAnimationFrame(animFrame)
      window.removeEventListener('resize', resize)
    }
  }, [])
  return <canvas ref={canvasRef} className="lp-stars" />
}

/* ── Main Landing Page ───────────────────────── */
export default function LandingPage() {
  const [repoUrl, setRepoUrl] = useState('')
  const [error, setError] = useState('')
  const [isLocalLoading, setIsLocalLoading] = useState(false)
  const [mounted, setMounted] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 50)
    return () => clearTimeout(t)
  }, [])

  const handleAnalyze = (e) => {
    e.preventDefault()
    const url = repoUrl.trim()
    if (!url) { setError('Paste a GitHub repository URL to get started.'); return }
    setError('')
    navigate('/dashboard', { state: { repoUrl: url } })
  }

  const handleExampleClick = (url) => {
    setRepoUrl(url)
    navigate('/dashboard', { state: { repoUrl: url } })
  }

  const handleLocalProject = async () => {
    try {
      setError(''); setIsLocalLoading(true)
      const localRepoData = await selectLocalDirectory()
      if (localRepoData) {
        navigate('/dashboard', { state: { repoUrl: 'local://workspace' } })
      } else {
        setIsLocalLoading(false)
      }
    } catch (err) {
      console.error(err)
      setError('Could not read local folder. Please try again or use Chrome/Edge.')
      setIsLocalLoading(false)
    }
  }

  return (
    <div className={`lp ${mounted ? 'lp--mounted' : ''}`}>
      {/* Stars */}
      <StarsCanvas />

      {/* Gradient background layers */}
      <div className="lp-bg">
        <div className="lp-bg__wave lp-bg__wave--1" />
        <div className="lp-bg__wave lp-bg__wave--2" />
        <div className="lp-bg__wave lp-bg__wave--3" />
      </div>

      {/* Floating 3D Cubes */}
      <Cube size={72} opacity={0.65} style={{ position: 'absolute', top: '8%', left: '6%', animationDelay: '0s' }} />
      <Cube size={40} opacity={0.5}  style={{ position: 'absolute', top: '22%', left: '18%', animationDelay: '1.2s' }} />
      <Cube size={56} opacity={0.6}  style={{ position: 'absolute', bottom: '20%', left: '5%', animationDelay: '2.1s' }} />
      <Cube size={80} opacity={0.7}  style={{ position: 'absolute', top: '6%', right: '8%', animationDelay: '0.7s' }} />
      <Cube size={44} opacity={0.55} style={{ position: 'absolute', top: '28%', right: '20%', animationDelay: '1.8s' }} />
      <Cube size={36} opacity={0.45} style={{ position: 'absolute', bottom: '28%', right: '6%', animationDelay: '3s' }} />
      <Cube size={52} opacity={0.5}  style={{ position: 'absolute', top: '55%', left: '10%', animationDelay: '0.4s' }} />

      {/* Floating Code Windows */}
      <CodeWindow
        style={{ top: '12%', left: '3%', width: 210, animationDelay: '0.5s' }}
        lines={[
          { color: '#c678dd', width: '60%', indent: 0 },
          { color: '#61afef', width: '80%', indent: 1 },
          { color: '#e5c07b', width: '50%', indent: 2 },
          { color: '#98c379', width: '70%', indent: 1 },
          { color: '#56b6c2', width: '40%', indent: 0 },
          { color: '#c678dd', width: '65%', indent: 1 },
        ]}
      />
      <CodeWindow
        style={{ bottom: '12%', right: '3%', width: 180, animationDelay: '1.5s' }}
        lines={[
          { color: '#61afef', width: '70%', indent: 0 },
          { color: '#e5c07b', width: '55%', indent: 1 },
          { color: '#98c379', width: '85%', indent: 2 },
          { color: '#c678dd', width: '45%', indent: 1 },
        ]}
      />

      {/* Connection lines SVG */}
      <svg className="lp-connections" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="lineGrad1" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#7c3aed" stopOpacity="0" />
            <stop offset="50%" stopColor="#7c3aed" stopOpacity="0.4" />
            <stop offset="100%" stopColor="#7c3aed" stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1="18%" y1="18%" x2="35%" y2="42%" stroke="url(#lineGrad1)" strokeWidth="1" />
        <line x1="75%" y1="15%" x2="62%" y2="40%" stroke="url(#lineGrad1)" strokeWidth="1" />
        <line x1="82%" y1="30%" x2="65%" y2="45%" stroke="url(#lineGrad1)" strokeWidth="1" />
        <line x1="12%" y1="55%" x2="30%" y2="48%" stroke="url(#lineGrad1)" strokeWidth="1" />
      </svg>

      {/* Main content */}
      <main className="lp-main">
        {/* Logo */}
        <div className="lp-logo-large" style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
          <img src="/logo.png" alt="Waypoint Logo" style={{ width: '100%', maxWidth: '280px', borderRadius: '16px', boxShadow: '0 0 40px rgba(99, 102, 241, 0.2)' }} />
        </div>

        {/* Hero Card */}
        <div className="lp-hero-card">
          {/* Neon glow border */}
          <div className="lp-hero-card__glow" />

          {/* Open Local Project Button */}
          <button
            className={`lp-btn-local ${isLocalLoading ? 'lp-btn-local--loading' : ''}`}
            onClick={handleLocalProject}
            disabled={isLocalLoading}
          >
            <span className="lp-btn-local__bg" />
            <span className="lp-btn-local__text">
              {isLocalLoading ? (
                <><span className="lp-spinner" /> Scanning workspace…</>
              ) : (
                'Open Local Project'
              )}
            </span>
          </button>

          {/* Divider */}
          <div className="lp-divider">
            <span className="lp-divider__line" />
            <span className="lp-divider__text">or analyze a repo</span>
            <span className="lp-divider__line" />
          </div>

          {/* Repo Input Row */}
          <form onSubmit={handleAnalyze} className="lp-input-row">
            <input
              type="text"
              className={`lp-input ${error ? 'lp-input--error' : ''}`}
              placeholder="github.com/owner/repo"
              value={repoUrl}
              onChange={(e) => { setRepoUrl(e.target.value); setError('') }}
              spellCheck={false}
            />
            <button type="submit" className="lp-btn-analyze">
              Analyze <span className="lp-btn-analyze__arrow">→</span>
            </button>
          </form>
          {error && <div className="lp-error">{error}</div>}
        </div>

        {/* Example chips */}
        <div className="lp-chips">
          {EXAMPLES.map((ex) => (
            <button key={ex.url} className="lp-chip" onClick={() => handleExampleClick(ex.url)}>
              <span className="lp-chip__icon">
                {ex.label === 'expressjs/express' && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/></svg>
                )}
                {ex.label === 'pmndrs/zustand' && (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="10" opacity="0.3"/><circle cx="12" cy="12" r="5"/></svg>
                )}
                {ex.label === 'vitejs/vite' && (
                  <svg width="14" height="14" viewBox="0 0 32 32" fill="none"><path d="M29.884 6.146l-13.142 23.5a.714.714 0 01-1.244.012L2.096 6.158A.714.714 0 012.75 5h26.5a.714.714 0 01.634 1.146z" fill="#41D1FF"/><path d="M22 5L12 25 8 13l14-8z" fill="#BD34FE" opacity="0.8"/></svg>
                )}
              </span>
              {ex.label}
              {ex.arrow && <span className="lp-chip__arrow">→</span>}
            </button>
          ))}
        </div>

        {/* Feature cards */}
        <div className="lp-features">
          <div className="lp-feature">
            <div className="lp-feature__icon-wrap">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/>
              </svg>
            </div>
            <div className="lp-feature__title">Mission Brief</div>
            <div className="lp-feature__desc">Identify the exact scope and mission prevention.</div>
          </div>
          <div className="lp-feature">
            <div className="lp-feature__icon-wrap">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
            <div className="lp-feature__title">Known Traps</div>
            <div className="lp-feature__desc">Known traps just solve the problems may present.</div>
          </div>
          <div className="lp-feature">
            <div className="lp-feature__icon-wrap">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/>
              </svg>
            </div>
            <div className="lp-feature__title">Route</div>
            <div className="lp-feature__desc">Navigate your way to provide via route.</div>
          </div>
        </div>
      </main>
    </div>
  )
}
