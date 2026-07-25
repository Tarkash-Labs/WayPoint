import { useState, useMemo, useRef, Suspense } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { treemap, hierarchy, treemapSquarify } from 'd3-hierarchy'
import ErrorBoundary from '../components/ErrorBoundary'

function Building({ position, size, color, file, isHovered, onHover, onUnhover, onClick }) {
  const meshRef = useRef()
  const height = size[1]

  useFrame(() => {
    if (meshRef.current) {
      const targetScale = isHovered ? 1.08 : 1.0
      meshRef.current.scale.x += (targetScale - meshRef.current.scale.x) * 0.1
      meshRef.current.scale.z += (targetScale - meshRef.current.scale.z) * 0.1
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
        color={isHovered ? '#6366f1' : color}
        emissive={isHovered ? '#4f46e5' : '#000000'}
        emissiveIntensity={isHovered ? 0.4 : 0}
        roughness={0.6}
        metalness={0.15}
      />
    </mesh>
  )
}

function CityFloor({ size }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]}>
      <planeGeometry args={[size, size]} />
      <meshStandardMaterial color="#1a1a2e" roughness={0.95} />
    </mesh>
  )
}

function CityScene({ data, onSelectFile }) {
  const [hoveredFile, setHoveredFile] = useState(null)

  const { buildings, gridSize } = useMemo(() => {
    if (!data?.files || data.files.length === 0) return { buildings: [], gridSize: 20 }

    // Build hierarchy — group files by top-level directory
    const dirMap = {}
    data.files.forEach((file) => {
      const dir = file.directory || file.path?.split('/')[0] || 'root'
      if (!dirMap[dir]) dirMap[dir] = []
      dirMap[dir].push(file)
    })

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

    const size = Math.min(40, Math.max(20, Math.sqrt(data.files.length) * 3))
    const treemapLayout = treemap()
      .size([size, size])
      .padding(0.8)
      .paddingOuter(1.5)
      .tile(treemapSquarify)

    const rootNode = hierarchy(root).sum((d) => d.value)
    treemapLayout(rootNode)

    const leaves = rootNode.leaves().map((leaf) => {
      const w = leaf.x1 - leaf.x0
      const h = leaf.y1 - leaf.y0
      const x = (leaf.x0 + leaf.x1) / 2 - size / 2
      const z = (leaf.y0 + leaf.y1) / 2 - size / 2
      const linesOfCode = leaf.data.file?.linesOfCode || 10
      const buildingHeight = Math.max(linesOfCode / 25, 0.3)

      return {
        position: [x, 0, z],
        size: [Math.max(w * 0.85, 0.1), Math.min(buildingHeight, 15), Math.max(h * 0.85, 0.1)],
        file: leaf.data.file,
        color: getColorForRisk(leaf.data.file?.riskScore || 1),
      }
    })

    return { buildings: leaves, gridSize: size }
  }, [data])

  if (buildings.length === 0) return null

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[20, 30, 10]} intensity={0.7} />
      <directionalLight position={[-10, 20, -10]} intensity={0.25} />
      <pointLight position={[0, 15, 0]} intensity={0.2} color="#6366f1" />

      <CityFloor size={gridSize + 10} />

      {buildings.map((b, i) => (
        <Building
          key={i}
          position={b.position}
          size={b.size}
          color={b.color}
          file={b.file}
          isHovered={hoveredFile === b.file?.path}
          onHover={() => setHoveredFile(b.file?.path)}
          onUnhover={() => setHoveredFile(null)}
          onClick={() => onSelectFile?.(b.file)}
        />
      ))}

      <OrbitControls
        enableDamping
        dampingFactor={0.05}
        maxPolarAngle={Math.PI / 2.1}
        minDistance={5}
        maxDistance={80}
      />

      <fog attach="fog" args={['#0f0f1a', 25, 70]} />
    </>
  )
}

function getColorForRisk(score) {
  if (score >= 8) return '#ef4444'
  if (score >= 6) return '#f59e0b'
  if (score >= 4) return '#3b82f6'
  return '#10b981'
}

function FileTooltip({ file }) {
  if (!file) return null
  return (
    <div className="map-view__tooltip">
      <div className="map-view__tooltip-path"><i className="bx bx-file" /> {file.path}</div>
      <div className="map-view__tooltip-meta">
        <span><i className="bx bx-code-alt" /> {file.linesOfCode || '?'} LOC</span>
        <span style={{ color: getColorForRisk(file.riskScore || 1) }}>
          <i className="bx bx-bolt-circle" /> Risk {file.riskScore || '?'}
        </span>
      </div>
    </div>
  )
}

export default function MapView({ data }) {
  const [selectedFile, setSelectedFile] = useState(null)

  return (
    <ErrorBoundary
      fallbackTitle="Architecture Map unavailable"
      fallbackMessage="The 3D renderer encountered an issue. This doesn't affect your analysis — try another view."
    >
      <div className="map-view">
        <Suspense fallback={
          <div className="analyzing">
            <div className="analyzing__spinner" />
            <div className="analyzing__text">Loading 3D engine...</div>
          </div>
        }>
          <Canvas
            camera={{ position: [25, 25, 25], fov: 45 }}
            style={{ background: '#0f0f1a', borderRadius: 'var(--radius-lg)' }}
            gl={{ antialias: true, alpha: false }}
            dpr={[1, 1.5]}
          >
            <CityScene data={data} onSelectFile={setSelectedFile} />
          </Canvas>
        </Suspense>

        {selectedFile && <FileTooltip file={selectedFile} />}

        <div className="map-view__legend">
          <div className="map-view__legend-item">
            <div className="map-view__legend-dot" style={{ background: '#10b981' }} />
            Low Risk
          </div>
          <div className="map-view__legend-item">
            <div className="map-view__legend-dot" style={{ background: '#3b82f6' }} />
            Medium
          </div>
          <div className="map-view__legend-item">
            <div className="map-view__legend-dot" style={{ background: '#f59e0b' }} />
            High
          </div>
          <div className="map-view__legend-item">
            <div className="map-view__legend-dot" style={{ background: '#ef4444' }} />
            Critical
          </div>
        </div>
      </div>
    </ErrorBoundary>
  )
}
