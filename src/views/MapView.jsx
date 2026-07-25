import { useState, useMemo, useRef, useEffect, Suspense } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { treemap, hierarchy, treemapSquarify } from 'd3-hierarchy'
import ErrorBoundary from '../components/ErrorBoundary'

/* ── Color system (neon) ──────────────────────────────── */
const RISK_COLORS = {
  critical: { hex: '#ef4444', emissive: '#b91c1c', neon: 'rgba(239,68,68,0.8)' },
  high:     { hex: '#f97316', emissive: '#c2410c', neon: 'rgba(249,115,22,0.8)' },
  medium:   { hex: '#eab308', emissive: '#a16207', neon: 'rgba(234,179,8,0.8)' },
  low:      { hex: '#3b82f6', emissive: '#1d4ed8', neon: 'rgba(59,130,246,0.8)' },
}

function getRiskTier(score) {
  if (score >= 8) return 'critical'
  if (score >= 6) return 'high'
  if (score >= 4) return 'medium'
  return 'low'
}
function getRiskColor(score) { return RISK_COLORS[getRiskTier(score)] }

/* ── Neon Building ────────────────────────────────────── */
function NeonBuilding({ position, size, riskColor, file, isHovered, onHover, onUnhover, onClick }) {
  const meshRef = useRef()
  const height = size[1]

  useFrame((state) => {
    if (!meshRef.current) return
    const t = state.clock.getElapsedTime()
    // Gentle breathing when hovered
    if (isHovered) {
      meshRef.current.scale.y = 1 + Math.sin(t * 3) * 0.015
    } else {
      meshRef.current.scale.y += (1 - meshRef.current.scale.y) * 0.1
    }
  })

  return (
    <mesh
      ref={meshRef}
      position={[position[0], height / 2, position[2]]}
      onPointerOver={(e) => { e.stopPropagation(); onHover() }}
      onPointerOut={onUnhover}
      onClick={(e) => { e.stopPropagation(); onClick() }}
    >
      <boxGeometry args={[size[0], height, size[2]]} />
      <meshStandardMaterial
        color={riskColor.hex}
        emissive={riskColor.emissive}
        emissiveIntensity={isHovered ? 1.2 : 0.6}
        roughness={0.15}
        metalness={0.7}
      />
    </mesh>
  )
}

/* ── Neon Grid Floor ──────────────────────────────────── */
function NeonGridFloor({ size }) {
  return (
    <>
      {/* Black base */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[size, size]} />
        <meshStandardMaterial color="#05050f" roughness={1} />
      </mesh>
      {/* Neon grid */}
      <gridHelper
        args={[size, Math.floor(size / 2), '#1e1b4b', '#1e1b4b']}
        position={[0, 0, 0]}
      />
      <gridHelper
        args={[size, Math.floor(size / 4), '#3730a3', '#3730a3']}
        position={[0, 0, 0]}
      />
    </>
  )
}

/* ── Scene ────────────────────────────────────────────── */
function CityScene({ data, onSelectFile, onHoverFile }) {
  const [hoveredFile, setHoveredFile] = useState(null)

  const { buildings, gridSize } = useMemo(() => {
    if (!data?.files?.length) return { buildings: [], gridSize: 30 }

    const dirMap = {}
    data.files.forEach((file) => {
      const dir = file.directory || file.path?.split('/')[0] || 'root'
      if (!dirMap[dir]) dirMap[dir] = []
      dirMap[dir].push(file)
    })

    const size = Math.min(60, Math.max(30, Math.sqrt(data.files.length) * 4))

    const root = {
      name: 'root',
      children: Object.entries(dirMap).map(([dir, files]) => ({
        name: dir,
        children: files.map((f) => ({
          name: f.path,
          value: Math.max(f.linesOfCode || 10, 10),
          file: f,
        })),
      })),
    }

    const layout = treemap()
      .size([size, size])
      .paddingInner(1.2)
      .paddingOuter(3)
      .tile(treemapSquarify)

    const rootNode = hierarchy(root).sum((d) => d.value)
    layout(rootNode)

    const buildingList = []
    rootNode.each((node) => {
      if (!node.children && node.data.file) {
        const f = node.data.file
        const w = (node.x1 - node.x0) * 0.75
        const d = (node.y1 - node.y0) * 0.75
        const x = (node.x0 + node.x1) / 2 - size / 2
        const z = (node.y0 + node.y1) / 2 - size / 2
        const h = Math.min(Math.max((f.linesOfCode || 20) / 25, 0.4), 20)

        buildingList.push({
          position: [x, 0, z],
          size: [Math.max(w, 0.3), h, Math.max(d, 0.3)],
          riskColor: getRiskColor(f.riskScore || 1),
          file: f,
        })
      }
    })

    return { buildings: buildingList, gridSize: size }
  }, [data])

  const handleHover = (file) => {
    setHoveredFile(file?.path || null)
    onHoverFile?.(file)
  }

  return (
    <>
      {/* Neon ambient lighting */}
      <ambientLight intensity={0.15} color="#0a0a2e" />
      <pointLight position={[0, 40, 0]} intensity={0.8} color="#4f46e5" />
      <pointLight position={[20, 20, -20]} intensity={0.6} color="#ef4444" />
      <pointLight position={[-20, 20, 20]} intensity={0.6} color="#3b82f6" />
      <pointLight position={[20, 20, 20]} intensity={0.4} color="#f97316" />
      <pointLight position={[-20, 20, -20]} intensity={0.4} color="#eab308" />

      <NeonGridFloor size={gridSize + 20} />

      {buildings.map((b, i) => (
        <NeonBuilding
          key={`b-${i}`}
          position={b.position}
          size={b.size}
          riskColor={b.riskColor}
          file={b.file}
          isHovered={hoveredFile === b.file?.path}
          onHover={() => handleHover(b.file)}
          onUnhover={() => handleHover(null)}
          onClick={() => onSelectFile?.(b.file)}
        />
      ))}

      <OrbitControls
        enableDamping
        dampingFactor={0.05}
        maxPolarAngle={Math.PI / 2.15}
        minDistance={12}
        maxDistance={100}
        autoRotate
        autoRotateSpeed={0.4}
      />

      <fog attach="fog" args={['#05050f', 40, 100]} />
    </>
  )
}

/* ── HUD Stats Panel ──────────────────────────────────── */
function StatsPanel({ data }) {
  if (!data?.repo) return null
  return (
    <div className="arch-hud-panel arch-hud-panel--tl">
      <div className="arch-hud-panel__label">STATS</div>
      <div className="arch-hud-panel__row">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
        <span>Files</span>
        <span className="arch-hud-panel__val">{data.repo.totalFiles}</span>
      </div>
      <div className="arch-hud-panel__row">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
        <span>Lines of Code</span>
        <span className="arch-hud-panel__val">{data.repo.totalLOC?.toLocaleString()}</span>
      </div>
      <div className="arch-hud-panel__row">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
        <span>Difficulty</span>
        <span className="arch-hud-panel__val" style={{
          color: data.repo.difficulty === 'High' ? '#ef4444' : data.repo.difficulty === 'Medium' ? '#f59e0b' : '#34d399'
        }}>{data.repo.difficulty || 'Low'}</span>
      </div>
    </div>
  )
}

/* ── HUD Legend Panel ─────────────────────────────────── */
function LegendPanel() {
  const items = [
    { label: 'Critical', color: RISK_COLORS.critical.hex },
    { label: 'High',     color: RISK_COLORS.high.hex },
    { label: 'Medium',   color: RISK_COLORS.medium.hex },
    { label: 'Low',      color: RISK_COLORS.low.hex },
  ]
  return (
    <div className="arch-hud-panel arch-hud-panel--tr">
      <div className="arch-hud-panel__label">LEGEND</div>
      {items.map(({ label, color }) => (
        <div key={label} className="arch-hud-panel__row">
          <span className="arch-hud-panel__dot" style={{ background: color, boxShadow: `0 0 6px ${color}` }} />
          <span>{label}</span>
        </div>
      ))}
    </div>
  )
}

/* ── HUD Status Bar ───────────────────────────────────── */
function StatusBar({ data, selectedFile }) {
  return (
    <div className="arch-hud-status">
      <div className="arch-hud-status__indicator">HUD STATUS: <span className="arch-hud-status__active">ACTIVE.</span></div>
      {selectedFile ? (
        <>
          <div className="arch-hud-status__name">{selectedFile.path}</div>
          <div className="arch-hud-status__meta">
            {selectedFile.linesOfCode || '?'} lines of code · Risk score {selectedFile.riskScore || '?'}/10
          </div>
        </>
      ) : (
        <>
          <div className="arch-hud-status__name">{data?.repo?.name || 'Repository'}.</div>
          <div className="arch-hud-status__meta">Buildings=Files, Height=Lines of Code, Color=Risk Level.</div>
        </>
      )}
    </div>
  )
}

/* ── Main MapView ─────────────────────────────────────── */
export default function MapView({ data }) {
  const [selectedFile, setSelectedFile] = useState(null)
  const [hoveredFile, setHoveredFile] = useState(null)

  return (
    <ErrorBoundary
      fallbackTitle="Architecture Map unavailable"
      fallbackMessage="The 3D renderer encountered an issue. Try another view."
    >
      <div className="arch-view">
        {/* Title bar */}
        <div className="arch-view__titlebar">
          <span className="arch-view__title">3D Codebase Architecture HUD</span>
        </div>

        {/* Canvas */}
        <div className="arch-view__canvas-wrap">
          <Suspense fallback={
            <div className="hud-analyzing">
              <div className="hud-analyzing__spinner" />
              <div className="hud-analyzing__text">Loading 3D engine...</div>
            </div>
          }>
            <Canvas
              camera={{ position: [30, 28, 35], fov: 42 }}
              shadows={false}
              style={{ background: '#05050f' }}
              gl={{ antialias: true, alpha: false }}
              dpr={[1, 1.5]}
            >
              <CityScene
                data={data}
                onSelectFile={setSelectedFile}
                onHoverFile={setHoveredFile}
              />
            </Canvas>
          </Suspense>

          {/* Overlay HUD panels */}
          <StatsPanel data={data} />
          <LegendPanel />
          <StatusBar data={data} selectedFile={selectedFile || hoveredFile} />
        </div>
      </div>
    </ErrorBoundary>
  )
}
