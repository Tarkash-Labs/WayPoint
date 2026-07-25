import { useState, useMemo, useRef } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Text, Float } from '@react-three/drei'
import { treemap, hierarchy, treemapSquarify } from 'd3-hierarchy'

function Building({ position, size, color, file, isHovered, onHover, onUnhover, onClick }) {
  const meshRef = useRef()
  const [height] = useState(size[1])

  useFrame((state) => {
    if (meshRef.current) {
      const targetScale = isHovered ? 1.05 : 1.0
      meshRef.current.scale.x += (targetScale - meshRef.current.scale.x) * 0.1
      meshRef.current.scale.z += (targetScale - meshRef.current.scale.z) * 0.1

      // Subtle pulsing for high-risk buildings
      if (file.riskScore >= 7) {
        const pulse = Math.sin(state.clock.elapsedTime * 2 + position[0]) * 0.03
        meshRef.current.scale.y = 1 + pulse
      }
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
      <meshStandardMaterial
        color={isHovered ? '#6366f1' : color}
        emissive={isHovered ? '#4f46e5' : color}
        emissiveIntensity={isHovered ? 0.3 : file.riskScore >= 7 ? 0.15 : 0.05}
        roughness={0.7}
        metalness={0.1}
      />
    </mesh>
  )
}

function CityFloor({ size }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
      <planeGeometry args={[size, size]} />
      <meshStandardMaterial color="#1a1a2e" roughness={0.9} />
    </mesh>
  )
}

function GridLines({ size, divisions }) {
  const lines = []
  const halfSize = size / 2
  const step = size / divisions

  for (let i = 0; i <= divisions; i++) {
    const pos = -halfSize + i * step
    lines.push(
      <line key={`h-${i}`}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={2}
            array={new Float32Array([-halfSize, 0, pos, halfSize, 0, pos])}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#2a2a4a" transparent opacity={0.3} />
      </line>,
      <line key={`v-${i}`}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={2}
            array={new Float32Array([pos, 0, -halfSize, pos, 0, halfSize])}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#2a2a4a" transparent opacity={0.3} />
      </line>
    )
  }
  return <group>{lines}</group>
}

function CityScene({ data }) {
  const [hoveredFile, setHoveredFile] = useState(null)
  const [selectedFile, setSelectedFile] = useState(null)

  const { buildings, gridSize } = useMemo(() => {
    if (!data?.files) return { buildings: [], gridSize: 20 }

    // Build hierarchy for treemap
    const dirMap = {}
    data.files.forEach((file) => {
      const dir = file.directory || 'root'
      if (!dirMap[dir]) dirMap[dir] = []
      dirMap[dir].push(file)
    })

    const root = {
      name: 'root',
      children: Object.entries(dirMap).map(([dir, files]) => ({
        name: dir,
        children: files.map((f) => ({
          name: f.path,
          value: Math.max(f.linesOfCode, 20),
          file: f,
        })),
      })),
    }

    const size = 40
    const treemapLayout = treemap()
      .size([size, size])
      .padding(1)
      .paddingOuter(2)
      .tile(treemapSquarify)

    const rootNode = hierarchy(root).sum((d) => d.value)
    treemapLayout(rootNode)

    const leaves = rootNode.leaves().map((leaf) => {
      const w = leaf.x1 - leaf.x0
      const h = leaf.y1 - leaf.y0
      const x = (leaf.x0 + leaf.x1) / 2 - size / 2
      const z = (leaf.y0 + leaf.y1) / 2 - size / 2
      const buildingHeight = Math.max(leaf.data.file.linesOfCode / 20, 0.5)

      return {
        position: [x, 0, z],
        size: [w * 0.85, buildingHeight, h * 0.85],
        file: leaf.data.file,
        color: getColorForRisk(leaf.data.file.riskScore),
      }
    })

    return { buildings: leaves, gridSize: size }
  }, [data])

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[20, 30, 10]} intensity={0.8} castShadow />
      <directionalLight position={[-10, 20, -10]} intensity={0.3} />

      <CityFloor size={gridSize + 10} />
      <GridLines size={gridSize + 10} divisions={20} />

      {buildings.map((b, i) => (
        <Building
          key={i}
          position={b.position}
          size={b.size}
          color={b.color}
          file={b.file}
          isHovered={hoveredFile === b.file.path}
          onHover={() => setHoveredFile(b.file.path)}
          onUnhover={() => setHoveredFile(null)}
          onClick={() => setSelectedFile(b.file)}
        />
      ))}

      {/* District labels */}
      {data?.directories?.filter(d => d.path.startsWith('src/')).map((dir) => (
        <Float key={dir.path} speed={1} rotationIntensity={0} floatIntensity={0.5}>
          <Text
            position={[0, 8, 0]}
            fontSize={0.6}
            color="rgba(255,255,255,0.3)"
            anchorX="center"
            anchorY="middle"
            font={undefined}
          >
            {dir.label}
          </Text>
        </Float>
      ))}

      <OrbitControls
        enableDamping
        dampingFactor={0.05}
        maxPolarAngle={Math.PI / 2.1}
        minDistance={5}
        maxDistance={60}
        target={[0, 0, 0]}
      />

      {/* Fog for depth */}
      <fog attach="fog" args={['#0f0f1a', 30, 80]} />
    </>
  )
}

function getColorForRisk(score) {
  if (score >= 8) return '#ef4444'
  if (score >= 6) return '#f59e0b'
  if (score >= 4) return '#3b82f6'
  return '#10b981'
}

export default function MapView({ data }) {
  const [selectedFile, setSelectedFile] = useState(null)

  return (
    <div className="map-view" style={{ height: 'calc(100vh - var(--header-height) - var(--ai-bar-height) - 64px)', minHeight: '500px' }}>
      <Canvas
        camera={{ position: [25, 25, 25], fov: 45 }}
        shadows
        style={{ background: '#0f0f1a' }}
      >
        <CityScene data={data} />
      </Canvas>

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
  )
}
