import { useState, useEffect, useRef } from 'react'

/* ── Stage definitions ───────────────────────────────── */
const STAGES = [
  { id: 'fetch',    label: 'Understanding repository...', side: 'left',  icon: CloudIcon },
  { id: 'tree',     label: 'Framework detected',          side: 'right', icon: FrameworkIcon },
  { id: 'analyze',  label: 'Dependency graph built',      side: 'left',  icon: SearchIcon },
  { id: 'dirs',     label: 'Candidate files ranked',      side: 'right', icon: FolderIcon },
  { id: 'ai',       label: 'Reading source code',         side: 'left',  icon: BookIcon },
  { id: 'hotspots', label: 'Generating mission plan',     side: 'right', icon: RocketIcon },
  { id: 'done',     label: 'Ready',                       side: 'left',  icon: CheckIcon },
]

/* ── Inline SVG icons ─────────────────────────────────── */
function CloudIcon()     { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M18 10h-1.26A8 8 0 109 20h9a5 5 0 000-10z"/></svg> }
function FrameworkIcon() { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg> }
function SearchIcon()    { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> }
function FolderIcon()    { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg> }
function BookIcon()      { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 19.5A2.5 2.5 0 016.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z"/></svg> }
function RocketIcon()    { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 00-2.91-.09z"/><path d="M12 15l-3-3a22 22 0 012-3.95A12.88 12.88 0 0122 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 01-4 2z"/><path d="M9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0"/><path d="M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5"/></svg> }
function CheckIcon()     { return <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg> }

/* ── DNA Helix Canvas ─────────────────────────────────── */
function DNAHelix({ height }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let raf
    let t = 0

    const W = canvas.width  = 120
    canvas.height = height || 480
    const H = canvas.height
    const cx = W / 2

    const draw = () => {
      ctx.clearRect(0, 0, W, H)
      const amplitude = 40
      const period = 120    // pixels per full cycle
      const nodeCount = 14

      // Draw rungs (horizontal connections between strands)
      for (let i = 0; i < nodeCount * 2; i++) {
        const y = (i / (nodeCount * 2)) * H
        const phase = (y / period) * Math.PI * 2 + t
        const x1 = cx + Math.sin(phase) * amplitude
        const x2 = cx + Math.sin(phase + Math.PI) * amplitude
        const depth = Math.sin(phase)

        if (Math.abs(depth) < 0.3) {
          ctx.beginPath()
          ctx.moveTo(x1, y)
          ctx.lineTo(x2, y)
          const alpha = (1 - Math.abs(depth)) * 0.35
          ctx.strokeStyle = `rgba(0, 255, 180, ${alpha})`
          ctx.lineWidth = 1.2
          ctx.stroke()
        }
      }

      // Draw two strands
      for (let strand = 0; strand < 2; strand++) {
        const phaseOffset = strand === 0 ? 0 : Math.PI

        ctx.beginPath()
        for (let y = 0; y <= H; y += 2) {
          const phase = (y / period) * Math.PI * 2 + t + phaseOffset
          const x = cx + Math.sin(phase) * amplitude
          if (y === 0) ctx.moveTo(x, y)
          else ctx.lineTo(x, y)
        }

        const grad = ctx.createLinearGradient(0, 0, 0, H)
        if (strand === 0) {
          grad.addColorStop(0,   'rgba(0,255,180,0)')
          grad.addColorStop(0.2, 'rgba(0,255,180,0.9)')
          grad.addColorStop(0.8, 'rgba(0,220,255,0.9)')
          grad.addColorStop(1,   'rgba(0,220,255,0)')
        } else {
          grad.addColorStop(0,   'rgba(0,220,255,0)')
          grad.addColorStop(0.2, 'rgba(0,220,255,0.9)')
          grad.addColorStop(0.8, 'rgba(0,255,180,0.9)')
          grad.addColorStop(1,   'rgba(0,255,180,0)')
        }
        ctx.strokeStyle = grad
        ctx.lineWidth = 2.5
        ctx.shadowColor = strand === 0 ? 'rgba(0,255,180,0.6)' : 'rgba(0,220,255,0.6)'
        ctx.shadowBlur = 8
        ctx.stroke()
        ctx.shadowBlur = 0

        // Draw nodes (circles on the strand)
        for (let i = 0; i <= nodeCount; i++) {
          const y = (i / nodeCount) * H
          const phase = (y / period) * Math.PI * 2 + t + phaseOffset
          const x = cx + Math.sin(phase) * amplitude
          const depth = Math.sin(phase)
          const r = 3 + depth * 1.5

          ctx.beginPath()
          ctx.arc(x, y, Math.max(1, r), 0, Math.PI * 2)
          const nodeAlpha = 0.5 + depth * 0.4
          ctx.fillStyle = strand === 0
            ? `rgba(0,255,180,${nodeAlpha})`
            : `rgba(0,220,255,${nodeAlpha})`
          ctx.shadowColor = strand === 0 ? '#00ffb4' : '#00dcff'
          ctx.shadowBlur = 10
          ctx.fill()
          ctx.shadowBlur = 0
        }
      }

      t += 0.018
      raf = requestAnimationFrame(draw)
    }

    raf = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(raf)
  }, [height])

  return (
    <canvas
      ref={canvasRef}
      className="dna-helix__canvas"
    />
  )
}

/* ── Stage Card ────────────────────────────────────────── */
function StageCard({ stage, status, idx }) {
  const Icon = stage.icon
  return (
    <div
      className={`dna-stage dna-stage--${stage.side} dna-stage--${status}`}
      style={{ '--delay': `${idx * 0.08}s` }}
    >
      <div className="dna-stage__card">
        <span className="dna-stage__label">{stage.label}</span>
        <span className="dna-stage__icon">
          {status === 'complete' ? <CheckIcon /> : <Icon />}
        </span>
      </div>
    </div>
  )
}

/* ── Main AnalysisLoader ──────────────────────────────── */
export default function AnalysisLoader({ currentStage, repoName, error }) {
  const currentIdx = STAGES.findIndex((s) => s.id === currentStage)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setMounted(true), 80)
    return () => clearTimeout(t)
  }, [])

  if (error) {
    return (
      <div className="dna-loader dna-loader--error">
        <div className="dna-loader__error-icon">⚠</div>
        <div className="dna-loader__error-title">Analysis Failed</div>
        <div className="dna-loader__error-msg">{error}</div>
      </div>
    )
  }

  return (
    <div className={`dna-loader ${mounted ? 'dna-loader--mounted' : ''}`}>
      {/* Title */}
      <div className="dna-loader__header">
        {repoName && (
          <div className="dna-loader__repo">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 00-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0020 4.77 5.07 5.07 0 0019.91 1S18.73.65 16 2.48a13.38 13.38 0 00-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 005 4.77a5.44 5.44 0 00-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 009 18.13V22"/></svg>
            {repoName}
          </div>
        )}
        <h2 className="dna-loader__title">
          {currentStage === 'done' ? 'Ready' : 'Analyzing Repository'}
        </h2>
        <p className="dna-loader__subtitle">
          AI-powered codebase analysis and developer onboarding
        </p>
      </div>

      {/* DNA + steps layout */}
      <div className="dna-loader__body">
        {/* Left column */}
        <div className="dna-col dna-col--left">
          {STAGES.filter((s) => s.side === 'left').map((stage) => {
            const idx = STAGES.findIndex((s) => s.id === stage.id)
            const status = idx < currentIdx ? 'complete' : idx === currentIdx ? 'active' : 'pending'
            return <StageCard key={stage.id} stage={stage} status={status} idx={idx} />
          })}
        </div>

        {/* DNA Helix */}
        <div className="dna-col dna-col--center">
          <DNAHelix height={420} />
        </div>

        {/* Right column */}
        <div className="dna-col dna-col--right">
          {STAGES.filter((s) => s.side === 'right').map((stage) => {
            const idx = STAGES.findIndex((s) => s.id === stage.id)
            const status = idx < currentIdx ? 'complete' : idx === currentIdx ? 'active' : 'pending'
            return <StageCard key={stage.id} stage={stage} status={status} idx={idx} />
          })}
        </div>
      </div>
    </div>
  )
}
