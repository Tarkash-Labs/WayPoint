import { useState, useMemo, useRef, Suspense } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Edges } from '@react-three/drei'
import { treemap, hierarchy, treemapSquarify } from 'd3-hierarchy'
import ErrorBoundary from '../components/ErrorBoundary'

// A single file rendered as a sleek architectural building
function Building({ position, size, color, file, isHovered, onHover, onUnhover, onClick }) {
  const meshRef = useRef()
  const height = size[1]

  useFrame(() => {
    if (meshRef.current) {
      const targetScale = isHovered ? 1.05 : 1.0
      meshRef.current.scale.x += (targetScale - meshRef.current.scale.x) * 0.15
      meshRef.current.scale.z += (targetScale - meshRef.current.scale.z) * 0.15
    }
  })

  return (
    <mesh
      ref={meshRef}
      position={[position[0], height / 2, position[2]]}
      onPointerOver={(e) => { e.stopPropagation(); onHover() }}
      onPointerOut={onUnhover}
      onClick={(e) => { e.stopPropagation(); onClick() }}
      castShadow
      receiveShadow
    >
      <boxGeometry args={[size[0], height, size[2]]} />
      {/* Sleek architectural material */}
      <meshPhysicalMaterial
        color={isHovered ? '#818cf8' : color}
        emissive={isHovered ? '#4f46e5' : '#000000'}
        emissiveIntensity={isHovered ? 0.3 : 0}
        roughness={0.2}
        metalness={0.8}
        clearcoat={0.5}
        clearcoatRoughness={0.1}
      />
      {/* Blueprint-style outline */}
      <Edges scale={1} threshold={15} color={isHovered ? '#ffffff' : 'rgba(255,255,255,0.1)'} />
    </mesh>
  )
}

// A directory rendered as a base platform (district)
function District({ position, size, name }) {
  return (
    <mesh position={[position[0], 0.1, position[2]]} receiveShadow>
      <boxGeometry args={[size[0], 0.2, size[2]]} />
      <meshStandardMaterial color="#1e1e2e" roughness={0.9} metalness={0.1} />
      <Edges scale={1.001} threshold={15} color="rgba(255,255,255,0.05)" />
    </mesh>
  )
}

function CityFloor({ size }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]} receiveShadow>
      <planeGeometry args={[size, size]} />
      <meshStandardMaterial color="#0b0b14" roughness={1} />
      {/* Subtle grid on the floor */}
      <gridHelper args={[size, size / 2, '#1f1f3a', '#1f1f3a']} position={[0, 0.01, 0]} />
    </mesh>
  )
}

function CityScene({ data, onSelectFile }) {
  const [hoveredFile, setHoveredFile] = useState(null)

  const { buildings, districts, gridSize } = useMemo(() => {
    if (!data?.files || data.files.length === 0) return { buildings: [], districts: [], gridSize: 20 }

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

    const size = Math.min(50, Math.max(25, Math.sqrt(data.files.length) * 3))
    
    // Treemap layout with padding to create "streets" between districts
    const treemapLayout = treemap()
      .size([size, size])
      .paddingInner(0.8)
      .paddingOuter(2)
      .paddingTop(1) // Extra space at top of district
      .tile(treemapSquarify)

    const rootNode = hierarchy(root).sum((d) => d.value)
    treemapLayout(rootNode)

    const buildingList = []
    const districtList = []

    rootNode.each((node) => {
      const w = node.x1 - node.x0
      const h = node.y1 - node.y0
      const x = (node.x0 + node.x1) / 2 - size / 2
      const z = (node.y0 + node.y1) / 2 - size / 2

      if (node.depth === 1) { // Top-level directory = District
        districtList.push({
          name: node.data.name,
          position: [x, 0, z],
          size: [Math.max(w, 0.5), 0.2, Math.max(h, 0.5)],
        })
      } else if (!node.children && node.data.file) { // Leaf node = Building
        const linesOfCode = node.data.file.linesOfCode || 10
        const buildingHeight = Math.max(linesOfCode / 20, 0.5)

        buildingList.push({
          position: [x, 0, z],
          // Buildings are slightly smaller than their cell to create gaps
          size: [Math.max(w * 0.8, 0.1), Math.min(buildingHeight, 18), Math.max(h * 0.8, 0.1)],
          file: node.data.file,
          color: getColorForRisk(node.data.file.riskScore || 1),
        })
      }
    })

    return { buildings: buildingList, districts: districtList, gridSize: size }
  }, [data])

  if (buildings.length === 0) return null

  return (
    <>
      {/* Studio lighting for premium architectural look */}
      <ambientLight intensity={0.4} />
      <directionalLight position={[20, 40, 20]} intensity={1.2} castShadow shadow-mapSize={[1024, 1024]} />
      <directionalLight position={[-20, 20, -20]} intensity={0.5} />
      <pointLight position={[0, 20, 0]} intensity={0.5} color="#4f46e5" />

      <CityFloor size={gridSize + 20} />

      {/* Render Districts (base platforms) */}
      {districts.map((d, i) => (
        <District key={`d-${i}`} position={d.position} size={d.size} name={d.name} />
      ))}

      {/* Render Buildings */}
      {buildings.map((b, i) => (
        <Building
          key={`b-${i}`}
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
        maxPolarAngle={Math.PI / 2.1} // Prevent going below ground
        minDistance={10}
        maxDistance={90}
      />

      <fog attach="fog" args={['#0b0b14', 30, 90]} />
    </>
  )
}

function getColorForRisk(score) {
  // Sophisticated, muted architectural colors
  if (score >= 8) return '#b91c1c' // Deep Red
  if (score >= 6) return '#b45309' // Deep Amber
  if (score >= 4) return '#1d4ed8' // Deep Blue
  return '#047857' // Deep Green
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
            camera={{ position: [30, 30, 35], fov: 40 }}
            shadows
            style={{ background: '#0b0b14', borderRadius: 'var(--radius-lg)' }}
            gl={{ antialias: true, alpha: false }}
            dpr={[1, 1.5]}
          >
            <CityScene data={data} onSelectFile={setSelectedFile} />
          </Canvas>
        </Suspense>

        {selectedFile && <FileTooltip file={selectedFile} />}

        <div className="map-view__legend">
          <div className="map-view__legend-item">
            <div className="map-view__legend-dot" style={{ background: '#047857' }} />
            Low Risk
          </div>
          <div className="map-view__legend-item">
            <div className="map-view__legend-dot" style={{ background: '#1d4ed8' }} />
            Medium
          </div>
          <div className="map-view__legend-item">
            <div className="map-view__legend-dot" style={{ background: '#b45309' }} />
            High
          </div>
          <div className="map-view__legend-item">
            <div className="map-view__legend-dot" style={{ background: '#b91c1c' }} />
            Critical
          </div>
        </div>
      </div>
    </ErrorBoundary>
  )
}
