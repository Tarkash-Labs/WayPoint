import { useState, useMemo, useRef, useEffect, Suspense } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Edges, MeshReflectorMaterial, Line, Html, Grid } from '@react-three/drei'
import { EffectComposer, Bloom, Vignette, Noise } from '@react-three/postprocessing'
import * as THREE from 'three'
import { treemap, hierarchy, treemapSquarify } from 'd3-hierarchy'
import ErrorBoundary from '../components/ErrorBoundary'

/* ── Constants & Theme ──────────────────────────────── */
const RISK_COLORS = {
  critical: { hex: '#ef4444', emissive: '#ef4444', intensity: 2.0 },
  high: { hex: '#f97316', emissive: '#f97316', intensity: 1.5 },
  medium: { hex: '#eab308', emissive: '#eab308', intensity: 1.0 },
  low: { hex: '#3b82f6', emissive: '#3b82f6', intensity: 0.5 },
}

const MISSION_COLORS = {
  target: { hex: '#fbbf24', emissive: '#fbbf24', intensity: 3.0 },
  trap: { hex: '#dc2626', emissive: '#ff0000', intensity: 4.0 },
  dim: { hex: '#1e1b4b', emissive: '#000000', intensity: 0.1 },
}

function getRiskTier(score) {
  if (score >= 8) return 'critical'
  if (score >= 6) return 'high'
  if (score >= 4) return 'medium'
  return 'low'
}

// Muted, distinct district tints so each folder reads as its own "neighborhood"
const DISTRICT_PALETTE = ['#6366f1', '#06b6d4', '#8b5cf6', '#14b8a6', '#f59e0b', '#ec4899', '#22c55e', '#3b82f6']
function getDistrictColor(name) {
  let s = 0
  for (let i = 0; i < name.length; i++) s += name.charCodeAt(i)
  return DISTRICT_PALETTE[s % DISTRICT_PALETTE.length]
}

/* ── Procedural Cyberpunk Building ────────────────────── */
function CyberBuilding({
  position, size, file,
  isHovered, isNeighborHovered,
  isMissionActive, isMissionTarget, isMissionTrap,
  onClick, onPointerOver, onPointerOut
}) {
  const groupRef = useRef()
  const meshRef = useRef()
  const w = size[0], h = size[1], d = size[2]

  // Architecture variations based on file hash/path
  const seed = useMemo(() => {
    let s = 0;
    for (let i = 0; i < file.path.length; i++) s += file.path.charCodeAt(i)
    return s
  }, [file.path])

  const archType = h < 7 ? 3 : seed % 3 // 0: Standard, 1: Tapered, 2: Stacked, 3: Low House (small/trivial files)
  const hasAntenna = seed % 5 === 0

  // State colors
  let colorTheme = RISK_COLORS[getRiskTier(file.riskScore || 1)]
  let targetEmissive = colorTheme.emissive
  let targetIntensity = colorTheme.intensity
  let targetOpacity = 1.0

  if (isMissionActive) {
    if (isMissionTarget) {
      targetEmissive = MISSION_COLORS.target.emissive
      targetIntensity = MISSION_COLORS.target.intensity
    } else if (isMissionTrap) {
      targetEmissive = MISSION_COLORS.trap.emissive
      targetIntensity = MISSION_COLORS.trap.intensity
    } else {
      targetEmissive = MISSION_COLORS.dim.emissive
      targetIntensity = MISSION_COLORS.dim.intensity
      targetOpacity = 0.3
    }
  } else if (isHovered) {
    targetIntensity *= 3.0
  } else if (isNeighborHovered) {
    targetIntensity *= 1.5
  }

  // Breathing animation
  const phase = useMemo(() => Math.random() * Math.PI * 2, [])
  useFrame((state) => {
    if (!groupRef.current) return
    const t = state.clock.getElapsedTime()
    // Idle breathing
    const breath = Math.sin(t * 2 + phase) * 0.015
    groupRef.current.scale.y = 1 + breath
  })

  // Shader inject for procedural windows
  const customMaterial = useMemo(() => {
    const mat = new THREE.MeshStandardMaterial({
      color: '#030308',
      roughness: 0.7, // Matte building exterior
      metalness: 0.3,
      transparent: true,
      opacity: targetOpacity
    })

    mat.onBeforeCompile = (shader) => {
      // Pass file properties to shader
      shader.uniforms.uBaseGlow = { value: new THREE.Color(targetEmissive).multiplyScalar(targetIntensity) }
      shader.uniforms.uDensity = { value: Math.max(2.0, (file.riskScore || 1) * 1.5) }
      shader.uniforms.uActivity = { value: isHovered || isMissionTarget ? 1.0 : (isMissionActive && !isMissionTarget ? 0.0 : 0.4) }
      shader.uniforms.uTime = { value: 0 }

      mat.userData.shader = shader

      shader.vertexShader = shader.vertexShader.replace(
        '#include <common>',
        `#include <common>
         varying vec3 vWorldPos;`
      ).replace(
        '#include <worldpos_vertex>',
        `#include <worldpos_vertex>
         vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`
      )

      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <common>',
        `#include <common>
         uniform vec3 uBaseGlow;
         uniform float uDensity;
         uniform float uActivity;
         uniform float uTime;
         varying vec3 vWorldPos;`
      ).replace(
        '#include <emissivemap_fragment>',
        `#include <emissivemap_fragment>
         
         vec2 grid;
         vec3 n = abs(vNormal);
         if (n.x > 0.5) grid = vWorldPos.zy;
         else if (n.z > 0.5) grid = vWorldPos.xy;
         else grid = vWorldPos.xz;
         
         grid *= uDensity; 
         
         vec2 cell = floor(grid);
         vec2 uvF = fract(grid);
         
         float window = step(0.2, uvF.x) * step(0.2, uvF.y);
         if (n.y > 0.5) window = 0.0; // Roof has no windows
         
         // Randomizer
         float rnd = fract(sin(dot(cell, vec2(12.9898, 78.233))) * 43758.5453);
         
         // Inactive files have dark windows, active ones blink or stay lit
         float isLit = step(1.0 - uActivity, rnd);
         
         // Add some bloom-catching intensity
         totalEmissiveRadiance += uBaseGlow * window * isLit * 2.0;`
      )
    }
    return mat
  }, [targetEmissive, targetIntensity, targetOpacity, file.riskScore, isHovered, isMissionTarget, isMissionActive])

  // Update time for shader
  useFrame((state) => {
    if (customMaterial.userData.shader) {
      customMaterial.userData.shader.uniforms.uTime.value = state.clock.getElapsedTime()
      // Smoothly update emissive to prevent jumps
      customMaterial.userData.shader.uniforms.uBaseGlow.value.lerp(
        new THREE.Color(targetEmissive).multiplyScalar(targetIntensity),
        0.1
      )
    }
  })

  const edgeColor = new THREE.Color(targetEmissive).multiplyScalar(isHovered ? 2 : 0.5)

  return (
    <group
      ref={groupRef}
      position={position}
      onPointerOver={(e) => { e.stopPropagation(); onPointerOver() }}
      onPointerOut={onPointerOut}
      onClick={(e) => { e.stopPropagation(); onClick() }}
    >
      {/* Main Structure */}
      {archType === 1 ? (
        // Tapered Tower — two stacked boxes narrowing upward, reads as a real building silhouette
        <group>
          <mesh position={[0, h * 0.35, 0]} material={customMaterial}>
            <boxGeometry args={[w, h * 0.7, d]} />
            <Edges threshold={15} color={edgeColor} />
          </mesh>
          <mesh position={[0, h * 0.85, 0]} material={customMaterial}>
            <boxGeometry args={[w * 0.55, h * 0.3, d * 0.55]} />
            <Edges threshold={15} color={edgeColor} />
          </mesh>
        </group>
      ) : archType === 2 ? (
        // Stacked Blocks
        <group>
          <mesh position={[0, h * 0.3, 0]} material={customMaterial}>
            <boxGeometry args={[w, h * 0.6, d]} />
            <Edges threshold={15} color={edgeColor} />
          </mesh>
          <mesh position={[0, h * 0.8, 0]} material={customMaterial}>
            <boxGeometry args={[w * 0.7, h * 0.4, d * 0.7]} />
            <Edges threshold={15} color={edgeColor} />
          </mesh>
        </group>
      ) : archType === 3 ? (
        // Low House — small/trivial files render as compact structures with a roof ledge,
        // not scaled-down towers. This is what most of a real skyline actually looks like.
        <group>
          <mesh position={[0, h / 2, 0]} material={customMaterial}>
            <boxGeometry args={[w, h, d]} />
            <Edges threshold={15} color={edgeColor} />
          </mesh>
          <mesh position={[0, h + 0.15, 0]}>
            <boxGeometry args={[w * 1.08, 0.3, d * 1.08]} />
            <meshStandardMaterial color="#050508" roughness={0.6} metalness={0.4} />
          </mesh>
        </group>
      ) : (
        // Standard Block
        <mesh ref={meshRef} position={[0, h / 2, 0]} material={customMaterial}>
          <boxGeometry args={[w, h, d]} />
          <Edges threshold={15} color={edgeColor} />
        </mesh>
      )}

      {/* Holographic Antenna */}
      {hasAntenna && (
        <mesh position={[0, h + 1, 0]}>
          <cylinderGeometry args={[0.02, 0.05, 2]} />
          <meshBasicMaterial color={targetEmissive} toneMapped={false} />
        </mesh>
      )}

      {/* Trap Pulse */}
      {isMissionTrap && (
        <mesh position={[0, h / 2, 0]}>
          <boxGeometry args={[w * 1.1, h * 1.02, d * 1.1]} />
          <meshBasicMaterial color="#ff0000" wireframe transparent opacity={0.3} />
        </mesh>
      )}

      {/* Hover Base Glow */}
      {isHovered && (
        <mesh position={[0, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[Math.max(w, d) / 2 + 0.5, Math.max(w, d) / 2 + 1.5, 32]} />
          <meshBasicMaterial color={targetEmissive} transparent opacity={0.5} side={THREE.DoubleSide} toneMapped={false} />
        </mesh>
      )}
    </group>
  )
}

/* ── Urban Districts (Folders) ────────────────────────── */
function DistrictPlatform({ position, size, name, isDimmed, maxHeight = 4 }) {
  const w = size[0], d = size[2]
  const tint = useMemo(() => getDistrictColor(name), [name])
  const groupRef = useRef()
  const labelRef = useRef()
  const worldPos = useMemo(() => new THREE.Vector3(), [])

  useFrame((state) => {
    if (!groupRef.current || !labelRef.current) return
    groupRef.current.getWorldPosition(worldPos)
    worldPos.y = maxHeight
    const dist = state.camera.position.distanceTo(worldPos)
    // Full opacity up close, fading past ~55 units — keeps nearby labels crisp
    // while distant/overlapping ones recede instead of stacking on screen
    const opacity = Math.min(1, Math.max(0.12, 1 - (dist - 55) / 70))
    labelRef.current.style.opacity = opacity.toFixed(2)
  })

  return (
    <group ref={groupRef} position={position}>
      {/* Base platform — subtly tinted per district so folders read as distinct neighborhoods */}
      <mesh position={[0, 0.05, 0]} receiveShadow>
        <boxGeometry args={[w, 0.1, d]} />
        <meshStandardMaterial
          color="#050508"
          emissive={tint}
          emissiveIntensity={isDimmed ? 0.02 : 0.06}
          roughness={0.75}
          metalness={0.3}
          transparent
          opacity={isDimmed ? 0.3 : 1}
        />
        <Edges color={tint} />
      </mesh>
      {/* Glowing boundary line, colored to match district */}
      <mesh position={[0, 0.11, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[w - 0.2, d - 0.2]} />
        <meshBasicMaterial color={tint} wireframe transparent opacity={isDimmed ? 0.08 : 0.35} toneMapped={false} />
      </mesh>
      {/* District Label — floats above the tallest building in this district, fades with distance */}
      {!isDimmed && w > 4 && d > 4 && (
        <Html position={[0, maxHeight, 0]} center distanceFactor={45} style={{ pointerEvents: 'none' }}>
          <div ref={labelRef} style={{
            color: tint, fontFamily: 'JetBrains Mono', fontSize: '13px', fontWeight: 600,
            textTransform: 'uppercase', letterSpacing: '2px', whiteSpace: 'nowrap',
            textShadow: `0 0 8px ${tint}, 0 0 2px #000`, background: 'rgba(2,2,8,0.55)',
            padding: '3px 9px', borderRadius: '4px', border: `1px solid ${tint}55`,
            transition: 'opacity 0.1s linear'
          }}>
            {name}
          </div>
        </Html>
      )}
    </group>
  )
}

/* ── Hovercraft Traffic (Instanced) ───────────────────── */
function HovercraftTraffic({ count = 200, bounds }) {
  const meshRef = useRef()
  const dummy = useMemo(() => new THREE.Object3D(), [])

  const craft = useMemo(() => {
    return Array.from({ length: count }, () => {
      // Ground roads or sky traffic
      const isGround = Math.random() > 0.4
      const altitude = isGround ? 0.4 : Math.random() * 20 + 5
      const speed = (Math.random() * 15 + 10) * (isGround ? 1 : 1.5)
      // Axis aligned movement
      const axis = Math.random() > 0.5 ? 'x' : 'z'
      const dir = Math.random() > 0.5 ? 1 : -1

      // Kept to a single muted cyan family — risk color is reserved for buildings only,
      // so traffic reads as ambient scenery rather than competing data
      let color = Math.random() > 0.85 ? '#0891b2' : '#22d3ee'

      return {
        pos: new THREE.Vector3(
          (Math.random() - 0.5) * bounds,
          altitude,
          (Math.random() - 0.5) * bounds
        ),
        axis,
        dir,
        speed,
        color: new THREE.Color(color).multiplyScalar(8), // toned down so it doesn't outshine building risk colors
        scale: isGround ? [0.6, 0.2, 0.6] : [0.4, 0.2, 0.4]
      }
    })
  }, [count, bounds])

  const colors = useMemo(() => {
    const arr = new Float32Array(count * 3)
    craft.forEach((c, i) => {
      c.color.toArray(arr, i * 3)
    })
    return arr
  }, [craft])

  useFrame((state, delta) => {
    if (!meshRef.current) return
    craft.forEach((c, i) => {
      // Move
      c.pos[c.axis] += c.dir * c.speed * delta
      // Wrap
      if (c.pos[c.axis] > bounds / 2) c.pos[c.axis] = -bounds / 2
      if (c.pos[c.axis] < -bounds / 2) c.pos[c.axis] = bounds / 2

      dummy.position.copy(c.pos)
      // Stretch based on velocity
      const sx = c.axis === 'x' ? c.scale[0] * 2 : c.scale[0]
      const sz = c.axis === 'z' ? c.scale[2] * 2 : c.scale[2]
      dummy.scale.set(sx, c.scale[1], sz)
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

/* ── Dependency Bridges (Elevated) ────────────────────── */
function DependencyBridges({ buildings, isMissionActive, targetPaths }) {
  // Generate stable mock dependencies between random buildings
  const bridges = useMemo(() => {
    if (buildings.length < 2) return []
    const lines = []
    // Create ~15 bridges
    for (let i = 0; i < 15; i++) {
      const b1 = buildings[Math.floor(Math.random() * buildings.length)]
      const b2 = buildings[Math.floor(Math.random() * buildings.length)]
      if (b1 === b2) continue

      const isTarget = isMissionActive && targetPaths.includes(b1.file.path) && targetPaths.includes(b2.file.path)
      const color = isTarget ? '#fbbf24' : '#06b6d4'
      const opacity = isMissionActive && !isTarget ? 0.05 : 0.6

      // Calculate arc
      const p1 = new THREE.Vector3(...b1.position)
      p1.y = b1.size[1] * 0.8
      const p2 = new THREE.Vector3(...b2.position)
      p2.y = b2.size[1] * 0.8

      const dist = p1.distanceTo(p2)
      const mid = p1.clone().lerp(p2, 0.5)
      mid.y += dist * 0.2 // Arc height

      const curve = new THREE.QuadraticBezierCurve3(p1, mid, p2)
      const points = curve.getPoints(20)

      lines.push({ points, color, opacity, isTarget })
    }
    return lines
  }, [buildings, isMissionActive, targetPaths])

  return (
    <group>
      {bridges.map((b, i) => (
        <Line
          key={i}
          points={b.points}
          color={b.color}
          lineWidth={b.isTarget ? 3 : 1}
          transparent
          opacity={b.opacity}
          toneMapped={false}
        />
      ))}
    </group>
  )
}

/* ── GPS Mission Route ────────────────────────────────── */
function GPSRoute({ buildings, targetPaths }) {
  const routePoints = useMemo(() => {
    if (!targetPaths || targetPaths.length < 2) return null
    // Order buildings by targetPaths sequence
    const ordered = targetPaths.map(p => buildings.find(b => b.file.path === p)).filter(Boolean)
    if (ordered.length < 2) return null

    const pts = []
    ordered.forEach((b, i) => {
      pts.push(new THREE.Vector3(b.position[0], 0.2, b.position[2]))
      // Add a slight arc between them
      if (i < ordered.length - 1) {
        const next = ordered[i + 1]
        const mid = new THREE.Vector3(
          (b.position[0] + next.position[0]) / 2,
          5, // fly over height
          (b.position[2] + next.position[2]) / 2
        )
        pts.push(mid)
      }
    })
    const curve = new THREE.CatmullRomCurve3(pts)
    return curve.getPoints(50)
  }, [buildings, targetPaths])

  if (!routePoints) return null

  return (
    <Line
      points={routePoints}
      color="#10b981"
      lineWidth={4}
      toneMapped={false}
    />
  )
}

/* ── Camera Controller (Cinematic Drift / Fly) ────────── */
function CameraController({ selectedBuilding, isMissionActive, gpsStartPoint }) {
  const { camera, controls } = useThree()

  const targetLook = useRef(new THREE.Vector3(0, 0, 0))
  const isTransitioning = useRef(false)

  // Trigger transition when selection changes
  useEffect(() => {
    if (selectedBuilding) {
      targetLook.current.set(...selectedBuilding.position)
      targetLook.current.y = selectedBuilding.size[1] / 2
      isTransitioning.current = true
    } else if (isMissionActive && gpsStartPoint) {
      targetLook.current.set(gpsStartPoint[0], 0, gpsStartPoint[2])
      isTransitioning.current = true
    } else {
      targetLook.current.set(0, 0, 0)
      isTransitioning.current = true
    }
  }, [selectedBuilding, isMissionActive, gpsStartPoint])

  useFrame((state, delta) => {
    if (!controls) return

    // Auto rotate if idle
    controls.autoRotate = !selectedBuilding && !isMissionActive
    controls.autoRotateSpeed = 0.5

    if (isTransitioning.current) {
      // Lerp controls target instead of forcing camera.lookAt
      controls.target.lerp(targetLook.current, 3 * delta)

      if (controls.target.distanceTo(targetLook.current) < 0.1) {
        isTransitioning.current = false
      }

      // Zoom in slightly when selecting a building
      if (selectedBuilding) {
        const targetPos = new THREE.Vector3(
          selectedBuilding.position[0] + selectedBuilding.size[0] + 25,
          selectedBuilding.size[1] + 15,
          selectedBuilding.position[2] + 30
        )
        camera.position.lerp(targetPos, 2 * delta)
      } else if (!isMissionActive) {
        // Slowly pull back to city view if returning to idle
        const dist = camera.position.length()
        if (dist < 60) {
          camera.position.lerp(camera.position.clone().normalize().multiplyScalar(80), delta)
        }
      }
    }
  })

  return null
}

/* ── Post-Processing & Atmosphere ─────────────────────── */
function CyberEffects() {
  return (
    <EffectComposer disableNormalPass multisampling={4}>
      <Bloom
        luminanceThreshold={0.8} // High threshold: mostly windows and traffic glow
        luminanceSmoothing={0.1}
        intensity={1.5}
        radius={0.7}
      />
      <Vignette offset={0.3} darkness={0.8} />
      <Noise opacity={0.02} />
    </EffectComposer>
  )
}

function AtmosphericParticles() {
  const count = 500
  const mesh = useRef()

  const dummy = useMemo(() => new THREE.Object3D(), [])
  const particles = useMemo(() => {
    return Array.from({ length: count }, () => ({
      pos: new THREE.Vector3((Math.random() - 0.5) * 150, Math.random() * 50, (Math.random() - 0.5) * 150),
      speed: Math.random() * 0.2 + 0.1
    }))
  }, [])

  useFrame((state, delta) => {
    particles.forEach((p, i) => {
      p.pos.y += p.speed * delta
      if (p.pos.y > 50) p.pos.y = 0
      dummy.position.copy(p.pos)
      dummy.updateMatrix()
      mesh.current.setMatrixAt(i, dummy.matrix)
    })
    mesh.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={mesh} args={[null, null, count]}>
      <planeGeometry args={[0.2, 0.2]} />
      <meshBasicMaterial color="#ffffff" transparent opacity={0.1} depthWrite={false} />
    </instancedMesh>
  )
}

/* ── Atmospheric Horizon (gradient sky, not a flat void) ──── */
function CityAtmosphere() {
  const material = useMemo(() => new THREE.ShaderMaterial({
    uniforms: {
      topColor: { value: new THREE.Color('#04040c') },
      bottomColor: { value: new THREE.Color('#2a1258') },
      offset: { value: 15 },
      exponent: { value: 0.7 },
    },
    vertexShader: `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 bottomColor;
      uniform float offset;
      uniform float exponent;
      varying vec3 vWorldPosition;
      void main() {
        float h = normalize(vWorldPosition + vec3(0.0, offset, 0.0)).y;
        gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
      }
    `,
    side: THREE.BackSide,
    depthWrite: false,
    fog: false, // keep the horizon glow clean instead of washed out by scene fog
  }), [])

  return (
    <mesh material={material} renderOrder={-10}>
      <sphereGeometry args={[400, 24, 24]} />
    </mesh>
  )
}

/* ── Main City Scene ──────────────────────────────────── */
function CityScene({ data, selectedTask, onHoverInfo }) {
  const [hoveredFile, setHoveredFile] = useState(null)
  const [selectedBuilding, setSelectedBuilding] = useState(null)

  // Layout processing (stable unless data changes)
  const { buildings, districts, gridSize } = useMemo(() => {
    if (!data?.files?.length) return { buildings: [], districts: [], gridSize: 50 }

    const dirMap = {}
    data.files.forEach((file) => {
      const dir = file.directory || file.path?.split('/')[0] || 'root'
      if (!dirMap[dir]) dirMap[dir] = []
      dirMap[dir].push(file)
    })

    const size = Math.min(120, Math.max(60, Math.sqrt(data.files.length) * 7))
    const root = {
      name: 'root',
      children: Object.entries(dirMap).map(([dir, files]) => ({
        name: dir,
        children: files.map((f) => ({ name: f.path, value: Math.max(f.linesOfCode || 10, 10), file: f })),
      })),
    }

    const layout = treemap().size([size, size]).paddingInner(2.5).paddingOuter(12).tile(treemapSquarify)
    const rootNode = hierarchy(root).sum((d) => d.value)
    layout(rootNode)

    const buildingList = []
    const districtList = []

    rootNode.each((node) => {
      const w = node.x1 - node.x0
      const d = node.y1 - node.y0
      const x = (node.x0 + node.x1) / 2 - size / 2
      const z = (node.y0 + node.y1) / 2 - size / 2

      if (node.depth === 1) {
        districtList.push({ name: node.data.name, position: [x, 0, z], size: [w, 0.2, d] })
      } else if (!node.children && node.data.file) {
        const f = node.data.file
        const bw = Math.max(w * 0.82, 2.8)
        const bd = Math.max(d * 0.82, 2.8)
        // Sqrt scaling instead of linear: a 700-LOC outlier file no longer towers
        // 7x over a 100-LOC file — same principle as CodeCity's boxplot-based height
        // mapping, which exists specifically so one large class doesn't dominate the skyline.
        const h = Math.min(Math.max(3 + Math.sqrt(f.linesOfCode || 20) * 0.95, 4), 27)
        buildingList.push({ position: [x, 0, z], size: [bw, h, bd], file: f, district: node.parent.data.name })
      }
    })
    // Second pass: attach each district's tallest building height, so labels
    // can float above the skyline (natural vertical separation) instead of
    // all sitting flat at ground level where they overlap on screen.
    const maxHeightByDistrict = {}
    buildingList.forEach((b) => {
      const cur = maxHeightByDistrict[b.district] || 0
      if (b.size[1] > cur) maxHeightByDistrict[b.district] = b.size[1]
    })
    districtList.forEach((d) => {
      d.maxHeight = (maxHeightByDistrict[d.name] || 4) + 2.5
    })
    return { buildings: buildingList, districts: districtList, gridSize: size }
  }, [data])

  // Mission State
  const isMissionActive = !!selectedTask
  const targetPaths = selectedTask?.relevantFiles?.map(f => f.path) || []
  const trapPaths = selectedTask?.knownTraps?.map(t => t.path || t.file) || []

  // Resolve hover logic
  const hoveredBuilding = buildings.find(b => b.file.path === hoveredFile)
  const hoveredDistrict = hoveredBuilding?.district

  // Send HUD info out
  useEffect(() => {
    if (hoveredBuilding) {
      onHoverInfo(hoveredBuilding.file)
    } else {
      onHoverInfo(null)
    }
  }, [hoveredBuilding, onHoverInfo])

  return (
    <>
      <color attach="background" args={['#020205']} />
      <fog attach="fog" args={['#020205', 45, 180]} />
      <CityAtmosphere />
      <ambientLight intensity={0.25} color="#4f46e5" />
      <hemisphereLight args={['#312e81', '#020205', 0.5]} />

      {/* City Lights */}
      <pointLight position={[0, 60, 0]} intensity={1.5} color="#c084fc" distance={150} />
      {/* Low fill light so building bases & floor near the camera stay readable */}
      <pointLight position={[0, 8, 40]} intensity={0.6} color="#818cf8" distance={120} />

      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]}>
        <planeGeometry args={[gridSize + 100, gridSize + 100]} />
        <MeshReflectorMaterial
          blur={[400, 100]}
          resolution={1024}
          mixBlur={1}
          mixStrength={2}
          roughness={0.25}
          depthScale={1.2}
          color="#0a0a18"
          metalness={0.7}
          mirror={0.6}
        />
      </mesh>
      {/* Neon grid overlay — this is what actually reads as "ground" from a distance */}
      <Grid
        position={[0, -0.05, 0]}
        args={[gridSize + 100, gridSize + 100]}
        cellSize={2}
        cellThickness={0.5}
        cellColor="#1e1b4b"
        sectionSize={10}
        sectionThickness={1}
        sectionColor="#4338ca"
        fadeDistance={140}
        fadeStrength={1.5}
        infiniteGrid
      />

      {/* Street layer — sits above the grid/reflector but below district platforms, so it
          only shows through in the gaps between districts, reading as roads/plazas that
          separate neighborhoods instead of bare reflective floor. */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <planeGeometry args={[gridSize + 6, gridSize + 6]} />
        <meshStandardMaterial color="#0b0b16" roughness={0.55} metalness={0.35} transparent opacity={0.92} />
      </mesh>

      {/* Environment Elements */}
      <HovercraftTraffic count={Math.round(gridSize * 1.2)} bounds={gridSize + 20} />
      <DependencyBridges buildings={buildings} isMissionActive={isMissionActive} targetPaths={targetPaths} />
      {isMissionActive && <GPSRoute buildings={buildings} targetPaths={targetPaths} />}
      <AtmosphericParticles />

      {/* Districts */}
      {districts.map((d, i) => {
        const isDimmed = isMissionActive && !targetPaths.some(p => buildings.find(b => b.file.path === p)?.district === d.name)
        return <DistrictPlatform key={`d-${i}`} position={d.position} size={d.size} name={d.name} isDimmed={isDimmed} maxHeight={d.maxHeight} />
      })}

      {/* Buildings */}
      {buildings.map((b, i) => {
        const isTarget = targetPaths.includes(b.file.path)
        const isTrap = trapPaths.includes(b.file.path)
        const isHover = hoveredFile === b.file.path
        const isNeighborHovered = !isHover && hoveredDistrict === b.district

        return (
          <CyberBuilding
            key={`b-${i}`}
            position={b.position}
            size={b.size}
            file={b.file}
            isHovered={isHover}
            isNeighborHovered={isNeighborHovered}
            isMissionActive={isMissionActive}
            isMissionTarget={isTarget}
            isMissionTrap={isTrap}
            onPointerOver={() => setHoveredFile(b.file.path)}
            onPointerOut={() => setHoveredFile(null)}
            onClick={() => setSelectedBuilding(b === selectedBuilding ? null : b)}
          />
        )
      })}

      <OrbitControls
        makeDefault
        target={[0, 6, 0]}
        enableDamping
        dampingFactor={0.05}
        maxPolarAngle={Math.PI / 2.1}
        minDistance={10}
        maxDistance={200}
      />

      <CameraController
        selectedBuilding={selectedBuilding}
        isMissionActive={isMissionActive}
        gpsStartPoint={buildings.find(b => b.file.path === targetPaths[0])?.position}
      />

      <CyberEffects />
    </>
  )
}

/* ── Floating Hover Card (Replacing old stats panel) ──── */
function HoverInfoCard({ file }) {
  if (!file) return null
  return (
    <div className="arch-hover-card" style={{
      position: 'absolute', bottom: '32px', right: '32px',
      background: 'rgba(5, 5, 16, 0.85)', backdropFilter: 'blur(12px)',
      border: '1px solid rgba(79, 70, 229, 0.4)', borderRadius: '12px',
      padding: '20px', width: '300px', color: '#fff',
      boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
      animation: 'fadeUp 0.3s ease-out'
    }}>
      <style>{`
        @keyframes fadeUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
      <div style={{ fontSize: '10px', color: '#818cf8', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px' }}>
        {file.directory || 'Root'} District
      </div>
      <div style={{ fontSize: '16px', fontWeight: 'bold', marginBottom: '16px', wordBreak: 'break-all' }}>
        {file.path.split('/').pop()}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '12px', color: '#9ca3af' }}>
        <div><strong style={{ color: '#fff' }}>{file.linesOfCode || 0}</strong> LOC</div>
        <div><strong style={{ color: '#fff' }}>{file.size ? (file.size / 1024).toFixed(1) + 'kb' : 'Unknown'}</strong></div>
        <div>Risk: <strong style={{ color: RISK_COLORS[getRiskTier(file.riskScore || 1)].hex }}>{file.riskScore || 1}/10</strong></div>
        <div>{file.semanticPurpose ? 'Analyzed' : 'Raw'}</div>
      </div>
      {file.semanticPurpose && (
        <div style={{ marginTop: '16px', fontSize: '12px', color: '#d1d5db', lineHeight: '1.4', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: '12px' }}>
          {file.semanticPurpose}
        </div>
      )}
    </div>
  )
}

/* ── Main MapView ─────────────────────────────────────── */
export default function MapView({ data, selectedTask }) {
  const [hoveredInfo, setHoveredInfo] = useState(null)

  return (
    <ErrorBoundary
      fallbackTitle="Architecture Map unavailable"
      fallbackMessage="The 3D renderer encountered an issue. Try another view."
    >
      <div className="arch-view" style={{ width: '100%', height: '100%', position: 'relative' }}>
        <Suspense fallback={
          <div className="hud-analyzing" style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center' }}>
            <div className="hud-analyzing__spinner" style={{ margin: '0 auto 16px', width: '32px', height: '32px', border: '3px solid #4f46e5', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
            <div className="hud-analyzing__text" style={{ color: '#fff', fontFamily: 'JetBrains Mono' }}>Booting OS Environment...</div>
          </div>
        }>
          <Canvas
            shadows={false}
            camera={{ position: [70, 55, 85], fov: 45, near: 0.1, far: 500 }}
            gl={{ antialias: false, alpha: false, toneMapping: THREE.NoToneMapping, powerPreference: "high-performance" }}
            dpr={[1, 2]} // limit dpr for performance with heavy post-processing
          >
            <CityScene
              data={data}
              selectedTask={selectedTask}
              onHoverInfo={setHoveredInfo}
            />
          </Canvas>
        </Suspense>

        {/* HUD Elements */}
        {selectedTask && (
          <div style={{ position: 'absolute', top: '32px', left: '32px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid #10b981', padding: '12px 20px', borderRadius: '8px', color: '#10b981', fontWeight: 'bold', fontFamily: 'JetBrains Mono', backdropFilter: 'blur(4px)' }}>
            MISSION OVERRIDE ACTIVE: {selectedTask.name}
          </div>
        )}

        <HoverInfoCard file={hoveredInfo} />
      </div>
    </ErrorBoundary>
  )
}