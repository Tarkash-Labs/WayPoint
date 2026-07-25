import { useState, useMemo, useRef, Suspense } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Edges, MeshReflectorMaterial } from '@react-three/drei'
import { EffectComposer, Bloom, Vignette, ChromaticAberration } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'
import * as THREE from 'three'
import { treemap, hierarchy, treemapSquarify } from 'd3-hierarchy'
import ErrorBoundary from '../components/ErrorBoundary'

/* ── Color system (neon) ──────────────────────────────── */
const RISK_COLORS = {
  critical: { hex: '#ef4444', emissive: '#ef4444', glowMultiplier: 2.5 },
  high:     { hex: '#f97316', emissive: '#f97316', glowMultiplier: 2.0 },
  medium:   { hex: '#eab308', emissive: '#eab308', glowMultiplier: 1.5 },
  low:      { hex: '#3b82f6', emissive: '#3b82f6', glowMultiplier: 1.0 },
}

function getRiskTier(score) {
  if (score >= 8) return 'critical'
  if (score >= 6) return 'high'
  if (score >= 4) return 'medium'
  return 'low'
}
function getRiskColor(score) { return RISK_COLORS[getRiskTier(score)] }

/* ── Cyberpunk Building ───────────────────────────────── */
function CyberBuilding({ position, size, riskColor, file, isHovered, onHover, onUnhover, onClick }) {
  const groupRef = useRef()
  const w = size[0]
  const h = size[1]
  const d = size[2]

  // Deterministic random for architecture variations
  const rand = useMemo(() => Math.abs(Math.sin(position[0] * 12.9898 + position[2] * 78.233)), [position])
  
  const hasAntenna = rand > 0.5
  const isTiered = rand > 0.3 && h > 4
  const isTwin = rand > 0.8 && w > 2.5 && d > 2.5
  
  useFrame((state) => {
    if (!groupRef.current) return
    const t = state.clock.getElapsedTime()
    if (isHovered) {
      groupRef.current.scale.y = 1 + Math.sin(t * 5) * 0.02
    } else {
      groupRef.current.scale.y += (1 - groupRef.current.scale.y) * 0.1
    }
  })

  // We use high emissive values so the Bloom post-processing picks it up and makes it glow
  const materialProps = {
    color: '#050510',
    emissive: riskColor.emissive,
    emissiveIntensity: isHovered ? riskColor.glowMultiplier * 1.5 : riskColor.glowMultiplier * 0.3,
    roughness: 0.1,
    metalness: 0.9,
  }

  // Edge glow is intense for the TRON/Cyberpunk look
  const edgeColor = new THREE.Color(riskColor.emissive).multiplyScalar(isHovered ? 4 : 1.5)

  return (
    <group
      ref={groupRef}
      position={[position[0], 0, position[2]]}
      onPointerOver={(e) => { e.stopPropagation(); onHover() }}
      onPointerOut={onUnhover}
      onClick={(e) => { e.stopPropagation(); onClick() }}
    >
      {isTwin ? (
        <>
          <mesh position={[-w/3.5, h/2, 0]}>
            <boxGeometry args={[w/3, h, d]} />
            <meshStandardMaterial {...materialProps} />
            <Edges threshold={15} color={edgeColor} />
          </mesh>
          <mesh position={[w/3.5, h/2, 0]}>
            <boxGeometry args={[w/3, h, d]} />
            <meshStandardMaterial {...materialProps} />
            <Edges threshold={15} color={edgeColor} />
          </mesh>
          {/* Neon Bridge */}
          <mesh position={[0, h * 0.75, 0]}>
            <boxGeometry args={[w/3, h * 0.05, d * 0.5]} />
            <meshStandardMaterial color="#fff" emissive={riskColor.emissive} emissiveIntensity={5} />
          </mesh>
        </>
      ) : (
        <>
          <mesh position={[0, h / 2, 0]}>
            <boxGeometry args={[w, h, d]} />
            <meshStandardMaterial {...materialProps} />
            <Edges threshold={15} color={edgeColor} />
          </mesh>
          
          {/* Tiered Roof */}
          {isTiered && (
            <mesh position={[0, h + (h * 0.05), 0]}>
              <boxGeometry args={[w * 0.6, h * 0.1, d * 0.6]} />
              <meshStandardMaterial {...materialProps} emissiveIntensity={isHovered ? 3 : 1} />
              <Edges threshold={15} color={edgeColor} />
            </mesh>
          )}
          
          {/* Glowing Antenna */}
          {hasAntenna && (
            <mesh position={[0, h + (isTiered ? h * 0.1 : 0) + 1.5, 0]}>
              <cylinderGeometry args={[0.02, 0.05, 3]} />
              <meshStandardMaterial color="#fff" emissive={riskColor.emissive} emissiveIntensity={10} />
            </mesh>
          )}
        </>
      )}
      
      {/* Holographic selection base */}
      {isHovered && (
        <mesh position={[0, 0.1, 0]}>
          <planeGeometry args={[w + 1, d + 1]} />
          <meshBasicMaterial color={riskColor.hex} transparent opacity={0.3} rotation={[-Math.PI/2, 0, 0]} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  )
}

/* ── District Platform (City Blocks) ──────────────────── */
function DistrictPlatform({ position, size }) {
  return (
    <group position={[position[0], 0, position[2]]}>
      <mesh position={[0, 0.05, 0]} receiveShadow>
        <boxGeometry args={[size[0], 0.1, size[2]]} />
        <meshStandardMaterial color="#020205" roughness={0.9} metalness={0.1} />
        <Edges threshold={15} color="#1e1b4b" />
      </mesh>
      {/* Cyber-grid border */}
      <mesh position={[0, 0.11, 0]}>
        <boxGeometry args={[size[0] - 0.4, 0.02, size[2] - 0.4]} />
        <meshStandardMaterial color="#000" emissive="#3730a3" emissiveIntensity={2} />
      </mesh>
    </group>
  )
}

/* ── Data Streams (Glowing Light Trails) ──────────────── */
function DataStreams({ count = 150, bounds }) {
  const meshRef = useRef()
  const dummy = useMemo(() => new THREE.Object3D(), [])
  
  const streams = useMemo(() => {
    return Array.from({ length: count }, () => ({
      pos: new THREE.Vector3(
        (Math.random() - 0.5) * bounds,
        Math.random() * 25 + 0.5, // Some on ground, some high up
        (Math.random() - 0.5) * bounds
      ),
      speed: (Math.random() + 0.5) * 40,
      dir: Math.random() > 0.5 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 0, 1),
      color: Math.random() > 0.7 ? '#00ffb4' : (Math.random() > 0.5 ? '#06b6d4' : '#f43f5e'),
      length: Math.random() * 4 + 2
    }))
  }, [count, bounds])

  const colors = useMemo(() => {
    const arr = new Float32Array(count * 3)
    const c = new THREE.Color()
    streams.forEach((stream, i) => {
      // Multiply color by high value to trigger Bloom heavily
      c.set(stream.color).multiplyScalar(10)
      c.toArray(arr, i * 3)
    })
    return arr
  }, [streams, count])

  useFrame((state, delta) => {
    if (!meshRef.current) return
    streams.forEach((stream, i) => {
      stream.pos.addScaledVector(stream.dir, stream.speed * delta)
      // Wrap around
      if (stream.pos.x > bounds / 2) stream.pos.x = -bounds / 2
      if (stream.pos.x < -bounds / 2) stream.pos.x = bounds / 2
      if (stream.pos.z > bounds / 2) stream.pos.z = -bounds / 2
      if (stream.pos.z < -bounds / 2) stream.pos.z = bounds / 2
      
      dummy.position.copy(stream.pos)
      // Stretch along movement axis
      dummy.scale.set(
        stream.dir.x ? stream.length : 0.05,
        0.05,
        stream.dir.z ? stream.length : 0.05
      )
      dummy.updateMatrix()
      meshRef.current.setMatrixAt(i, dummy.matrix)
    })
    meshRef.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={meshRef} args={[null, null, count]}>
      <boxGeometry args={[1, 1, 1]}>
        <instancedBufferAttribute attach="attributes-color" args={[colors, 3]} />
      </boxGeometry>
      <meshBasicMaterial vertexColors toneMapped={false} />
    </instancedMesh>
  )
}

/* ── Reflective Cyberpunk Floor ───────────────────────── */
function CyberFloor({ size }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]}>
      <planeGeometry args={[size, size]} />
      <MeshReflectorMaterial
        blur={[400, 100]}
        resolution={1024}
        mixBlur={1}
        mixStrength={4}
        roughness={0.2}
        depthScale={1.2}
        minDepthThreshold={0.4}
        maxDepthThreshold={1.4}
        color="#050510"
        metalness={0.8}
        mirror={1}
      />
    </mesh>
  )
}

/* ── Post-Processing Effects ──────────────────────────── */
function CyberEffects() {
  return (
    <EffectComposer disableNormalPass multisampling={4}>
      <Bloom 
        luminanceThreshold={1.0} // Only glow extremely bright things
        luminanceSmoothing={0.1}
        intensity={2.5}
        radius={0.8}
        mipmapBlur 
      />
      <ChromaticAberration
        blendFunction={BlendFunction.NORMAL}
        offset={[0.001, 0.001]}
      />
      <Vignette eskil={false} offset={0.1} darkness={1.1} />
    </EffectComposer>
  )
}

/* ── Scene ────────────────────────────────────────────── */
function CityScene({ data, onSelectFile, onHoverFile }) {
  const [hoveredFile, setHoveredFile] = useState(null)

  const { buildings, districts, gridSize } = useMemo(() => {
    if (!data?.files?.length) return { buildings: [], districts: [], gridSize: 50 }

    const dirMap = {}
    data.files.forEach((file) => {
      const dir = file.directory || file.path?.split('/')[0] || 'root'
      if (!dirMap[dir]) dirMap[dir] = []
      dirMap[dir].push(file)
    })

    const size = Math.min(100, Math.max(50, Math.sqrt(data.files.length) * 6))

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
      .paddingInner(2)
      .paddingOuter(5)
      .tile(treemapSquarify)

    const rootNode = hierarchy(root).sum((d) => d.value)
    layout(rootNode)

    const buildingList = []
    const districtList = []

    rootNode.each((node) => {
      const w = node.x1 - node.x0
      const d = node.y1 - node.y0
      const x = (node.x0 + node.x1) / 2 - size / 2
      const z = (node.y0 + node.y1) / 2 - size / 2

      if (node.depth === 1) { // District
        districtList.push({
          name: node.data.name,
          position: [x, 0, z],
          size: [w, 0.2, d]
        })
      } else if (!node.children && node.data.file) { // Building
        const f = node.data.file
        const bw = w * 0.8
        const bd = d * 0.8
        // Exaggerated heights for cyberpunk feel
        const h = Math.min(Math.max((f.linesOfCode || 20) / 15, 2), 35)

        buildingList.push({
          position: [x, 0, z],
          size: [Math.max(bw, 0.8), h, Math.max(bd, 0.8)],
          riskColor: getRiskColor(f.riskScore || 1),
          file: f,
        })
      }
    })

    return { buildings: buildingList, districts: districtList, gridSize: size }
  }, [data])

  const handleHover = (file) => {
    setHoveredFile(file?.path || null)
    onHoverFile?.(file)
  }

  return (
    <>
      <color attach="background" args={['#020205']} />
      
      {/* Dark, moody ambient lighting */}
      <ambientLight intensity={0.2} color="#4f46e5" />
      
      {/* Neon highlights */}
      <pointLight position={[0, 60, 0]} intensity={1.5} color="#c084fc" distance={150} />
      <pointLight position={[40, 20, -40]} intensity={2} color="#06b6d4" distance={100} />
      <pointLight position={[-40, 20, 40]} intensity={2} color="#f43f5e" distance={100} />
      
      <CyberFloor size={gridSize + 60} />
      
      <DataStreams count={gridSize * 4} bounds={gridSize + 20} />

      {districts.map((d, i) => (
        <DistrictPlatform key={`d-${i}`} position={d.position} size={d.size} />
      ))}

      {buildings.map((b, i) => (
        <CyberBuilding
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
        maxPolarAngle={Math.PI / 2.1} // Prevent going below ground
        minDistance={20}
        maxDistance={150}
        autoRotate
        autoRotateSpeed={0.8}
      />

      <fog attach="fog" args={['#020205', 40, 150]} />
      
      {/* The magic glow effect */}
      <CyberEffects />
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
        <div className="arch-view__titlebar">
          <span className="arch-view__title">3D Codebase Architecture HUD</span>
        </div>

        <div className="arch-view__canvas-wrap">
          <Suspense fallback={
            <div className="hud-analyzing">
              <div className="hud-analyzing__spinner" />
              <div className="hud-analyzing__text">Loading 3D engine...</div>
            </div>
          }>
            <Canvas
              camera={{ position: [50, 40, 55], fov: 45 }}
              shadows={false}
              gl={{ antialias: false, alpha: false, toneMapping: THREE.NoToneMapping }}
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
