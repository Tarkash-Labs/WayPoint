import { useState, useMemo, useRef, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Stars, Line, Html } from '@react-three/drei'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import * as THREE from 'three'
import ErrorBoundary from '../components/ErrorBoundary'

// Color palette based on risk scores
const RISK_COLORS = {
  critical: { hex: '#ff4d4d', emissive: '#ff4d4d', intensity: 2.0 },
  high: { hex: '#ffab4a', emissive: '#ffab4a', intensity: 1.5 },
  medium: { hex: '#ffd98a', emissive: '#ffd98a', intensity: 1.0 },
  low: { hex: '#bfe6ff', emissive: '#bfe6ff', intensity: 0.8 },
}

function getRiskTier(score) {
  if (score >= 8) return 'critical'
  if (score >= 6) return 'high'
  if (score >= 4) return 'medium'
  return 'low'
}

// Generates a stable random position based on string hash
function stringToHash(string) {
  let hash = 0;
  for (let i = 0; i < string.length; i++) {
    let char = string.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash;
}

function seededRandom(seed) {
  let x = Math.sin(seed++) * 10000;
  return x - Math.floor(x);
}

// --- Node Component (Star/Planet) ---
function FileNode({ file, position, isHovered, onPointerOver, onPointerOut, onClick }) {
  const meshRef = useRef()
  const colorTheme = RISK_COLORS[getRiskTier(file.riskScore || 1)]

  // Base scale on lines of code
  const scale = useMemo(() => Math.max(0.5, Math.min(3, Math.sqrt(file.linesOfCode || 20) * 0.15)), [file.linesOfCode])

  useFrame((state) => {
    if (meshRef.current) {
      if (isHovered) {
        meshRef.current.scale.setScalar(scale * 1.5 + Math.sin(state.clock.elapsedTime * 5) * 0.2)
      } else {
        meshRef.current.scale.setScalar(scale)
      }
    }
  })

  return (
    <group position={position}>
      <mesh
        ref={meshRef}
        onPointerOver={(e) => { e.stopPropagation(); onPointerOver() }}
        onPointerOut={onPointerOut}
        onClick={(e) => { e.stopPropagation(); onClick() }}
      >
        <sphereGeometry args={[1, 16, 16]} />
        <meshStandardMaterial
          color={colorTheme.hex}
          emissive={colorTheme.emissive}
          emissiveIntensity={isHovered ? colorTheme.intensity * 2 : colorTheme.intensity}
          roughness={0.2}
          metalness={0.8}
        />
      </mesh>

      {isHovered && (
        <Html position={[0, scale + 1.5, 0]} center style={{ pointerEvents: 'none' }}>
          <div style={{
            background: 'rgba(10, 15, 30, 0.8)',
            border: `1px solid ${colorTheme.hex}`,
            color: '#fff',
            padding: '4px 8px',
            borderRadius: '4px',
            fontSize: '12px',
            whiteSpace: 'nowrap',
            fontFamily: 'monospace'
          }}>
            {file.path} ({file.linesOfCode || 0} LOC)
          </div>
        </Html>
      )}
    </group>
  )
}

// --- Connection Lines ---
function DependencyLines({ lines }) {
  return (
    <group>
      {lines.map((line, idx) => (
        <Line
          key={idx}
          points={line.points}
          color="#3a4a7a"
          lineWidth={1}
          transparent
          opacity={0.3}
        />
      ))}
    </group>
  )
}

// --- Main Scene ---
function GalaxyScene({ data, onHoverInfo }) {
  const [hoveredFile, setHoveredFile] = useState(null)

  const { nodes, edges } = useMemo(() => {
    if (!data?.files?.length) return { nodes: [], edges: [] }

    const nodeList = []
    const dirMap = {}

    // Distribute nodes in a spherical galaxy shape
    data.files.forEach((file, index) => {
      const seed = stringToHash(file.path)

      // Spherical coordinates
      const u = seededRandom(seed)
      const v = seededRandom(seed + 1)
      const theta = 2 * Math.PI * u
      const phi = Math.acos(2 * v - 1)

      // Radius with some central clustering
      const radius = 20 + seededRandom(seed + 2) * 50

      const x = radius * Math.sin(phi) * Math.cos(theta)
      const y = (radius * Math.sin(phi) * Math.sin(theta)) * 0.3 // Flatten galaxy
      const z = radius * Math.cos(phi)

      const node = { file, position: [x, y, z] }
      nodeList.push(node)

      const dir = file.directory || file.path.split('/')[0] || 'root'
      if (!dirMap[dir]) dirMap[dir] = []
      dirMap[dir].push(node)
    })

    // Create edges (connect files within the same directory)
    const edgeList = []
    Object.values(dirMap).forEach(group => {
      // Connect each file in dir to a central point or just form a web
      if (group.length < 2) return

      // Find center of group
      const cx = group.reduce((sum, n) => sum + n.position[0], 0) / group.length
      const cy = group.reduce((sum, n) => sum + n.position[1], 0) / group.length
      const cz = group.reduce((sum, n) => sum + n.position[2], 0) / group.length
      const center = new THREE.Vector3(cx, cy, cz)

      group.forEach(node => {
        // Curve to center
        const p1 = new THREE.Vector3(...node.position)
        const curve = new THREE.QuadraticBezierCurve3(
          p1,
          new THREE.Vector3((p1.x + center.x) / 2, p1.y + 10, (p1.z + center.z) / 2),
          center
        )
        edgeList.push({ points: curve.getPoints(10) })
      })
    })

    return { nodes: nodeList, edges: edgeList }
  }, [data])

  useEffect(() => {
    onHoverInfo(hoveredFile)
  }, [hoveredFile, onHoverInfo])

  return (
    <>
      <color attach="background" args={['#050811']} />
      <ambientLight intensity={0.2} color="#4a5a8c" />
      <pointLight position={[0, 0, 0]} intensity={2.0} color="#ffb672" distance={200} />

      <Stars radius={100} depth={50} count={5000} factor={4} saturation={0} fade speed={1} />

      {/* Central Black Hole / Core */}
      <mesh position={[0, 0, 0]}>
        <sphereGeometry args={[5, 32, 32]} />
        <meshBasicMaterial color="#000" />
      </mesh>

      {/* Accretion Disk / Core Glow */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[6, 12, 64]} />
        <meshBasicMaterial color="#ffab4a" transparent opacity={0.15} side={THREE.DoubleSide} />
      </mesh>

      <DependencyLines lines={edges} />

      {nodes.map((node, i) => (
        <FileNode
          key={i}
          file={node.file}
          position={node.position}
          isHovered={hoveredFile?.path === node.file.path}
          onPointerOver={() => setHoveredFile(node.file)}
          onPointerOut={() => setHoveredFile(null)}
          onClick={() => { }}
        />
      ))}
    </>
  )
}

function CameraController({ nodes }) {
  const { camera, controls } = useThree()

  useEffect(() => {
    camera.position.set(0, 40, 80)
  }, [camera])

  useFrame(() => {
    if (controls) {
      controls.autoRotate = true
      controls.autoRotateSpeed = 0.5
    }
  })

  return null
}

export default function GalaxyView({ data, selectedTask }) {
  const [hoveredInfo, setHoveredInfo] = useState(null)

  if (!data?.files?.length) {
    return (
      <div className="hud-panel" style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8a8d98' }}>
        No files available to render galaxy.
      </div>
    )
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <ErrorBoundary>
        <Canvas camera={{ fov: 45, near: 1, far: 1000, position: [0, 40, 80] }}>
          <OrbitControls
            makeDefault
            enablePan={true}
            enableZoom={true}
            maxDistance={300}
            minDistance={10}
          />
          <GalaxyScene data={data} onHoverInfo={setHoveredInfo} />
          <CameraController nodes={data.files} />
          <EffectComposer disableNormalPass multisampling={4}>
            <Bloom
              luminanceThreshold={0.5}
              luminanceSmoothing={0.1}
              intensity={1.2}
            />
          </EffectComposer>
        </Canvas>
      </ErrorBoundary>

      {/* Info Overlay Panel */}
      <div className="hud-panel" style={{
        position: 'absolute',
        top: 20,
        right: 20,
        width: 320,
        background: 'rgba(10, 15, 25, 0.85)',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        pointerEvents: 'none'
      }}>
        {hoveredInfo ? (
          <div>
            <div style={{ fontSize: '12px', color: '#8a8d98', marginBottom: 4 }}>
              {hoveredInfo.directory || 'root'}
            </div>
            <div style={{ fontSize: '16px', color: '#fff', fontWeight: 600, wordBreak: 'break-all', marginBottom: 16 }}>
              {hoveredInfo.path.split('/').pop()}
            </div>

            <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
              <div>
                <div style={{ fontSize: '11px', color: '#8a8d98' }}>Risk Level</div>
                <div style={{
                  color: RISK_COLORS[getRiskTier(hoveredInfo.riskScore || 1)].hex,
                  fontWeight: 600,
                  textTransform: 'capitalize'
                }}>
                  {getRiskTier(hoveredInfo.riskScore || 1)} ({hoveredInfo.riskScore || 1}/10)
                </div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: '#8a8d98' }}>Size</div>
                <div style={{ color: '#fff' }}>{hoveredInfo.linesOfCode || 0} LOC</div>
              </div>
            </div>

            {hoveredInfo.semanticPurpose && (
              <div style={{ fontSize: '13px', color: '#c4c6cc', lineHeight: 1.5 }}>
                {hoveredInfo.semanticPurpose}
              </div>
            )}
          </div>
        ) : (
          <div style={{ color: '#8a8d98', fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>
            Hover over a constellation node to inspect files.
          </div>
        )}
      </div>
    </div>
  )
}
